import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/db';
import {Outbox,REPLAY_MIN_AGE_MS,RESIGN_CUTOFF_MS,type Chain} from '../src/outbox';
import {commandHash} from '../../../packages/shared/src/protocol';
import type {Command} from '../../../packages/shared/src/types';
const command:Command={actor:'maker',action:{type:'debit',amount:'1'}};
function setup(){const dir=mkdtempSync(join(tmpdir(),'dungeon-outbox-'));const db=new Store(join(dir,'db.sqlite'));return {dir,db,close(){db.close();rmSync(dir,{recursive:true,force:true});}};}
test('save command and signed bytes before broadcast, preserve ID on uncertain retry and restart',async()=>{
 const f=setup();let broadcasts=0;let landed=false;let signed=0;
 const chain:Chain={async sign(id,c){assert.equal(f.db.operation(id)?.hash,commandHash(c));signed++;return {hash:'tx1',bytes:'signed'};},async broadcast(tx){assert.equal(f.db.operation('op')?.signed?.bytes,tx.bytes);broadcasts++;landed=true;throw Error('lost response');},async receipt(id){return landed?{status:'Rejected',op_id:id,payload_hash:commandHash(command),result:'DeprecatedSmokeCommand',run:null}:null;}};
 try{const box=new Outbox(f.db,chain);box.enqueue('op',command);assert.equal((await box.process('op')).status,'Rejected');assert.equal(signed,1);assert.equal(broadcasts,1);
 f.db.close();const restarted=new Store(join(f.dir,'db.sqlite'));try{const box2=new Outbox(restarted,chain);assert.equal((await box2.process('op')).status,'Rejected');assert.equal(broadcasts,1);assert.throws(()=>box2.enqueue('op',{...command,actor:'buyer'}),/conflict/);}finally{restarted.close();}
 }finally{f.close();}
});
test('missing receipt keeps uncertainty and blocks later signing',async()=>{
 const f=setup();let signs=0;
 const chain:Chain={async sign(){signs++;return {hash:'tx',bytes:'bytes'};},async broadcast(){throw Error('offline');},async receipt(){return null;}};
 try{const box=new Outbox(f.db,chain);box.enqueue('one',command);box.enqueue('two',command);await Promise.all([box.process('one'),box.process('two')]);assert.equal(signs,1);assert.equal(f.db.operation('one')?.status,'Unknown');assert.equal(f.db.operation('two')?.signed,undefined);await box.process('one');assert.equal(signs,1);}finally{f.close();}
});
test('exclusive writer and bounded request storage',()=>{const f=setup();try{assert.throws(()=>new Store(join(f.dir,'db.sqlite')),/writer/);const box=new Outbox(f.db,{} as Chain);assert.throws(()=>box.enqueue('../bad',command));assert.throws(()=>box.enqueue('big',{...command,actor:'x'.repeat(40000)}),/large/);}finally{f.close();}});
test('confirmed failed transaction can be replaced under the SAME operation and command',async()=>{const f=setup();let signs=0;let done=false;const chain:Chain={async sign(id){assert.equal(id,'op');signs++;return {hash:'tx'+signs,bytes:'signed'+signs};},async broadcast(tx){if(tx.hash==='tx2')done=true;},async receipt(id){return done?{status:'Rejected',op_id:id,payload_hash:commandHash(command),result:'DeprecatedSmokeCommand',run:null}:null;},async transactionState(){return 'failed';}};try{const box=new Outbox(f.db,chain);box.enqueue('op',command);await box.process('op');assert.equal((await box.process('op')).status,'Rejected');assert.equal(f.db.operations().length,1);assert.equal(signs,2);}finally{f.close();}});
test('capacity preserves terminal headroom for admitted run',()=>{const f=setup();try{const box=new Outbox(f.db,{} as Chain);const admit:Command={actor:'buyer',action:{type:'admit',edition_id:'e',expected_version:'1',expected_fee:'2',loadout_ids:[],seed:'1'}};const row=box.enqueue('entry',admit);row.status='Applied';row.receipt={status:'Applied',op_id:'entry',payload_hash:commandHash(admit),result:'r',run:{id:'r'} as any};f.db.putOperation(row);for(let n=0;n<254;n++){const r=box.enqueue('f'+n,command);r.status='Rejected';f.db.putOperation(r);}assert.throws(()=>box.enqueue('overflow',command),/capacity/);assert.doesNotThrow(()=>box.enqueue('settle',{actor:'buyer',action:{type:'void',run_id:'r',reason:'failure',disposition:{town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:[]}}}));}finally{f.close();}});
test('malformed string fields reject before persisting and cannot jam later settlements',()=>{const f=setup();try{const box=new Outbox(f.db,{} as Chain);for(const command of [{actor:'maker',action:{type:'cancel_listing',listing_id:[65]}},{actor:[65],action:{type:'debit',amount:'1'}},{actor:'maker',action:{type:'list',item_ids:[[65]],unit_price:'1'}}])assert.throws(()=>box.enqueue('malformed',command as any),/string/i);assert.equal(f.db.operations().length,0);assert.doesNotThrow(()=>box.enqueue('valid',{actor:'maker',action:{type:'cancel_listing',listing_id:'listing-1'}}));}finally{f.close();}});

test('only v9 publication receives the larger command envelope and oversized commands never reserve capacity',()=>{const f=setup();try{const box=new Outbox(f.db,{} as Chain);const action={type:'publish' as const,terms:{title:'x'.repeat(40000),rules_version:9,modules:[],sockets:[],opens_at_ms:'0',closes_at_ms:'1',run_duration_ms:'60000',max_runs:1,no_reward:true,difficulty_tag:'standard',style_tag:'combat'},fee:'0',funding:[]};assert.equal(box.enqueue('v9',{actor:'maker',action}).status,'Pending');assert.throws(()=>box.enqueue('old',{actor:'maker',action:{...action,terms:{...action.terms,rules_version:8}}}),/32 KB/);assert.throws(()=>box.enqueue('too-big',{actor:'maker',action:{...action,terms:{...action.terms,title:'x'.repeat(131072)}}}),/128 KB/);assert.equal(f.db.operations().length,1);}finally{f.close();}});

for(const v9 of [false,true])test(`oversized ${v9?'v9 publication':'legacy'} signed transactions never broadcast on retry or restart`,async()=>{const f=setup();let broadcasts=0;const large=v9?262145:65537;const chain:Chain={sign:async()=>({hash:'oversized',nonce:'1',bytes:'x'.repeat(large)}),broadcast:async()=>{broadcasts++;},receipt:async()=>null};try{const cmd:Command=v9?{actor:'maker',action:{type:'publish',terms:{title:'Fixture',rules_version:9,modules:[],sockets:[],opens_at_ms:'0',closes_at_ms:'1',run_duration_ms:'60000',max_runs:1,no_reward:true,difficulty_tag:'standard',style_tag:'combat'},fee:'0',funding:[]}}:command;const box=new Outbox(f.db,chain);box.enqueue('oversized',cmd);await box.process('oversized');await box.process('oversized');assert.equal(broadcasts,0);f.db.close();const db=new Store(join(f.dir,'db.sqlite'));try{const restarted=new Outbox(db,chain);await restarted.process('oversized');assert.equal(broadcasts,0);const row=db.operation('oversized')!;row.signed={hash:'old-oversized',nonce:'1',bytes:'x'.repeat(large)};row.signedAt=Date.now();db.putOperation(row);await restarted.process('oversized');assert.equal(broadcasts,0,'previously stored oversized bytes must also be blocked');}finally{db.close();}}finally{f.close();}});

// Receipt window mirror (docs/systems/CAPACITY.md): capacity is bounded by recent and unresolved work, never lifetime totals.
test('resolved operations leave the capacity window after the minimum retention; unresolved ones never do',()=>{const f=setup();let now=1_000_000;try{
 const box=new Outbox(f.db,{} as Chain,undefined,{now:()=>now});
 const stuck=box.enqueue('stuck',command);stuck.status='Unknown';f.db.putOperation(stuck);
 for(let n=0;n<255;n++){const r=box.enqueue('old'+n,command);r.status='Rejected';f.db.putOperation(r);}
 assert.throws(()=>box.enqueue('full',command),/capacity/);
 now+=REPLAY_MIN_AGE_MS-1;assert.throws(()=>box.enqueue('still-full',command),/capacity/,'nothing is forgotten before the minimum age');
 now+=2;for(let n=0;n<255;n++){const r=box.enqueue('new'+n,command);r.status='Rejected';f.db.putOperation(r);}
 assert.throws(()=>box.enqueue('full-again',command),/capacity/,'the unresolved operation still occupies its slot');
 assert.equal(f.db.operations().length,511,'far past the old lifetime cap of 256');
 // Rows written before createdAt existed were resolved under the old contract and are not counted.
 const legacy=f.db.operation('new0')!;delete legacy.createdAt;f.db.putOperation(legacy);assert.doesNotThrow(()=>box.enqueue('legacy-slot',command));
}finally{f.close();}});
test('a replacement signature is never made after the replay-safe signing cutoff',async()=>{const f=setup();let now=5_000_000,signs=0,state:'failed'|'unknown'='unknown';try{
 const chain:Chain={async sign(){signs++;return {hash:'tx'+signs,nonce:String(signs),bytes:'signed'+signs};},async broadcast(){throw Error('offline');},async receipt(){return null;},async transactionState(){return state;}};
 const box=new Outbox(f.db,chain,undefined,{now:()=>now});box.enqueue('op',command);
 // A never-signed operation cannot have executed: its first signature may come long after creation.
 now+=RESIGN_CUTOFF_MS*2;assert.equal((await box.process('op')).status,'Unknown');assert.equal(signs,1);assert.equal(f.db.operation('op')?.firstSignedAt,now);
 // Within the cutoff a failed transaction may be replaced under the same op id.
 state='failed';now+=60_000;await box.process('op');assert.equal(signs,2);
 // Past the cutoff the existing signature may still be rebroadcast, but no new signature is made.
 now+=RESIGN_CUTOFF_MS;const row=await box.process('op');assert.equal(signs,2);assert.equal(row.status,'Unknown');assert.match(row.reason??'',/replay-safe signing window/);
 // A legacy row is dated on first sight, then follows the same rule.
 const legacy=box.enqueue('legacy',{...command,actor:'buyer'});delete (legacy as any).createdAt;f.db.putOperation(legacy);
 await box.process('legacy');assert.equal(f.db.operation('legacy')?.createdAt,now);
}finally{f.close();}});
test('a tombstone receipt without its run copy still resolves the operation exactly once',async()=>{const f=setup();try{
 const admit:Command={actor:'buyer',action:{type:'admit',edition_id:'e',expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'1'}};let signs=0;
 const chain:Chain={async sign(){signs++;return {hash:'t',bytes:'b'};},async broadcast(){},async receipt(id){return {status:'Applied',op_id:id,payload_hash:commandHash(admit),result:'run-7',run:null};}};
 const box=new Outbox(f.db,chain);box.enqueue('entry',admit);const row=await box.process('entry');
 assert.equal(row.status,'Applied');assert.equal(row.receipt?.status==='Applied'&&row.receipt.result,'run-7');assert.equal(signs,0,'a remembered operation is never signed again');
}finally{f.close();}});
