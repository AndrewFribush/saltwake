import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import {randomPoolSelection,replenishmentAction} from '../../packages/shared/src/replenishment';
import {commandHash} from '../../packages/shared/src/protocol';
import type {Command,EconomySnapshot} from '../../packages/shared/src/types';

test('Maker selections replenish fixed rewards and colliding random names into exact contract pools',{timeout:120000},async()=>{
 const f=await fixture();
 try{
  const apply=async(id:string,command:Command)=>{const receipt=await f.call('execute',{op_id:id,command});assert.equal(receipt.payload_hash,commandHash(command));assert.equal(receipt.status,'Applied',receipt.result);return receipt;};
  const base=terms(Number(await f.view('clock_ms')));
  await apply('publish',{actor:'maker',action:{type:'publish_random',terms:{...base,sockets:base.sockets.map((s,i)=>({...s,reward:i===0?'tonic':null}))},fee:'0',fixed_funding:['maker-tonic-0'],random_tables:[{table_id:'fixed',socket_ids:['tonic-a'],item_ids:['maker-tonic-1']},{table_id:'random:fixed',socket_ids:['tonic-b'],item_ids:['maker-tonic-2']}]}});
  const admission=(actor:string):Command=>({actor,action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'23'}});
  await apply('first',admission('buyer'));
  const before=await f.view('snapshot') as EconomySnapshot;
  const e=before.editions[0],edition={id:e.id,terms:e.terms,randomTables:e.random_tables};
  const selections=['fixed',randomPoolSelection('fixed'),randomPoolSelection('random:fixed')];
  const expectedLocations=[{kind:'edition_fixed',edition:e.id,item_type:'tonic'},{kind:'edition_random',edition:e.id,table_id:'fixed'},{kind:'edition_random',edition:e.id,table_id:'random:fixed'}];
  for(const [index,selection] of selections.entries()){
   const itemId=`maker-tonic-${index+3}`,snapshot=await f.view('snapshot') as EconomySnapshot;
   const action=replenishmentAction(edition,selection,[itemId],snapshot.items,'maker');assert.ok(action);
   const command:Command={actor:'maker',action};
   const receipt=await apply(`refill-${index}`,command);
   const after=await f.view('snapshot') as EconomySnapshot;
   assert.deepEqual(after.items.find(i=>i.id===itemId)!.location,expectedLocations[index]);
   assert.deepEqual(after.runs,before.runs,'existing reservations must not change');
   assert.deepEqual(after.credits,before.credits);
   assert.equal(after.bank,before.bank);
   assert.deepEqual(await apply(`refill-${index}`,command),receipt);
   assert.deepEqual(await f.view('snapshot'),after,'retry must not duplicate deposits');
  }
  const second=await apply('second',admission('p2'));
  assert.deepEqual(second.run.assignments.map((a:{socket:string;item_id:string})=>[a.socket,a.item_id]),[['sword','maker-tonic-3'],['tonic-a','maker-tonic-4'],['tonic-b','maker-tonic-5']]);
  const after=await f.view('snapshot') as EconomySnapshot;
  assert.deepEqual(after.editions[0].refresh_ids,['maker-tonic-3','maker-tonic-4','maker-tonic-5']);
  assert.equal(after.editions[0].terms_hash,e.terms_hash);
  assert.equal(after.editions[0].version,e.version);
 }finally{await f.sandbox.tearDown();}
});
