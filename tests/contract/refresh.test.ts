import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import {commandHash} from '../../packages/shared/src/protocol';
import type {Command} from '../../packages/shared/src/types';
test('refresh deposits exact owned stock without reallocating runs or charging again; partial pools cannot admit',{timeout:120000},async()=>{
 const f=await fixture();try{
 // The legacy shared audit assumes all deposits are original. Check refresh provenance here.
 const apply=async(id:string,command:Command)=>{const r=await f.call('execute',{op_id:id,command});assert.equal(r.payload_hash,commandHash(command));return r;};
 const base=terms(Number(await f.view('clock_ms')));
 await apply('publish',{actor:'maker',action:{type:'publish_random',terms:{...base,sockets:[base.sockets[0],{...base.sockets[1],reward:null}]},fee:'3',fixed_funding:['maker-sword-0'],random_tables:[{table_id:'loot',socket_ids:['tonic-a'],item_ids:['maker-tonic-0']}]}});
 const admission=(actor:string):Command=>({actor,action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'3',loadout_ids:[],seed:'23'}});
 const first=await apply('first',admission('buyer'));assert.equal(first.status,'Applied');
 const initial=await f.view('snapshot');
 const refresh:Command={actor:'maker',action:{type:'refresh',edition_id:'edition-0',fixed_funding:['maker-sword-1'],random_funding:[]}};
 const r=await apply('refresh',refresh);assert.equal(r.status,'Applied');assert.deepEqual(await apply('refresh',refresh),r);
 assert.equal((await apply('partial',admission('p2'))).result,'IncompleteBundle');
 const top:Command={actor:'maker',action:{type:'refresh',edition_id:'edition-0',fixed_funding:[],random_funding:[{table_id:'loot',item_ids:['maker-tonic-1']}]}};
 assert.equal((await apply('top',top)).status,'Applied');
 const funded=await f.view('snapshot');assert.deepEqual(funded.runs,initial.runs);assert.equal(funded.bank,initial.bank);assert.deepEqual(funded.credits,initial.credits);
 assert.equal(funded.editions[0].original_value,'18');assert.equal(funded.editions[0].refresh_value,'18');assert.equal(funded.editions[0].placement_paid,initial.editions[0].placement_paid);assert.equal(funded.editions[0].terms_hash,initial.editions[0].terms_hash);assert.equal(funded.editions[0].version,'1');
 assert.deepEqual(funded.editions[0].refresh_ids,['maker-sword-1','maker-tonic-1']);
 for(const [i,command] of [
 {...refresh,actor:'p2'},refresh,
 {actor:'maker',action:{type:'refresh',edition_id:'edition-0',fixed_funding:['maker-sword-2','maker-sword-2'],random_funding:[]}},
 {actor:'maker',action:{type:'refresh',edition_id:'edition-0',fixed_funding:['maker-sword-2'],random_funding:[{table_id:'missing',item_ids:['maker-tonic-2']}]}},
 {actor:'maker',action:{type:'refresh',edition_id:'edition-0',fixed_funding:['maker-tonic-2'],random_funding:[]}},
 {actor:'maker',action:{type:'refresh',edition_id:'edition-0',fixed_funding:[],random_funding:[]}},
 ].entries()){assert.equal((await apply(`bad-${i}`,command as Command)).status,'Rejected');assert.deepEqual(await f.view('snapshot'),funded);}
 const next=await apply('next',admission('p2'));assert.equal(next.status,'Applied');assert.deepEqual(next.run.assignments.map((a:any)=>a.item_id),['maker-sword-1','maker-tonic-1']);
 const before=await f.view('snapshot');
 for(let i=0;i<10&&BigInt(await f.view('clock_ms'))<BigInt(base.closes_at_ms);i++) await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'ff',method:'sandbox_fast_forward',params:{delta_height:1000}})});
 assert.ok(BigInt(await f.view('clock_ms'))>=BigInt(base.closes_at_ms));
 assert.equal((await apply('late',{actor:'maker',action:{type:'refresh',edition_id:'edition-0',fixed_funding:['maker-sword-2'],random_funding:[]}})).result,'EditionNotOpen');assert.deepEqual(await f.view('snapshot'),before);
 for(const [actor,run] of [['buyer',first],['p2',next]] as const){
  const disposition={town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:run.run.assignments.map((a:any)=>a.item_id)};
  assert.equal((await apply(`void-${actor}`,{actor,action:{type:'void',run_id:run.result,reason:'late recovery',disposition}})).status,'Applied');
 }
 assert.equal((await apply('close',{actor:'maker',action:{type:'finalize_close',edition_id:'edition-0'}})).status,'Applied');
 const final=await f.view('snapshot');
 for(const id of [...final.editions[0].funded_ids,...final.editions[0].refresh_ids])assert.equal(final.items.find((i:any)=>i.id===id).location.kind,'bank');
 assert.equal(final.editions[0].original_value,'18');assert.equal(final.editions[0].refresh_value,'18');assert.equal(final.credits.buyer,'10');assert.equal(final.credits.p2,'10');
 assert.equal(Object.values(final.credits).reduce<bigint>((n,v)=>n+BigInt(v as string),BigInt(final.bank)),150n);
 }finally{await f.sandbox.tearDown();}
});
