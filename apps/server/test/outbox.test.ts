import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/db';
import {Outbox,type Chain} from '../src/outbox';
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
