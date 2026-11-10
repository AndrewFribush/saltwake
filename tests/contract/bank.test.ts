import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import type {Command} from '../../packages/shared/src/types';
const trade=(actor:string,type:'bank_buy'|'bank_sell',ids:string[],prices:string[]):Command=>({actor,action:{type,item_ids:ids,expected_unit_prices:prices}});
test('bank trades exact finite inventory at reference/half-reference prices, never unlimited cash',{timeout:120000},async()=>{
 const f=await fixture();try{
 const original=await f.view('snapshot');assert.equal(original.bank,'0');assert.equal(original.items.length,14);
 assert.deepEqual(original.bank_prices.map((p:any)=>[p.sale_price,p.buyback_price]),[['4','2'],['12','6'],['8','4'],['2','1'],['2','1'],['2','1'],['6','3'],['8','4']]);
 assert.equal((await f.apply('unfunded',trade('buyer','bank_sell',['buyer-club'],['2']))).result,'InsufficientBankCredits');assert.deepEqual(await f.view('snapshot'),original);
 const t=terms(Number(await f.view('clock_ms')));await f.apply('publish',{actor:'maker',action:{type:'publish',terms:{...t,sockets:[],no_reward:true},fee:'0',funding:[]}});
 const sell=trade('buyer','bank_sell',['buyer-club'],['2']);assert.deepEqual(await f.view('roundtrip_command',{command:sell}),sell);
 assert.equal((await f.apply('sell',sell)).status,'Applied');let s=await f.view('snapshot');assert.equal(s.bank,'0');assert.equal(s.credits.buyer,'12');assert.equal(s.items.find((i:any)=>i.id==='buyer-club').location.kind,'bank');
 const before=s;
 for(const [i,c] of [trade('p2','bank_buy',['buyer-club'],['2']),trade('p2','bank_buy',['buyer-club'],[]),trade('p2','bank_buy',['buyer-club','buyer-club'],['4','4']),trade('p2','bank_buy',['buyer-club','p2-club'],['4','4']),trade('p2','bank_sell',['p2-club'],['2']),trade('p2','bank_buy',[],[])].entries()){
 assert.equal((await f.apply(`bad-${i}`,c)).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);}
 const buy=trade('p2','bank_buy',['buyer-club'],['4']);const bought=await f.apply('buy',buy);assert.equal(bought.status,'Applied');assert.deepEqual(await f.apply('buy',buy),bought);
 s=await f.view('snapshot');assert.equal(s.bank,'4');assert.equal(s.credits.p2,'6');assert.deepEqual(s.items.find((i:any)=>i.id==='buyer-club').location,{kind:'owned',profile:'p2'});
 assert.equal((await f.apply('sold-out',trade('p3','bank_buy',['buyer-club'],['4']))).result,'ItemUnavailable');
 assert.equal((await f.apply('sell-back',trade('p2','bank_sell',['buyer-club','p2-club'],['2','2']))).status,'Applied');s=await f.view('snapshot');assert.equal(s.bank,'0');assert.equal(s.credits.p2,'10');
 assert.equal((await f.apply('cash-limit',trade('p3','bank_sell',['p3-club'],['2']))).result,'InsufficientBankCredits');assert.deepEqual(await f.view('snapshot'),s);
 }finally{await f.sandbox.tearDown();}
});
test('forfeited gear is finite resellable bank stock; racing buyers cannot share an instance',{timeout:120000},async()=>{
 const f=await fixture();try{
 const t=terms(Number(await f.view('clock_ms')));await f.apply('publish',{actor:'maker',action:{type:'publish',terms:{...t,sockets:[],no_reward:true},fee:'0',funding:[]}});
 const r=await f.apply('admit',{actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'0',loadout_ids:['buyer-club'],seed:'1'}});
 await f.apply('died',{actor:'buyer',action:{type:'settle',run_id:r.result,outcome:'died',disposition:{town_consumed:[],town_returned:[],town_forfeited:['buyer-club'],dungeon_consumed:[],dungeon_returned:[],dungeon_extracted:[]},carried_dungeon_ids:[]}});
 const results=await Promise.all([f.apply('buy-p2',trade('p2','bank_buy',['buyer-club'],['4'])),f.apply('buy-p3',trade('p3','bank_buy',['buyer-club'],['4']))]);assert.deepEqual(results.map(r=>r.status).sort(),['Applied','Rejected']);
 const s=await f.view('snapshot');assert.equal(s.bank,'6');assert.deepEqual([s.credits.p2,s.credits.p3].sort(),['10','6']);assert.ok(['p2','p3'].includes(s.items.find((i:any)=>i.id==='buyer-club').location.profile));
 }finally{await f.sandbox.tearDown();}
});
