import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {KeyPairSigner,type KeyPairString} from 'near-api-js';
import {fixture,terms} from '../../../tests/contract/helpers';import {encodeCustomModule,type CustomFloor} from '../../../packages/shared/src/custom-layout';import type {EconomySnapshot} from '../../../packages/shared/src/types';import {Store} from '../src/db';import {Outbox} from '../src/outbox';import {NearChain} from '../src/chain';import {Runs} from '../src/runs';
// A funded tonic sits in a pocket sealed by a cracked wall; the floor floods after 20 turns.
for(const outcome of ['extracted','died'] as const)test(`v12 paid play: hidden stash behind a cracked wall, tide; ${outcome} settles exact goods`,{timeout:90000},async()=>{
 const f=await fixture(),dir=mkdtempSync(join(tmpdir(),'depth-'));let db=new Store(join(dir,'db'));
 try{
 const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);let box=new Outbox(db,chain),runs=new Runs(db,box);
 const floor:CustomFloor={tiles:['#######','#...#.#','#...#.#','#...###','#######'],spawn:{x:1,y:1},exit:{x:1,y:3},sockets:[{x:5,y:1}],tuning:[],devices:[],exit_rule:{extract:true,require_clear:false},features:[{id:'crack',x:4,y:1,kind:'crack',hp:2},{id:'cache',x:2,y:2,kind:'cache',supply:'dart',count:2}],tide:{turns:20,damage:6}};
 box.enqueue('publish',{actor:'maker',action:{type:'publish',terms:{...terms(Number(await chain.clock())),rules_version:12,modules:[encodeCustomModule(floor,'depth')],sockets:[{id:'stash',room:0,slot:0,enemy:'none',trap:false,reward:'tonic'}]},fee:'1',funding:['maker-tonic-0']}});assert.equal((await box.process('publish')).status,'Applied');
 box.enqueue('admit',{actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'1',loadout_ids:['buyer-club'],seed:'1'}});assert.equal((await box.process('admit')).status,'Applied');
 const run=runs.materialize('admit',await f.view('snapshot') as EconomySnapshot);let seq=0;const act=(action:Parameters<Runs['action']>[4])=>{const view=runs.action(run.id,'buyer','step-'+seq,seq,action);seq=view.seq;return view;};
 let view=runs.view(run.id,'buyer');
 assert.equal(view.state.room[1][5],'?');assert.ok(!('maker-tonic-0' in view.state.items));assert.ok(view.state.features!.some(x=>x.kind==='crack'));
 act({type:'move',x:2,y:1});act({type:'move',x:2,y:2});assert.equal(runs.view(run.id,'buyer').state.supplies?.dart,2);act({type:'move',x:3,y:2});act({type:'move',x:3,y:1});
 act({type:'move',x:4,y:1});view=act({type:'move',x:4,y:1});assert.equal(view.state.room[1][4],'.');
 db.close();db=new Store(join(dir,'db'));box=new Outbox(db,chain);runs=new Runs(db,box);
 act({type:'move',x:4,y:1});view=act({type:'move',x:5,y:1});assert.ok('maker-tonic-0' in view.state.items);act({type:'pickup',itemId:'maker-tonic-0'});
 if(outcome==='died'){while(view.state.status==='active')view=act({type:'wait'});}
 else{for(const [x,y] of [[4,1],[3,1],[2,1],[1,1],[1,2],[1,3]])view=act({type:'move',x,y});assert.equal(view.canExtract,true);view=act({type:'extract'});}
 assert.equal(view.state.status,outcome);await box.recover();
 const settled=await f.view('snapshot') as EconomySnapshot;assert.equal(settled.runs[0].status,outcome);
 if(outcome==='extracted'){for(const id of ['maker-tonic-0','buyer-club'])assert.deepEqual(settled.items.find(i=>i.id===id)!.location,{kind:'owned',profile:'buyer'});}
 else{assert.equal(settled.items.find(i=>i.id==='buyer-club')!.location.kind,'bank');assert.equal(settled.items.find(i=>i.id==='maker-tonic-0')!.location.kind,'edition_fixed');}
 }finally{db.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});
