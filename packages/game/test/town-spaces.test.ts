import test from 'node:test';import assert from 'node:assert/strict';
import {defaultInterior,validateInterior} from '../src/interiors';
import {readBuildingUse,withBuildingUse,freeFixtureTile} from '../src/town-spaces';
import {districtPlaces} from '../src/town-districts';
test('building use round-trips through the stored interior and keeps rooms valid',()=>{
 const shop=defaultInterior('market');assert.deepEqual(readBuildingUse(JSON.stringify(shop)),{kind:'shop'});
 const hall=withBuildingUse(shop,'dungeon','edition-4');assert.deepEqual(validateInterior(hall),[]);assert.equal(hall.fixtures.filter(f=>f.id==='portal').length,1);
 assert.deepEqual(readBuildingUse(JSON.stringify(hall)),{kind:'dungeon',edition:'edition-4'});
 const back=withBuildingUse(hall,'shop');assert.deepEqual(validateInterior(back),[]);assert.ok(!back.fixtures.some(f=>f.id==='portal'));assert.equal(back.kind,undefined);
 assert.deepEqual(withBuildingUse(hall,'dungeon','edition-5').fixtures,hall.fixtures);
 assert.deepEqual(readBuildingUse('not json'),{kind:'shop'});
});
test('interior validation mirrors land-v1 contract rules',()=>{
 const shop=defaultInterior('market');
 assert.ok(validateInterior({...shop,fixtures:[...shop.fixtures,{id:'portal',name:'x',glyph:'▼',x:5,y:4}]}).length,'portal only in dungeon entrances');
 assert.ok(validateInterior({...shop,kind:'dungeon',edition:'edition-1'}).length,'dungeon entrance needs a portal');
 assert.ok(validateInterior({...shop,kind:'shop',edition:'edition-1'}).length,'shops do not link editions');
 const noted={...shop,fixtures:shop.fixtures.map((f,i)=>i===2?{...f,text:'Open at low tide'}:f)};assert.deepEqual(validateInterior(noted),[]);
 assert.ok(validateInterior({...shop,fixtures:shop.fixtures.map((f,i)=>i===2?{...f,text:'x'.repeat(161)}:f)}).length);
 const sign=freeFixtureTile(shop,(x,y)=>({id:'decor-sign',name:'Notice',glyph:'✎',x,y,text:'Hi'}));assert.ok(sign);assert.deepEqual(validateInterior({...shop,fixtures:[...shop.fixtures,sign!]}),[]);
});
test('dungeon entrances render as their own kind of building in the shared town',()=>{
 const hall=withBuildingUse(defaultInterior('market'),'dungeon','edition-0');
 const shops=[{id:'shop-0',owner:'maker',title:'Hall',district:'e',x:4,y:10,interior:JSON.stringify(hall),version:'1',open:true,listing_ids:[]}];
 const place=districtPlaces('e',shops).find(p=>p.shopId==='shop-0')!;assert.equal(place.purpose,'Dungeon entrance');assert.equal(place.edition,'edition-0');
});
