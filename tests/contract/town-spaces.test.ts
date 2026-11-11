import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';import {defaultInterior,type InteriorLayout} from '../../packages/game/src/interiors';import {landRules} from '../../packages/shared/src/land';
const room=(edit:(r:InteriorLayout)=>void=()=>{})=>{const r=defaultInterior('market');edit(r);return JSON.stringify(r);};
const hall=(edition:string)=>room(r=>{r.kind='dungeon';r.edition=edition;r.fixtures.push({id:'portal',name:'Stairway down',glyph:'▼',x:5,y:4});});
const shop=(x:number,y:number,district='center',interior=room())=>({type:'create_shop' as const,title:'Plot',district,x,y,interior,open:true});
test('land-v1: plot limit, dungeon entrances bound to own open editions, notices, demolition',{timeout:150000},async()=>{
 const f=await fixture();try{
 const rules=await f.view('land_rules');assert.equal(rules.version,landRules.version);assert.equal(rules.max_plots_per_owner,landRules.maxPlotsPerOwner);assert.equal(rules.max_buildings,landRules.maxBuildings);assert.deepEqual(rules.kinds,[...landRules.kinds]);
 const t={...terms(Date.now()),sockets:[],no_reward:true};
 assert.equal((await f.apply('pub',{actor:'maker',action:{type:'publish',terms:t,fee:'3',funding:[]}})).result,'edition-0');
 // Dungeon entrance: only the edition's maker may link it; portal fixture only on dungeon entrances.
 assert.equal((await f.apply('hall-other',{actor:'p2',action:{...shop(14,7),interior:hall('edition-0')}})).result,'WrongEditionMaker');
 assert.equal((await f.apply('hall-missing',{actor:'maker',action:{...shop(14,7),interior:hall('edition-9')}})).result,'MissingEdition');
 const stray=room(r=>{r.fixtures.push({id:'portal',name:'Stairway',glyph:'▼',x:5,y:4});});
 assert.equal((await f.apply('stray-portal',{actor:'maker',action:{...shop(14,7),interior:stray}})).result,'InvalidShopDefinition');
 const noPortal=room(r=>{r.kind='dungeon';r.edition='edition-0';});
 assert.equal((await f.apply('no-portal',{actor:'maker',action:{...shop(14,7),interior:noPortal}})).result,'InvalidShopDefinition');
 const created=await f.apply('hall',{actor:'maker',action:{...shop(14,7),title:'Maker hall',interior:hall('edition-0')}});assert.equal(created.status,'Applied');assert.equal(created.result,'shop-0');
 // Authored notices are bounded.
 const longNote=room(r=>{r.fixtures[2].text='x'.repeat(landRules.interior.maxFixtureText+1);});
 assert.equal((await f.apply('long-note',{actor:'maker',action:shop(4,6,'center',longNote)})).result,'InvalidShopDefinition');
 const note=room(r=>{r.fixtures[2].text='Fresh tonics every tide.';});
 assert.equal((await f.apply('plot-2',{actor:'maker',action:shop(4,6,'center',note)})).status,'Applied');
 assert.equal((await f.apply('plot-3',{actor:'maker',action:shop(4,10,'e')})).status,'Applied');
 const before=await f.view('snapshot');
 assert.equal((await f.apply('plot-4',{actor:'maker',action:shop(16,10,'e')})).result,'PlotLimit');assert.deepEqual(await f.view('snapshot'),before);
 // Another owner is unaffected by the maker's limit.
 assert.equal((await f.apply('p2-plot',{actor:'p2',action:shop(16,10,'e')})).result,'shop-3');
 // Demolition: owner and version checked; stocked shops must withdraw first; the plot and id become free.
 assert.equal((await f.apply('stock',{actor:'maker',action:{type:'stock_shop',shop_id:'shop-1',item_ids:['maker-tonic-0'],unit_price:'3'}})).status,'Applied');
 assert.equal((await f.apply('rm-other',{actor:'p2',action:{type:'remove_shop',shop_id:'shop-1',expected_version:'1'}})).result,'WrongShopOwner');
 assert.equal((await f.apply('rm-stale',{actor:'maker',action:{type:'remove_shop',shop_id:'shop-1',expected_version:'2'}})).result,'StaleShopVersion');
 assert.equal((await f.apply('rm-stocked',{actor:'maker',action:{type:'remove_shop',shop_id:'shop-1',expected_version:'1'}})).result,'ShopHasStock');
 const listing=(await f.view('snapshot')).shops.find((s:any)=>s.id==='shop-1').listing_ids[0];
 assert.equal((await f.apply('withdraw',{actor:'maker',action:{type:'cancel_listing',listing_id:listing}})).status,'Applied');
 const items=(await f.view('snapshot')).items;
 assert.equal((await f.apply('rm',{actor:'maker',action:{type:'remove_shop',shop_id:'shop-1',expected_version:'1'}})).result,'shop-1');
 const after=await f.view('snapshot');assert.equal(after.shops.length,3);assert.deepEqual(after.items,items);
 assert.equal((await f.apply('replot',{actor:'maker',action:shop(4,6)})).result,'shop-4');
 }finally{await f.sandbox.tearDown();}
});
