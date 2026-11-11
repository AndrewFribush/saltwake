import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {fixture} from './helpers';import {defaultInterior} from '../../packages/game/src/interiors';import type {Command} from '../../packages/shared/src/types';
const definition={title:'Player-built shop',district:'center',x:14,y:7,interior:JSON.stringify(defaultInterior('market')),open:true};
test('player-owned shop placement, interiors, stock, purchase, closure and version checks on contract',{timeout:120000},async()=>{
 const f=await fixture();try{
 const create:Command={actor:'maker',action:{type:'create_shop',...definition}};
 const first=await f.apply('create',create);assert.equal(first.status,'Applied');assert.equal(first.result,'shop-0');assert.deepEqual(await f.apply('create',create),first);
 const before=await f.view('snapshot');
 for(const [n,action] of [{...create.action,interior:'{}'},{...create.action,x:5,y:2},{...create.action,x:14,y:7}].entries()){assert.equal((await f.apply('invalid-'+n,{actor:'buyer',action})).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);}
 const badRooms=[(()=>{const r=defaultInterior('market');r.fixtures[2].id='decor-';return r;})(),(()=>{const r=defaultInterior('market');r.fixtures[2].x=99;return r;})(),(()=>{const r=defaultInterior('market');r.tiles[1]='#.........#';r.tiles[2]='#.........#';r.tiles[3]='###########';return r;})()];
 for(const [n,room] of badRooms.entries()){assert.equal((await f.apply('bad-room-'+n,{actor:'buyer',action:{type:'create_shop',...definition,x:4,y:6,interior:JSON.stringify(room)}})).result,'InvalidShopDefinition');assert.deepEqual(await f.view('snapshot'),before);}
 const update:Command['action']={type:'update_shop',shop_id:'shop-0',expected_version:'1',...definition,open:false};
 assert.equal((await f.apply('wrong-owner',{actor:'buyer',action:update})).result,'WrongShopOwner');
 const stock:Command={actor:'maker',action:{type:'stock_shop',shop_id:'shop-0',item_ids:['maker-tonic-0','maker-tonic-1'],unit_price:'3'}};
 assert.equal((await f.apply('wrong-stock',{...stock,actor:'buyer'})).status,'Rejected');
 assert.equal((await f.apply('stock',stock)).result,'listing-0');
 const buy:Command={actor:'buyer',action:{type:'buy',listing_id:'listing-0',item_ids:['maker-tonic-0'],expected_unit_price:'3'}};
 assert.equal((await f.apply('purchase',buy)).status,'Applied');
 assert.equal((await f.apply('close',{actor:'maker',action:update})).status,'Applied');
 assert.equal((await f.apply('closed-buy',{...buy,action:{...buy.action,item_ids:['maker-tonic-1']}})).result,'ShopClosed');
 assert.equal((await f.apply('stale',{actor:'maker',action:update})).result,'StaleShopVersion');
 const final=await f.view('snapshot');assert.equal(final.credits.buyer,'7');assert.equal(final.credits.maker,'103');assert.equal(final.shops[0].version,'2');assert.equal(final.shops[0].interior,definition.interior);assert.deepEqual(final.shops[0].listing_ids,['listing-0']);
 assert.equal((await f.apply('reopen',{actor:'maker',action:{...update,expected_version:'2',open:true}})).status,'Applied');assert.equal((await f.apply('second-purchase',{...buy,action:{...buy.action,item_ids:['maker-tonic-1']}})).status,'Applied');
 const priorMove=await f.view('snapshot');
 assert.equal((await f.apply('move-collision',{actor:'maker',action:{...update,expected_version:'3',district:'e',x:10,y:4,open:true}})).result,'OccupiedShopPlacement');
 assert.deepEqual(await f.view('snapshot'),priorMove);
 assert.equal((await f.apply('move-district',{actor:'maker',action:{...update,expected_version:'3',district:'e',x:4,y:10,open:true}})).status,'Applied');
 const moved=await f.view('snapshot');assert.equal(moved.shops[0].district,'e');assert.equal(moved.shops[0].version,'4');assert.deepEqual(moved.shops[0].listing_ids,priorMove.shops[0].listing_ids);assert.deepEqual(moved.items,priorMove.items);assert.deepEqual(moved.credits,priorMove.credits);

 }finally{await f.sandbox.tearDown();}
});
test('legacy local world migration retains every balance, item, listing and receipt',{timeout:120000},async()=>{
 const f=await fixture('tests/fixtures/economy-v1.wasm');try{
 const receipt=await f.apply('legacy-list',{actor:'maker',action:{type:'list',item_ids:['maker-tonic-0'],unit_price:'3'}});const before=await f.view('snapshot');
 await f.account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));await f.call('migrate_shops');const after=await f.view('snapshot');assert.deepEqual(after.shops,[]);delete after.shops;assert.deepEqual(after.coin_issuance,{coins_issued:'0',near_received:'0',purchases:'0'});delete after.coin_issuance;assert.deepEqual(after,before);assert.deepEqual(await f.view('operation',{op_id:'legacy-list'}),receipt);
 assert.equal((await f.apply('new-shop',{actor:'maker',action:{type:'create_shop',...definition}})).status,'Applied');
 }finally{await f.sandbox.tearDown();}
});
