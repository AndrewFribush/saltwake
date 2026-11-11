import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import type {AddressInfo} from 'node:net';
import {KeyPairSigner,type KeyPairString} from 'near-api-js';import {fixture,terms} from '../../../tests/contract/helpers';import {defaultInterior} from '../../../packages/game/src/interiors';import {withBuildingUse,displayId} from '../../../packages/game/src/town-spaces';
import {Store} from '../src/db';import {Outbox} from '../src/outbox';import {NearChain} from '../src/chain';import {Runs} from '../src/runs';import {httpServer} from '../src/http';
test('HTTP town spaces: dungeon entrance, display shelf sale, public records, plot limit, demolition',{timeout:150000},async()=>{
 const f=await fixture(),dir=mkdtempSync(join(tmpdir(),'town-spaces-http-'));const db=new Store(join(dir,'db'));const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);
 const box=new Outbox(db,chain);const app=httpServer(box,new Runs(db,box),()=>f.view('snapshot'));
 await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;let cookie='';
 const request=async(path:string,body?:unknown)=>{const r=await fetch(url+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:url,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie')!.split(';')[0];const value=await r.json() as any;assert.equal(r.status,200,JSON.stringify(value));return value;};
 const cmd=async(id:string,action:unknown)=>request('command',{id,action});
 try{
  await request('session',{});await request('profile',{profile:'maker'});
  const now=Number(await f.view('clock_ms'));
  assert.equal((await cmd('pub',{type:'publish',terms:{...terms(now),sockets:[],no_reward:true},fee:'3',funding:[]})).result,'edition-0');
  const hall=withBuildingUse(defaultInterior('market'),'dungeon','edition-0');
  assert.equal((await cmd('hall',{type:'create_shop',title:'Hall',district:'e',x:4,y:10,interior:JSON.stringify(hall),open:true})).result,'shop-0');
  const shelfRoom=defaultInterior('market');shelfRoom.fixtures.push({id:displayId(),name:'Display shelf',glyph:'▥',x:6,y:4});
  assert.equal((await cmd('shop',{type:'create_shop',title:'Shelves',district:'s',x:4,y:10,interior:JSON.stringify(shelfRoom),open:true})).status,'Applied');
  assert.equal((await cmd('shop-3',{type:'create_shop',title:'Third',district:'n',x:4,y:10,interior:JSON.stringify(defaultInterior('market')),open:false})).status,'Applied');
  assert.equal((await cmd('shop-4',{type:'create_shop',title:'Fourth',district:'w',x:14,y:10,interior:JSON.stringify(defaultInterior('market')),open:false})).result,'PlotLimit');
  assert.equal((await cmd('stock',{type:'stock_shop',shop_id:'shop-1',item_ids:['maker-tonic-0','maker-tonic-1'],unit_price:'3'})).result,'listing-0');
  await request('profile',{profile:'buyer'});
  assert.equal((await cmd('buy',{type:'buy',listing_id:'listing-0',item_ids:['maker-tonic-0'],expected_unit_price:'3'})).status,'Applied');
  const seen=await request('world');const shelves=seen.shops.find((s:any)=>s.id==='shop-1');
  assert.deepEqual(shelves.publicRecord,{sold:1,buyers:1,coverage:'complete'});assert.equal(shelves.record,undefined,'owner receipts stay with the owner');
  assert.ok(!JSON.stringify(seen.shops.map((s:any)=>s.publicRecord)).includes('"buyer"'));
  const ed=seen.editions.find((e:any)=>e.id==='edition-0');assert.deepEqual(ed.record.recent,[]);
  assert.equal((await cmd('rm-not-mine',{type:'remove_shop',shop_id:'shop-1',expected_version:shelves.version})).result,'WrongShopOwner');
  await request('profile',{profile:'maker'});
  assert.equal((await cmd('rm-stocked',{type:'remove_shop',shop_id:'shop-1',expected_version:'1'})).result,'ShopHasStock');
  assert.equal((await cmd('withdraw',{type:'cancel_listing',listing_id:'listing-0'})).status,'Applied');
  assert.equal((await cmd('rm',{type:'remove_shop',shop_id:'shop-1',expected_version:'1'})).result,'shop-1');
  assert.equal((await cmd('shop-4b',{type:'create_shop',title:'Fourth',district:'w',x:14,y:10,interior:JSON.stringify(defaultInterior('market')),open:false})).status,'Applied','demolition freed the plot');
  const after=await request('world');assert.deepEqual(after.shops.map((s:any)=>s.title).sort(),['Fourth','Hall','Third']);assert.ok(after.items.some((i:any)=>i.id==='maker-tonic-1'),'withdrawn stock is back with the owner');
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));db.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});
