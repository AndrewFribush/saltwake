import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {KeyPairSigner,type KeyPairString} from 'near-api-js';
import {fixture,terms} from '../../../tests/contract/helpers';
import {audit} from '../../../tests/contract/invariants';
import {creatorFunding,creatorSockets,type CreatorPlacement} from '../../../packages/shared/src/creator-rewards';
import {encodeCustomModule,type CustomFloor} from '../../../packages/shared/src/custom-layout';
import type {Command,EconomySnapshot} from '../../../packages/shared/src/types';
import {Store} from '../src/db';
import {Outbox} from '../src/outbox';
import {NearChain} from '../src/chain';
import {Runs,type SavedRun} from '../src/runs';
import {availability} from '../src/availability';

test('independent creator pools reserve, replenish and return exact goods without crossing pools',{timeout:120000},async()=>{
 const f=await fixture();const dir=mkdtempSync(join(tmpdir(),'independent-pools-'));let db:Store|undefined;
 try{
  db=new Store(join(dir,'db'));
  const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);
  const box=new Outbox(db,chain),runs=new Runs(db,box);
  const snapshot=async()=>{const w=await f.view('snapshot') as EconomySnapshot;audit(w);return w;};
  const apply=async(id:string,action:Command['action'],actor='maker',expected:'Applied'|'Rejected'='Applied')=>{
   box.enqueue(id,{actor,action});const row=await box.process(id);
   assert.equal(row.status,expected,JSON.stringify(row.receipt??row.reason));
   assert.ok(row.receipt?.status==='Applied'||row.receipt?.status==='Rejected');
   assert.equal(row.receipt.status,expected);return row.receipt;
  };
  const placements:CreatorPlacement[][]=[
   [{enemy:'none',trap:false,reward:'random',randomPool:'blades'}],
   [{enemy:'none',trap:false,reward:'random',randomPool:'medicine'},{enemy:'none',trap:false,reward:'random',randomPool:'medicine'}]
  ];
  const floor=(sockets:CustomFloor['sockets']):CustomFloor=>({tiles:['#########',...Array(5).fill('#.......#'),'#########'],spawn:{x:1,y:1},exit:{x:7,y:5},sockets});
  const floors=[floor([{x:2,y:1}]),floor([{x:3,y:2},{x:5,y:3}])];
  const sockets=creatorSockets(placements);
  const assignments:Record<string,string>={'maker-sword-0':'blades','maker-sword-1':'blades','maker-tonic-0':'medicine','maker-tonic-1':'medicine'};
  const initial=await snapshot();
  const funding=creatorFunding(placements,Object.keys(assignments),assignments,initial.items,'maker');
  assert.deepEqual(funding.errors,[]);assert.deepEqual(funding.fixed_funding,[]);
  assert.equal(funding.randomSocketCount,3);assert.equal(funding.completeCopies,1);
  assert.deepEqual(funding.random_tables,[
   {table_id:'blades',socket_ids:['floor-0-slot-0'],item_ids:['maker-sword-0','maker-sword-1']},
   {table_id:'medicine',socket_ids:['floor-1-slot-0','floor-1-slot-1'],item_ids:['maker-tonic-0','maker-tonic-1']}
  ]);
  const published=await apply('pools-publish',{type:'publish_random',terms:{...terms(Number(await chain.clock())),rules_version:5,modules:floors.map(floor=>encodeCustomModule(floor,'sized')),sockets},fee:'1',fixed_funding:funding.fixed_funding,random_tables:funding.random_tables});
  const editionId=published.result;
  const bundles=(w:EconomySnapshot)=>availability(w.editions.find(e=>e.id===editionId)!,w.items,Number(w.editions.find(e=>e.id===editionId)!.terms.opens_at_ms)).bundles;
  assert.equal(bundles(await snapshot()),1);
  const admission=(seed:string):Command['action']=>({type:'admit',edition_id:editionId,expected_version:'1',expected_fee:'1',loadout_ids:[],seed});
  const checkMaterialized=(run:SavedRun,w:EconomySnapshot)=>{
   assert.equal(run.economic.assignments.length,3);
   assert.equal(new Set(run.economic.assignments.map(a=>a.item_id)).size,3);
   assert.deepEqual([...run.state.reservedItemIds].sort(),run.economic.assignments.map(a=>a.item_id).sort());
   for(const a of run.economic.assignments){
    const socket=sockets.find(s=>s.id===a.socket)!;assert.ok(socket);
    const pool=placements[socket.room][socket.slot].randomPool!;
    assert.equal(a.source_pool,'random:'+pool);
    const item=w.items.find(i=>i.id===a.item_id)!;
    assert.equal(item.item_type,pool==='blades'?'sword':'tonic');
    assert.deepEqual(item.location,{kind:'reserved',run:run.id,socket:socket.id,source_pool:'random:'+pool});
    assert.deepEqual(run.state.items[item.id],{id:item.id,type:item.item_type,origin:'dungeon',location:{kind:'floor',room:socket.room,...floors[socket.room].sockets[socket.slot]}});
   }
  };
  const admit=async(id:string,actor:string,seed:string)=>{
   await apply(id,admission(seed),actor);const w=await snapshot();
   const run=runs.materialize(id,w);checkMaterialized(run,w);return run;
  };
  const first=await admit('pools-first','buyer','101');
  const assertFirstReserved=(w:EconomySnapshot)=>{
   assert.deepEqual(w.runs.find(r=>r.id===first.id),first.economic);
   for(const a of first.economic.assignments)assert.deepEqual(w.items.find(i=>i.id===a.item_id)!.location,{kind:'reserved',run:first.id,socket:a.socket,source_pool:a.source_pool});
  };
  const blocked=async(id:string,actor:string)=>{
   const before=await snapshot();assert.equal(bundles(before),0);
   assert.ok(before.editions[0].active_runs.length<4,'stock, not the four-run limit, must block admission');
   assert.equal((await apply(id,admission('909'),actor,'Rejected')).result,'IncompleteBundle');
   assert.deepEqual(await snapshot(),before,'failed partial draws must not reserve any stock or fee');
  };
  await blocked('pools-bottleneck','p2');
  const refresh=(table_id:string,item_ids:string[]):Command['action']=>({type:'refresh',edition_id:editionId,fixed_funding:[],random_funding:[{table_id,item_ids}]});
  const beforeRefresh=await snapshot();
  await apply('pools-more-blades',refresh('blades',['maker-sword-2']));
  const bladesOnly=await snapshot();assertFirstReserved(bladesOnly);
  assert.equal(bladesOnly.items.filter(i=>i.location.kind==='edition_random'&&i.location.table_id==='blades').length,2);
  assert.deepEqual(bladesOnly.credits,beforeRefresh.credits);assert.equal(bladesOnly.bank,beforeRefresh.bank);
  await blocked('pools-still-no-medicine','p2');
  const topUp=refresh('medicine',['maker-tonic-2','maker-tonic-3']);
  const refreshed=await apply('pools-more-medicine',topUp);
  const topped=await snapshot();assertFirstReserved(topped);assert.equal(bundles(topped),1);
  assert.deepEqual(topped.editions[0].refresh_ids.slice().sort(),['maker-sword-2','maker-tonic-2','maker-tonic-3']);
  assert.deepEqual(await apply('pools-more-medicine',topUp),refreshed);
  assert.deepEqual(await snapshot(),topped,'same outbox operation cannot duplicate refresh');
  // Re-execute the same logical request on-chain to cover contract receipt replay,
  // independently of the Outbox's local terminal-status shortcut.
  assert.deepEqual(await f.call('execute',{op_id:'pools-more-medicine',command:{actor:'maker',action:topUp}}),refreshed);
  assert.deepEqual(await snapshot(),topped,'replayed chain request cannot duplicate refresh');
  assert.equal((await apply('pools-duplicate-new-id',topUp,'maker','Rejected')).result,'UnownedFunding');
  assert.deepEqual(await snapshot(),topped,'a fresh request cannot deposit the same physical goods again');
  const second=await admit('pools-second','p2','202');
  assert.equal(new Set([...first.economic.assignments,...second.economic.assignments].map(a=>a.item_id)).size,6);
  await blocked('pools-second-bottleneck','p3');
  const twoActive=await snapshot();
  await apply('pools-final-medicine',refresh('medicine',['maker-tonic-4','maker-tonic-5']));
  const finalTopUp=await snapshot();assertFirstReserved(finalTopUp);
  assert.deepEqual(finalTopUp.runs,twoActive.runs,'refresh cannot reallocate either active run');
  for(const item of twoActive.items.filter(i=>i.location.kind==='reserved'))assert.deepEqual(finalTopUp.items.find(i=>i.id===item.id),item);
  const third=await admit('pools-third','p3','303');
  assert.equal(new Set([first,second,third].flatMap(r=>r.economic.assignments.map(a=>a.item_id))).size,9);
  // Carry the first room's sword; the second room's tonics remain unvisited.
  const sword=first.economic.assignments.find(a=>a.source_pool==='random:blades')!;
  runs.action(first.id,'buyer','move-to-sword',0,{type:'move',x:2,y:1});
  runs.action(first.id,'buyer','take-sword',1,{type:'pickup',itemId:sword.item_id});
  assert.deepEqual(runs.get(first.id,'buyer').state.items[sword.item_id].location,{kind:'bag'});
  const beforeAbandon=await snapshot();
  runs.finish(runs.get(first.id,'buyer'),'abandoned');
  const terminal=runs.get(first.id,'buyer').settlement!;
  assert.equal((await box.process(terminal)).status,'Applied');
  const afterAbandon=await snapshot();assert.equal(afterAbandon.runs.find(r=>r.id===first.id)!.status,'abandoned');
  for(const a of first.economic.assignments)assert.deepEqual(afterAbandon.items.find(i=>i.id===a.item_id)!.location,{kind:'edition_random',edition:editionId,table_id:a.source_pool.slice('random:'.length)});
  for(const run of [second,third]){
   assert.deepEqual(afterAbandon.runs.find(r=>r.id===run.id),beforeAbandon.runs.find(r=>r.id===run.id));
   for(const a of run.economic.assignments)assert.deepEqual(afterAbandon.items.find(i=>i.id===a.item_id),beforeAbandon.items.find(i=>i.id===a.item_id));
  }
  assert.equal(bundles(afterAbandon),1);
  assert.equal(new Set(afterAbandon.items.map(i=>i.id)).size,initial.items.length);
  assert.equal((await box.process(terminal)).status,'Applied');assert.deepEqual(await snapshot(),afterAbandon);
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});
