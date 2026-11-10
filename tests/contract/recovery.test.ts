import test from 'node:test';
import assert from 'node:assert/strict';
import {extendedFixture,inputs,commitment} from './extended-fixture';
import {terms} from './helpers';
import type {Command} from '../../packages/shared/src/types';
const begin=(id:string,deadline:string,n=0,actor='worker'):Command=>({actor,action:{type:'begin_recovery',batch_id:id,bank_input_ids:inputs('bank',n),challenge_commitment:commitment,deadline_ms:deadline}});
const finish=(id:string,actor='worker',reason:'completed'|'expired'='completed'):Command=>({actor,action:{type:'finish_recovery',batch_id:id,tier:'fine',reason}});
test('recovery reserves finite bank materials and wages, pays once, and keeps output at bank; epoch cap and budget never reset',{timeout:120000},async()=>{
 const f=await extendedFixture();try{
 const deadline=String(BigInt(await f.view('clock_ms'))+600000n);const initial=await f.view();assert.deepEqual(initial.recovery,{epoch:'demo-1',budget:'6',wage:'2',max_jobs_per_profile:3,jobs:{}});
 assert.equal((await f.apply('rich',begin('rich',deadline,0,'buyer'))).result,'RecoveryHoldings');assert.deepEqual(await f.view(),initial);
 const first=await f.apply('begin-0',begin('job-0',deadline));assert.equal(first.status,'Applied');assert.deepEqual(await f.apply('begin-0',begin('job-0',deadline)),first);
 const locked=await f.view();assert.equal(locked.credits.worker,'0');assert.equal(locked.recovery.budget,'4');assert.equal(locked.batches[0].wage_reserved,'2');assert.equal(await f.view('holdings',{profile:'worker'}),'2');
 for(const id of inputs('bank'))assert.deepEqual(locked.items.find((i:any)=>i.id===id).location,{kind:'crafting',batch:'job-0',source_owner:'bank'});
 for(const [i,c] of [begin('parallel',deadline,2),begin('steal',deadline,0,'worker2'),finish('job-0','worker2'),finish('job-0','worker','expired'),{actor:'worker',action:{type:'finish_craft',batch_id:'job-0',tier:'fine',reason:'completed'}}].entries()){
 assert.equal((await f.apply(`bad-${i}`,c as Command)).status,'Rejected');assert.deepEqual(await f.view(),locked);}
 const paid=await f.apply('finish-0',finish('job-0'));assert.equal(paid.status,'Applied');assert.deepEqual(await f.apply('finish-0',finish('job-0')),paid);
 let s=await f.view();assert.equal(s.credits.worker,'2');assert.equal(s.batches[0].wage_reserved,'0');for(const id of s.batches[0].output_ids)assert.equal(s.items.find((i:any)=>i.id===id).location.kind,'bank');
 assert.equal((await f.apply('double-wage',finish('job-0'))).result,'TerminalBatch');assert.deepEqual(await f.view(),s);
 for(let i=1;i<3;i++){assert.equal((await f.apply(`begin-${i}`,begin(`job-${i}`,deadline,i*2))).status,'Applied');assert.equal((await f.apply(`finish-${i}`,finish(`job-${i}`))).status,'Applied');}
 s=await f.view();assert.equal(s.credits.worker,'6');assert.equal(s.recovery.jobs.worker,3);assert.equal(s.recovery.budget,'0');
 assert.equal((await f.apply('cap',begin('fourth',deadline,6))).result,'RecoveryJobCap');assert.equal((await f.apply('budget',begin('other',deadline,6,'worker2'))).result,'RecoveryBudget');assert.deepEqual(await f.view(),s);
 }finally{await f.close();}
});
test('competing jobs cannot reserve the same bank materials; timeout still pays the reserved wage once',{timeout:120000},async()=>{
 const f=await extendedFixture();try{
 const deadline=String(BigInt(await f.view('clock_ms'))+60000n);
 const results=await Promise.all([f.apply('worker',begin('a',deadline)),f.apply('worker2',begin('b',deadline,0,'worker2'))]);assert.deepEqual(results.map(r=>r.status).sort(),['Applied','Rejected']);
 let s=await f.view();assert.equal(s.recovery.budget,'4');assert.equal(s.batches.length,1);const batch=s.batches[0];await f.advance(deadline);
 const c=finish(batch.id,batch.actor,'expired');const r=await f.apply('timeout',c);assert.equal(r.status,'Applied');assert.deepEqual(await f.apply('timeout',c),r);s=await f.view();assert.equal(s.credits[batch.actor],'2');assert.equal(s.batches[0].tier,'normal');for(const id of s.batches[0].output_ids){const item=s.items.find((i:any)=>i.id===id);assert.equal(item.item_type,'tonic');assert.equal(item.location.kind,'bank');}
 }finally{await f.close();}
});
test('holdings include listed assets, town loadouts, crafting inputs, and pending maker fees',{timeout:180000},async()=>{
 const f=await extendedFixture();try{
 const deadline=String(BigInt(await f.view('clock_ms'))+600000n);
 await f.apply('job',begin('wage',deadline));await f.apply('wage',finish('wage'));
 // Give the zero-asset worker an 8-reference-value tonic for one earned credit.
 await f.apply('list',{actor:'maker',action:{type:'list',item_ids:['maker-fine-tonic-0'],unit_price:'1'}});
 await f.apply('buy',{actor:'worker',action:{type:'buy',listing_id:'listing-0',item_ids:['maker-fine-tonic-0'],expected_unit_price:'1'}});
 assert.equal(await f.view('holdings',{profile:'worker'}),'9');
 await f.apply('worker-list',{actor:'worker',action:{type:'list',item_ids:['maker-fine-tonic-0'],unit_price:'1'}});assert.equal(await f.view('holdings',{profile:'worker'}),'9');
 let s=await f.view();assert.equal((await f.apply('listed-wealth',begin('listed',deadline,2))).result,'RecoveryHoldings');assert.deepEqual(await f.view(),s);
 await f.apply('cancel',{actor:'worker',action:{type:'cancel_listing',listing_id:'listing-1'}});
 const t={...terms(Number(await f.view('clock_ms'))),sockets:[],no_reward:true,closes_at_ms:deadline};
 await f.apply('publish',{actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:[]}});
 await f.apply('admit',{actor:'worker',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'0',loadout_ids:['maker-fine-tonic-0'],seed:'0'}});assert.equal(await f.view('holdings',{profile:'worker'}),'9');s=await f.view();assert.equal((await f.apply('loadout-wealth',begin('loadout',deadline,2))).result,'RecoveryHoldings');assert.deepEqual(await f.view(),s);
 const makerHoldings=await f.view('holdings',{profile:'maker'});await f.apply('craft',{actor:'maker',action:{type:'begin_craft',batch_id:'craft',input_ids:inputs('maker'),challenge_commitment:commitment,deadline_ms:deadline}});assert.equal(await f.view('holdings',{profile:'maker'}),makerHoldings);
 // A second zero-asset worker spends a wage on publication, then has pending maker fees.
 await f.apply('job2',begin('wage2',deadline,2,'worker2'));await f.apply('wage2',finish('wage2','worker2'));
 await f.apply('worker-publish',{actor:'worker2',action:{type:'publish',terms:t,fee:'6',funding:[]}});assert.equal(await f.view('holdings',{profile:'worker2'}),'0');
 await f.apply('paid-entry',{actor:'buyer',action:{type:'admit',edition_id:'edition-1',expected_version:'1',expected_fee:'6',loadout_ids:[],seed:'0'}});assert.equal(await f.view('holdings',{profile:'worker2'}),'6');s=await f.view();assert.equal((await f.apply('pending-income',begin('pending',deadline,4,'worker2'))).result,'RecoveryHoldings');assert.deepEqual(await f.view(),s);
 }finally{await f.close();}
});
