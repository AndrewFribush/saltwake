import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Store} from '../src/db';import {Outbox,type Chain} from '../src/outbox';import {commandHash} from '../../../packages/shared/src/protocol';import type {Command,OperationStatus} from '../../../packages/shared/src/types';
const action:Command['action']={type:'cancel_listing',listing_id:'missing'};
function setup(){const dir=mkdtempSync(join(tmpdir(),'player-outbox-'));let db=new Store(join(dir,'db'));let signs=0,broadcasts=0;const receipts=new Map<string,OperationStatus>();const chain:Chain={sign:async()=>{signs++;return {hash:'operator-tx',bytes:'operator-signed'};},broadcast:async()=>{broadcasts++;},receipt:async id=>receipts.get(id)??null};return {dir,get db(){return db;},chain,receipts,counts:()=>({signs,broadcasts}),restart(){db.close();db=new Store(join(dir,'db'));},close(){db.close();rmSync(dir,{recursive:true,force:true});}};}
test('player requests remain unsigned across retries/restart and accept only exact final receipts',async()=>{
 const f=setup();try{let box=new Outbox(f.db,f.chain);const row=box.enqueuePlayer('alice.testnet','request',action);await box.process(row.id);await box.recover();assert.equal(f.db.operation(row.id)?.status,'Unknown');assert.equal(f.db.operation(row.id)?.authority,'player');assert.deepEqual(f.counts(),{signs:0,broadcasts:0});assert.throws(()=>box.enqueue(row.id,row.command),/signature required/);assert.throws(()=>box.enqueuePlayer('alice.testnet','request',{...action,listing_id:'different'}),/payload conflict/);
 f.restart();box=new Outbox(f.db,f.chain);await box.recover();assert.deepEqual(f.counts(),{signs:0,broadcasts:0});
 f.receipts.set(row.id,{status:'Rejected',op_id:row.id,payload_hash:'wrong',result:'MissingListing',run:null});await box.recover();assert.equal(f.db.operation(row.id)?.status,'Unknown');
 f.receipts.set(row.id,{status:'Rejected',op_id:row.id,payload_hash:row.hash,result:'MissingListing',run:null});await box.recover();assert.equal(f.db.operation(row.id)?.status,'Rejected');assert.deepEqual(f.counts(),{signs:0,broadcasts:0});
 }finally{f.close();}
});
test('an unresolved player request never blocks the independent operator signer stream',async()=>{
 const f=setup();try{const box=new Outbox(f.db,f.chain);box.enqueuePlayer('alice.testnet','wait',action);box.enqueue('ordinary',{actor:'maker',action:{type:'debit',amount:'1'}});await box.recover();assert.deepEqual(f.counts(),{signs:1,broadcasts:1});}finally{f.close();}
});
test('receipt identity conflicts and stored signed bytes cannot make a player request broadcast',async()=>{
 const f=setup();try{const box=new Outbox(f.db,f.chain),row=box.enqueuePlayer('alice.testnet','wait',action);row.signed={hash:'unexpected',bytes:'unexpected'};f.db.putOperation(row);f.receipts.set(row.id,{status:'Applied',op_id:'wrong',payload_hash:row.hash,result:'x',run:null});await box.recover();assert.equal(f.db.operation(row.id)?.status,'Unknown');f.receipts.clear();await box.recover();assert.deepEqual(f.counts(),{signs:0,broadcasts:0});}finally{f.close();}
});
test('account identities isolate operation IDs and wallet results and malformed starts are not user-submittable',()=>{
 const f=setup();try{const box=new Outbox(f.db,f.chain),a=box.enqueuePlayer('alice.testnet','same',action),b=box.enqueuePlayer('bob.testnet','same',action);assert.notEqual(a.id,b.id);assert.equal(a.id.length,64);assert.equal(a.hash,commandHash(a.command));
 for(const type of ['settle','void','finish_craft','finish_recovery','begin_craft','begin_recovery','debit'])assert.throws(()=>box.enqueuePlayer('alice.testnet','bad',{type} as any),/game authority/);
 }finally{f.close();}
});
test('confirmed player admission retains terminal capacity and cost observers never claim missing before evidence',async()=>{
 const f=setup();try{let before=0,after=0;const box=new Outbox(f.db,f.chain,{before:async()=>{before++;},after:async()=>{after++;}});
 const row=box.enqueuePlayer('alice.testnet','admit',{type:'admit',edition_id:'e',expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'0'});
 f.receipts.set(row.id,{status:'Applied',op_id:row.id,payload_hash:row.hash,result:'run-0',run:{id:'run-0'} as any});await box.process(row.id);assert.equal(before,0);assert.equal(after,1);
 for(let n=0;n<254;n++){const r=box.enqueue('fill-'+n,{actor:'maker',action:{type:'debit',amount:'1'}});r.status='Rejected';f.db.putOperation(r);}
 assert.throws(()=>box.enqueuePlayer('bob.testnet','overflow',action),/capacity/);
 assert.doesNotThrow(()=>box.enqueue('settle-run-0',{actor:row.command.actor,action:{type:'void',run_id:'run-0',reason:'recovery',disposition:{town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:[]}}}));
 }finally{f.close();}
});
test('an unsigned foreign closure cannot discharge another creator’s reserved terminal capacity',()=>{
 const f=setup();try{const box=new Outbox(f.db,f.chain);
 const publish=box.enqueuePlayer('alice.testnet','publish',{type:'publish',terms:{title:'Fixture',rules_version:11,modules:[],sockets:[],opens_at_ms:'0',closes_at_ms:'1',run_duration_ms:'60000',max_runs:1,no_reward:true,difficulty_tag:'standard',style_tag:'combat'},fee:'0',funding:[]});
 publish.status='Applied';publish.receipt={status:'Applied',op_id:publish.id,payload_hash:publish.hash,result:'edition-a',run:null};f.db.putOperation(publish);
 box.enqueuePlayer('bob.testnet','fake-close',{type:'finalize_close',edition_id:'edition-a'});
 for(let i=0;i<253;i++){const r=box.enqueue('fill-'+i,{actor:'maker',action:{type:'debit',amount:'1'}});r.status='Rejected';f.db.putOperation(r);}
 assert.throws(()=>box.enqueue('extra',{actor:'maker',action:{type:'debit',amount:'1'}}),/capacity/);
 assert.doesNotThrow(()=>box.enqueuePlayer('alice.testnet','real-close',{type:'finalize_close',edition_id:'edition-a'}));
 }finally{f.close();}
});
test('a stalled player receipt cannot stall operator signing or create duplicate polling requests',async()=>{
 const f=setup();try{let release!:(r:null)=>void,lookups=0;const wait=new Promise<null>(r=>release=r);const base=f.chain.receipt;let playerId='';
 f.chain.receipt=async id=>{if(id===playerId){lookups++;return wait;}return base(id);};
 const box=new Outbox(f.db,f.chain,undefined,{receiptTimeoutMs:30});playerId=box.enqueuePlayer('alice.testnet','wait',action).id;
 box.enqueue('oracle',{actor:'maker',action:{type:'debit',amount:'1'}});await box.recover();
 assert.deepEqual(f.counts(),{signs:1,broadcasts:1});assert.equal(f.db.operation(playerId)?.status,'Unknown');assert.match(f.db.operation(playerId)?.reason??'',/timed out/);
 await box.process(playerId);assert.equal(lookups,1,'a response timeout does not restart the live receipt request');
 release(null);await new Promise(r=>setImmediate(r));
 }finally{f.close();}
});
test('two owner-bound queued oracle terminals occupy both reserved slots without double-counting',()=>{
 const f=setup();try{const box=new Outbox(f.db,f.chain);for(let i=0;i<2;i++){const r=box.enqueuePlayer('alice.testnet','entry-'+i,{type:'admit',edition_id:'e',expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'0'});r.status='Applied';r.receipt={status:'Applied',op_id:r.id,payload_hash:r.hash,result:'run-'+i,run:{id:'run-'+i} as any};f.db.putOperation(r);}
 for(let i=0;i<252;i++){const r=box.enqueue('fill-'+i,{actor:'maker',action:{type:'debit',amount:'1'}});r.status='Rejected';f.db.putOperation(r);}
 for(let i=0;i<2;i++)assert.doesNotThrow(()=>box.enqueue('end-'+i,{actor:'wallet:alice.testnet',action:{type:'void',run_id:'run-'+i,reason:'recovery',disposition:{town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:[]}}}));
 assert.equal(f.db.operations().length,256);
 }finally{f.close();}
});
test('stalled observations are bounded, retain their live slot and signal cancellation before late writes',async()=>{
 const f=setup();try{let release!:()=>void,calls=0,writes=0;const wait=new Promise<void>(r=>release=r);
 const box=new Outbox(f.db,f.chain,{before:async(_row,signal)=>{calls++;await wait;if(!signal?.aborted)writes++;},after:async()=>{}},{observationTimeoutMs:20});
 const row=box.enqueuePlayer('alice.testnet','wait',action);await box.recover();assert.equal(f.db.operation(row.id)?.status,'Unknown');assert.match(f.db.get<any>('cost-observation-errors',row.id).error,/timed out/);
 await box.recover();assert.equal(calls,1);release();await new Promise(r=>setImmediate(r));assert.equal(writes,0);assert.deepEqual(f.counts(),{signs:0,broadcasts:0});
 }finally{f.close();}
});
test('a confirmed discovered run reserves a terminal slot without a fabricated admission operation',()=>{
 const f=setup();try{const box=new Outbox(f.db,f.chain);f.db.put('run','direct-run',{id:'direct-run',profile:'wallet:alice.testnet',admissionSource:'chain-discovery'});
 for(let i=0;i<255;i++){const r=box.enqueue('f-'+i,{actor:'maker',action:{type:'debit',amount:'1'}});r.status='Rejected';f.db.putOperation(r);}
 assert.throws(()=>box.enqueue('overflow',{actor:'maker',action:{type:'debit',amount:'1'}}),/capacity/);
 assert.doesNotThrow(()=>box.enqueue('terminal-direct-run',{actor:'wallet:alice.testnet',action:{type:'void',run_id:'direct-run',reason:'recovery',disposition:{town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:[]}}}));
 assert.equal(f.db.operations().some(o=>o.command.action.type==='admit'),false);
 }finally{f.close();}
});


test('wallet craft preparation is account-bound, unsigned and retains terminal headroom',async()=>{
 const {playerOperationId}=await import('../../../packages/shared/src/player-identity');
 const f=setup();try{
  const box=new Outbox(f.db,f.chain),id=playerOperationId('alice.testnet','craft');
  const craft:Command['action']={type:'begin_craft',batch_id:id,input_ids:['h1','h2','f1','f2'],challenge_commitment:'ab'.repeat(32),deadline_ms:'0'};
  assert.throws(()=>box.enqueuePlayer('bob.testnet','craft',craft),/batch must match/);
  assert.throws(()=>box.enqueuePlayer('alice.testnet','other',craft),/batch must match/);
  const row=box.enqueuePlayer('alice.testnet','craft',craft);await box.process(row.id);
  assert.equal(row.id,id);assert.deepEqual(f.counts(),{signs:0,broadcasts:0});
  for(let i=0;i<254;i++){const r=box.enqueue('craft-fill-'+i,{actor:'maker',action:{type:'debit',amount:'1'}});r.status='Rejected';f.db.putOperation(r);}
  assert.throws(()=>box.enqueue('overflow',{actor:'maker',action:{type:'debit',amount:'1'}}),/capacity/);
  assert.doesNotThrow(()=>box.enqueue('craft-finish',{actor:row.command.actor,action:{type:'finish_craft',batch_id:id,tier:'normal',reason:'expired'}}));
 }finally{f.close();}
});
