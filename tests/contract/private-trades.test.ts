import test from 'node:test';import assert from 'node:assert/strict';import {fixture} from './helpers';
const total=(s:any)=>Object.values(s.credits).reduce((n:bigint,v:any)=>n+BigInt(v),0n)+BigInt(s.bank);
test('private offers: only the reserved buyer may buy; cancel returns goods; rejections leave no reservation',{timeout:150000},async()=>{
 const f=await fixture();try{
 const start=await f.view('snapshot');assert.equal(start.reservations,undefined,'empty reservations are omitted');
 const offer={actor:'maker',action:{type:'list_for',item_ids:['maker-tonic-0','maker-tonic-1'],unit_price:'3',buyer:'buyer'}};
 const r=await f.apply('offer',offer);assert.equal(r.result,'listing-0');assert.deepEqual(await f.apply('offer',offer),r,'replay is idempotent');
 let s=await f.view('snapshot');assert.deepEqual(s.reservations,{'listing-0':'buyer'});
 const before=await f.view('snapshot');
 assert.equal((await f.apply('steal',{actor:'p2',action:{type:'buy',listing_id:'listing-0',item_ids:['maker-tonic-0'],expected_unit_price:'3'}})).result,'ReservedForAnotherBuyer');
 const afterSteal=await f.view('snapshot');assert.deepEqual(afterSteal.items,before.items);assert.deepEqual(afterSteal.credits,before.credits);
 assert.equal((await f.apply('take',{actor:'buyer',action:{type:'buy',listing_id:'listing-0',item_ids:['maker-tonic-0'],expected_unit_price:'3'}})).status,'Applied');
 s=await f.view('snapshot');assert.equal(s.items.find((i:any)=>i.id==='maker-tonic-0').location.profile,'buyer');assert.equal(s.credits.buyer,'7');
 assert.equal((await f.apply('cancel',{actor:'maker',action:{type:'cancel_listing',listing_id:'listing-0'}})).status,'Applied');
 s=await f.view('snapshot');assert.equal(s.items.find((i:any)=>i.id==='maker-tonic-1').location.profile,'maker');assert.equal(s.reservations,undefined,'closed listings drop out of the view');
 // Invalid offers are rejected and reserve nothing: the next public listing (same id slot) stays open to anyone.
 assert.equal((await f.apply('unknown',{actor:'maker',action:{type:'list_for',item_ids:['maker-tonic-2'],unit_price:'3',buyer:'nobody'}})).result,'UnknownBuyer');
 assert.equal((await f.apply('self',{actor:'maker',action:{type:'list_for',item_ids:['maker-tonic-2'],unit_price:'3',buyer:'maker'}})).result,'SelfPurchase');
 assert.equal((await f.apply('badprice',{actor:'maker',action:{type:'list_for',item_ids:['maker-tonic-2'],unit_price:'0',buyer:'p2'}})).result,'InvalidPrice');
 assert.equal((await f.apply('public',{actor:'maker',action:{type:'list',item_ids:['maker-tonic-2'],unit_price:'3'}})).result,'listing-1');
 assert.equal((await f.apply('anyone',{actor:'p3',action:{type:'buy',listing_id:'listing-1',item_ids:['maker-tonic-2'],expected_unit_price:'3'}})).status,'Applied');
 const end=await f.view('snapshot');assert.equal(total(end),total(start));assert.deepEqual(end.items.map((i:any)=>i.id).sort(),start.items.map((i:any)=>i.id).sort());
 }finally{await f.sandbox.tearDown();}
});
