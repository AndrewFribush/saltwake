import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {KeyPairSigner,type KeyPairString} from 'near-api-js';
import {fixture,terms} from '../../../tests/contract/helpers';import {Store} from '../src/db';import {Outbox} from '../src/outbox';import {NearChain} from '../src/chain';import {Runs} from '../src/runs';import {encodeCustomModule,type CustomFloor} from '../../../packages/shared/src/custom-layout';import type {Action} from '../../../packages/game/src/actions';
test('funded graph traversal survives restart without enemy or loot respawn, and settles exact consumed/forfeited goods',{timeout:120000},async()=>{
 const f=await fixture(),dir=mkdtempSync(join(tmpdir(),'room-links-'));let db=new Store(join(dir,'db'));
 const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);let box=new Outbox(db,chain),runs=new Runs(db,box);
 try{
  const floor=(to:number):CustomFloor=>({tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[],links:[{id:'passage',x:1,y:2,to,require_clear:true}]});const floors=[floor(1),floor(0)];floors[0].sockets=[{x:2,y:1}];
  const t={...terms(Number(await f.view('clock_ms'))),rules_version:6,modules:floors.map(f=>encodeCustomModule(f,'graph')),sockets:[{id:'encounter',room:0,slot:0,enemy:'pursuer' as const,trap:false,reward:'tonic' as const}]};
  box.enqueue('publish',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:['maker-tonic-0']}});assert.equal((await box.process('publish')).status,'Applied');
  box.enqueue('admit',{actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'1',loadout_ids:['buyer-club'],seed:'1'}});assert.equal((await box.process('admit')).status,'Applied');const initial=runs.materialize('admit',await f.view('snapshot'));let n=0;
  const step=(action:Action)=>{const row=runs.get(initial.id,'buyer');return runs.action(initial.id,'buyer','step-'+n++,row.seq,action);};
  assert.throws(()=>step({type:'move',x:1,y:2}),/not permitted/);
  step({type:'attack',enemyId:'encounter'});step({type:'attack',enemyId:'encounter'});step({type:'move',x:2,y:1});step({type:'pickup',itemId:'maker-tonic-0'});step({type:'move',x:1,y:1});
  const seq=runs.get(initial.id,'buyer').seq;const travel=runs.action(initial.id,'buyer','travel',seq,{type:'move',x:1,y:2});assert.equal(travel.state.roomIndex,1);assert.equal(travel.state.roomMemory,undefined);assert.equal(travel.state.layout,undefined);assert.equal(travel.hasNextRoom,false);
  db.close();db=new Store(join(dir,'db'));box=new Outbox(db,chain);runs=new Runs(db,box);
  assert.deepEqual(runs.action(initial.id,'buyer','travel',seq,{type:'move',x:1,y:2}),travel,'retry after restart does not travel twice');
  const returned=step({type:'move',x:1,y:2});assert.equal(returned.state.roomIndex,0);assert.equal(returned.state.enemies.length,0);assert.deepEqual(returned.state.items['maker-tonic-0'].location,{kind:'bag'});
  step({type:'use',itemId:'maker-tonic-0'});runs.finish(runs.get(initial.id,'buyer'),'abandoned');await box.recover();await box.recover();const final=await f.view('snapshot');assert.equal(final.runs[0].status,'abandoned');assert.equal(final.items.find((i:any)=>i.id==='maker-tonic-0').location.kind,'consumed');assert.equal(final.items.find((i:any)=>i.id==='buyer-club').location.kind,'bank');assert.equal(final.credits.buyer,'9');assert.equal(final.credits.maker,'96');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});
