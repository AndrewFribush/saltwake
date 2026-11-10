import test from 'node:test';
import assert from 'node:assert/strict';
import {extendedFixture,inputs,commitment} from './extended-fixture';
import type {Command} from '../../packages/shared/src/types';
const begin=(id:string,deadline:string,ids=inputs('maker'),actor='maker'):Command=>({actor,action:{type:'begin_craft',batch_id:id,input_ids:ids,challenge_commitment:commitment,deadline_ms:deadline}});
const finish=(id:string,tier:'normal'|'fine'='fine',reason:'completed'|'expired'='completed',actor='maker'):Command=>({actor,action:{type:'finish_craft',batch_id:id,tier,reason}});
test('recipe locks exactly two herbs/two flasks, excludes listed inputs, and issues two outputs once',{timeout:120000},async()=>{
 const f=await extendedFixture();try{
 await assert.rejects(()=>f.call('init_demo_extended'));const s=await f.view();assert.equal(s.items.length,51);assert.equal(s.recovery.budget,'6');
 const deadline=String(BigInt(await f.view('clock_ms'))+600000n);
 for(const [i,c] of [begin('',deadline),begin('x','0'),begin('x','18446744073709551615'),begin('x',deadline,inputs('maker').slice(1)),begin('x',deadline,['maker-herb-0','maker-herb-0','maker-flask-0','maker-flask-1']),begin('x',deadline,['maker-herb-0','maker-herb-1','maker-herb-2','maker-flask-0']),begin('x',deadline,['maker-herb-0','maker-herb-1','maker-flask-0','maker-tonic-0']),begin('x',deadline,inputs('bank')),begin('x',deadline,inputs('maker'),'buyer')].entries()){
  assert.equal((await f.apply(`bad-${i}`,c)).status,'Rejected');assert.deepEqual(await f.view(),s);
 }
 await f.apply('list',{actor:'maker',action:{type:'list',item_ids:['maker-herb-0'],unit_price:'1'}});const listed=await f.view();assert.equal((await f.apply('listed',begin('x',deadline))).result,'UnownedInput');assert.deepEqual(await f.view(),listed);
 await f.apply('cancel',{actor:'maker',action:{type:'cancel_listing',listing_id:'listing-0'}});
 const holdings=await f.view('holdings',{profile:'maker'});const command=begin('batch',deadline);const started=await f.apply('begin',command);assert.equal(started.status,'Applied');assert.deepEqual(await f.apply('begin',command),started);
 const locked=await f.view();assert.equal(await f.view('holdings',{profile:'maker'}),holdings);assert.equal(locked.batches[0].challenge_commitment,commitment);
 for(const id of inputs('maker'))assert.deepEqual(locked.items.find((i:any)=>i.id===id).location,{kind:'crafting',batch:'batch',source_owner:'maker'});
 for(const [i,c] of [begin('second',deadline,inputs('maker',2)),finish('batch','fine','completed','buyer'),finish('batch','normal','expired'),{actor:'maker',action:{type:'finish_recovery',batch_id:'batch',tier:'fine',reason:'completed'}},{actor:'maker',action:{type:'list',item_ids:['maker-herb-0'],unit_price:'1'}},{actor:'maker',action:{type:'bank_sell',item_ids:['maker-herb-0'],expected_unit_prices:['1']}}].entries()){
  assert.equal((await f.apply(`locked-${i}`,c as Command)).status,'Rejected');assert.deepEqual(await f.view(),locked);
 }
 const end=finish('batch');const receipt=await f.apply('finish',end);assert.equal(receipt.status,'Applied');assert.deepEqual(await f.apply('finish',end),receipt);
 const final=await f.view();assert.equal(final.items.length,53);assert.deepEqual(final.batches[0].output_ids,['crafted-batch-0','crafted-batch-1']);assert.equal(final.batches[0].tier,'fine');
 for(const id of inputs('maker'))assert.deepEqual(final.items.find((i:any)=>i.id===id).location,{kind:'consumed',operation:'finish'});
 for(const id of final.batches[0].output_ids){const item=final.items.find((i:any)=>i.id===id);assert.equal(item.item_type,'fineTonic');assert.deepEqual(item.location,{kind:'owned',profile:'maker'});}
 assert.equal((await f.apply('twice',end)).result,'TerminalBatch');assert.equal((await f.apply('reuse-id',begin('batch',deadline,inputs('maker',2)))).result,'BatchExists');assert.deepEqual(await f.view(),final);
 // Outputs are ordinary owned, listable finite stock.
 assert.equal((await f.apply('sell-output',{actor:'maker',action:{type:'list',item_ids:final.batches[0].output_ids,unit_price:'4'}})).status,'Applied');
 await f.apply('normal-begin',begin('normal',deadline,inputs('maker',2)));await f.apply('normal-end',finish('normal','normal'));assert.equal((await f.view()).items.find((i:any)=>i.id==='crafted-normal-0').item_type,'tonic');
 }finally{await f.close();}
});
test('deadline is stored; late completion forces normal tier and timeout cannot mint twice',{timeout:120000},async()=>{
 const f=await extendedFixture();try{
 const deadline=String(BigInt(await f.view('clock_ms'))+60000n);await f.apply('begin',begin('late',deadline));await f.advance(deadline);
 assert.equal((await f.apply('late-fine',finish('late','fine','completed'))).status,'Applied');const s=await f.view();assert.equal(s.batches[0].tier,'normal');assert.equal(s.batches[0].reason,'expired');assert.equal(s.items.find((i:any)=>i.id==='crafted-late-0').item_type,'tonic');assert.equal((await f.apply('timeout-again',finish('late','normal','expired'))).result,'TerminalBatch');assert.deepEqual(await f.view(),s);
 const next=String(BigInt(await f.view('clock_ms'))+60000n);await f.apply('begin-timeout',begin('timeout',next,inputs('maker',2)));await f.advance(next);assert.equal((await f.apply('timeout',finish('timeout','fine','expired'))).status,'Applied');assert.equal((await f.view()).batches.find((b:any)=>b.id==='timeout').tier,'normal');
 }finally{await f.close();}
});
test('receipt exhaustion preserves terminal capacity for a locked crafting batch',{timeout:360000},async()=>{
 const f=await extendedFixture();try{
 const deadline=String(BigInt(await f.view('clock_ms'))+900000n);assert.equal((await f.apply('begin',begin('capacity',deadline))).status,'Applied');
 for(let i=0;i<254;i++){const r=await f.call('execute',{op_id:`fill-${i}`,command:{actor:'missing',action:{type:'debit',amount:'0'}}});assert.equal(r.result,'UnknownProfile');}
 await assert.rejects(()=>f.call('execute',{op_id:'overflow',command:{actor:'missing',action:{type:'debit',amount:'0'}}}));
 const r=await f.apply('finish',finish('capacity'));assert.equal(r.status,'Applied');assert.deepEqual(await f.apply('finish',finish('capacity')),r);assert.equal((await f.view()).batches[0].status,'finished');
 }finally{await f.close();}
});
