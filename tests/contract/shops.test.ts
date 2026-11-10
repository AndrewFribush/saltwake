import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import type {Command} from '../../packages/shared/src/types';
const list=(ids: string[],price='3'):Command=>({actor:'maker',action:{type:'list',item_ids:ids,unit_price:price}});
const buy=(actor:string,ids:string[],price='3',listing='listing-0'):Command=>({actor,action:{type:'buy',listing_id:listing,item_ids:ids,expected_unit_price:price}});
test('listing locks exact IDs, validates quotes atomically, and cancellation returns only unsold stock',{timeout:120000},async()=>{
 const f=await fixture();try{
 const before=await f.view('snapshot');
 for(const [i,c] of [list([]),list(['maker-tonic-0','maker-tonic-0']),list(['maker-tonic-0','buyer-club']),list(['maker-tonic-0'],'0'),list(['maker-tonic-0'],'18446744073709551615')].entries()){
  assert.equal((await f.apply(`bad-list-${i}`,c)).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);
 }
 const command=list(['maker-tonic-0','maker-tonic-1']);
 assert.deepEqual(await f.view('roundtrip_command',{command}),command);
 const listed=await f.apply('list',command);assert.equal(listed.result,'listing-0');assert.deepEqual(await f.apply('list',command),listed);
 const locked=await f.view('snapshot');assert.equal(locked.listings[0].status,'active');assert.equal(locked.listings[0].unit_price,'3');
 for(const id of ['maker-tonic-0','maker-tonic-1'])assert.deepEqual(locked.items.find((i:any)=>i.id===id).location,{kind:'listed',listing:'listing-0'});
 for(const [i,c] of [buy('buyer',['maker-tonic-0'],'2'),buy('buyer',['maker-tonic-0','maker-tonic-0']),buy('buyer',['maker-tonic-0','maker-tonic-2']),buy('maker',['maker-tonic-0']),list(['maker-tonic-0']),{actor:'buyer',action:{type:'cancel_listing',listing_id:'listing-0'}}].entries()){
  assert.equal((await f.apply(`bad-buy-${i}`,c)).status,'Rejected');assert.deepEqual(await f.view('snapshot'),locked);
 }
 // A listed item cannot fund a new edition.
 const t=terms(Number(await f.view('clock_ms')));
 assert.equal((await f.apply('fund-listed',{actor:'maker',action:{type:'publish',terms:{...t,sockets:[t.sockets[1]]},fee:'0',funding:['maker-tonic-0']}})).result,'UnownedFunding');
 assert.equal((await f.apply('buy',buy('buyer',['maker-tonic-0']))).status,'Applied');
 const cancel:Command={actor:'maker',action:{type:'cancel_listing',listing_id:'listing-0'}};
 assert.equal((await f.apply('cancel',cancel)).status,'Applied');const final=await f.view('snapshot');
 assert.equal(final.credits.buyer,'7');assert.equal(final.credits.maker,'103');assert.deepEqual(final.listings[0].remaining_ids,[]);assert.equal(final.listings[0].status,'cancelled');
 assert.deepEqual(final.items.find((i:any)=>i.id==='maker-tonic-0').location,{kind:'owned',profile:'buyer'});assert.deepEqual(final.items.find((i:any)=>i.id==='maker-tonic-1').location,{kind:'owned',profile:'maker'});
 assert.equal((await f.apply('cancel-again',cancel)).result,'ListingClosed');assert.equal((await f.apply('buy-cancelled',buy('p2',['maker-tonic-1']))).result,'ListingClosed');assert.deepEqual(await f.view('snapshot'),final);
 const relist=await f.apply('relist',list(['maker-tonic-1']));assert.equal(relist.result,'listing-1');
 }finally{await f.sandbox.tearDown();}
});
test('last-item concurrent buys yield one charged sale; listed gear cannot enter a loadout',{timeout:120000},async()=>{
 const f=await fixture();try{
 await f.apply('list',list(['maker-tonic-0']));
 const results=await Promise.all([f.apply('buyer',buy('buyer',['maker-tonic-0'])),f.apply('p2',buy('p2',['maker-tonic-0']))]);
 assert.deepEqual(results.map(r=>r.status).sort(),['Applied','Rejected']);const s=await f.view('snapshot');
 const winner=s.items.find((i:any)=>i.id==='maker-tonic-0').location.profile;assert.equal(s.credits[winner],'7');assert.equal(s.credits[winner==='buyer'?'p2':'buyer'],'10');assert.equal(s.credits.maker,'103');assert.equal(s.listings[0].status,'sold');
 const win=results.find(r=>r.status==='Applied');assert.deepEqual(await f.apply(win.op_id,buy(winner,['maker-tonic-0'])),win);
 assert.equal((await f.apply('cancel-sold',{actor:'maker',action:{type:'cancel_listing',listing_id:'listing-0'}})).result,'ListingClosed');
 const t=terms(Number(await f.view('clock_ms')));await f.apply('publish',{actor:'maker',action:{type:'publish',terms:{...t,sockets:[],no_reward:true},fee:'0',funding:[]}});
 await f.apply('gear',{actor:'buyer',action:{type:'list',item_ids:['buyer-club'],unit_price:'4'}});
 const before=await f.view('snapshot');assert.equal((await f.apply('equip',{actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'0',loadout_ids:['buyer-club'],seed:'1'}})).result,'UnownedLoadout');assert.deepEqual(await f.view('snapshot'),before);
 await f.apply('expensive',list(['maker-sword-0'],'11'));const noCash=await f.view('snapshot');assert.equal((await f.apply('cannot-afford',buy('p5',['maker-sword-0'],'11','listing-2'))).result,'InsufficientCredits');assert.deepEqual(await f.view('snapshot'),noCash);
 }finally{await f.sandbox.tearDown();}
});
