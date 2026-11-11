import test from 'node:test';import assert from 'node:assert/strict';
import {extendedFixture,commitment} from './extended-fixture';
const coins=(s:any)=>Object.values(s.credits).reduce((n:bigint,v:any)=>n+BigInt(v),0n)+BigInt(s.bank)+s.runs.filter((r:any)=>r.status==='active').reduce((n:bigint,r:any)=>n+BigInt(r.fee),0n)+(s.commissions??[]).reduce((n:bigint,c:any)=>n+BigInt(c.escrow),0n);
test('commissions escrow coins, pay fillers per good, refund on cancel; small craft batches make one tonic',{timeout:150000},async()=>{
 const f=await extendedFixture();try{
 const start=await f.view();assert.equal(start.commissions,undefined);
 // p2 commissions 3 herbs at 2 each: 6 coins leave the purse into escrow.
 const post={actor:'p2',action:{type:'post_commission' as const,item_type:'herb' as const,unit_price:'2',quantity:3}};
 assert.equal((await f.apply('post',post)).result,'commission-0');let s=await f.view();
 assert.equal(s.credits.p2,'4');assert.deepEqual(s.commissions.map((c:any)=>[c.id,c.buyer,c.escrow,c.status]),[['commission-0','p2','6','open']]);assert.equal(coins(s),coins(start));
 for(const [n,a] of [[ 'self',{actor:'p2',action:{type:'fill_commission',commission_id:'commission-0',item_ids:['p2-club'],expected_unit_price:'2'}}],['type',{actor:'maker',action:{type:'fill_commission',commission_id:'commission-0',item_ids:['maker-flask-0'],expected_unit_price:'2'}}],['price',{actor:'maker',action:{type:'fill_commission',commission_id:'commission-0',item_ids:['maker-herb-0'],expected_unit_price:'3'}}],['too-many',{actor:'maker',action:{type:'fill_commission',commission_id:'commission-0',item_ids:['maker-herb-0','maker-herb-1','maker-herb-2','maker-herb-3'],expected_unit_price:'2'}}],['rich',{actor:'buyer',action:{type:'post_commission',item_type:'tonic',unit_price:'5',quantity:3}}]] as [string,any][]){
  const before=await f.view();assert.equal((await f.apply('bad-'+n,a)).status,'Rejected',n);assert.deepEqual(await f.view(),before);
 }
 // The maker delivers two herbs, is paid 4 from escrow, and the herbs now belong to p2.
 assert.equal((await f.apply('fill',{actor:'maker',action:{type:'fill_commission',commission_id:'commission-0',item_ids:['maker-herb-0','maker-herb-1'],expected_unit_price:'2'}})).status,'Applied');
 s=await f.view();assert.equal(s.credits.maker,String(BigInt(start.credits.maker)+4n));assert.equal(s.items.find((i:any)=>i.id==='maker-herb-0').location.profile,'p2');
 assert.deepEqual(s.commissions.map((c:any)=>[c.filled,c.escrow,c.status]),[[2,'2','open']]);assert.equal(coins(s),coins(start));
 assert.equal((await f.apply('not-mine',{actor:'maker',action:{type:'cancel_commission',commission_id:'commission-0'}})).result,'WrongBuyer');
 assert.equal((await f.apply('cancel',{actor:'p2',action:{type:'cancel_commission',commission_id:'commission-0'}})).status,'Applied');
 s=await f.view();assert.equal(s.credits.p2,'6');assert.deepEqual(s.commissions.map((c:any)=>[c.escrow,c.status]),[['0','cancelled']]);assert.equal(coins(s),coins(start));
 assert.equal((await f.apply('late-fill',{actor:'maker',action:{type:'fill_commission',commission_id:'commission-0',item_ids:['maker-herb-2'],expected_unit_price:'2'}})).result,'CommissionClosed');
 // Small batch: one herb + one flask -> one tonic.
 const deadline=String(BigInt(await f.view('clock_ms'))+600000n);
 assert.equal((await f.apply('small',{actor:'maker',action:{type:'begin_craft',batch_id:'small',input_ids:['maker-herb-2','maker-flask-2'],challenge_commitment:commitment,deadline_ms:deadline}})).status,'Applied');
 assert.equal((await f.apply('small-done',{actor:'maker',action:{type:'finish_craft',batch_id:'small',tier:'normal',reason:'completed'}})).status,'Applied');
 s=await f.view();assert.deepEqual(s.batches.find((b:any)=>b.id==='small').output_ids,['crafted-small-0']);
 assert.equal((await f.apply('small-uneven',{actor:'maker',action:{type:'begin_craft',batch_id:'uneven',input_ids:['maker-herb-3','maker-herb-4'],challenge_commitment:commitment,deadline_ms:deadline}})).result,'InvalidRecipe');
 }finally{await f.close();}
});
