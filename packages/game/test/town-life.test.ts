import test from 'node:test';import assert from 'node:assert/strict';
import {defaultInterior} from '../src/interiors';import {withBuildingUse} from '../src/town-spaces';
import {boardEntries} from '../src/town-board';
import {districtWalkable,districtPlaces,districts} from '../src/town-districts';
import {footprintBlocked} from '../src/town-discovery';
import {atDistrictPost,districtPost,districtDigest,townsfolk,folkLine,clockSign,period,season} from '../src/town-life';
const hall=JSON.stringify(withBuildingUse(defaultInterior('market'),'dungeon','edition-0'));
const shops=[{id:'shop-0',owner:'maker',title:'Hollow gate',district:'e',x:4,y:10,interior:hall,version:'1',open:true,listing_ids:[]},
 {id:'shop-1',owner:'p2',title:'Tonic stall',district:'e',x:14,y:2,interior:JSON.stringify(defaultInterior('market')),version:'1',open:true,listing_ids:['listing-1']},
 {id:'shop-2',owner:'p3',title:'Far stall',district:'s',x:4,y:1,interior:JSON.stringify(defaultInterior('market')),version:'1',open:true,listing_ids:[]}];
const editions=[{id:'edition-0',fee:'3',status:'open',bundles:2,terms:{title:'Smugglers'},record:{attempts:2,completed:2,extracted:1,died:1,recent:[{outcome:'died',finishedAtMs:1_000_000},{outcome:'extracted',finishedAtMs:400_000}]}}];
const listings=[{id:'listing-1',status:'active',unit_price:'4',remaining_ids:['a']}];
test('every district but the square has a walkable notice post that no plot can cover',()=>{
 for(const d of districts){
  assert.equal(atDistrictPost(d.id,districtPost),d.id!=='center');
  assert.ok(districtWalkable(d.id,districtPost,shops),d.id);
  for(let x=0;x<24;x++)for(let y=0;y<16;y++)if(!footprintBlocked(d.id,[],x,y))assert.ok(districtPost.x<x||districtPost.x>=x+3||districtPost.y<y||districtPost.y>=y+2);
 }
});
test('a district digest lists only its own buildings with timed, nameless run outcomes',()=>{
 const entries=boardEntries(shops,editions,listings);
 const d=districtDigest('e',entries,{'shop-1':['wallet:a']},1_060_000,p=>p.replace('wallet:',''));
 assert.deepEqual(d.buildings.map(b=>b.title).sort(),['Hollow gate','Tonic stall']);
 assert.equal(d.name,'Market Ward');
 assert.equal(d.activity[0],'Now: a is inside Tonic stall');
 assert.equal(d.activity[1],'just now: a delver died in Smugglers');
 assert.equal(d.activity[2],'11 min ago: a delver escaped from Smugglers');
 assert.deepEqual(districtDigest('n',entries).buildings,[]);
});
test('townsfolk walk road tiles, never doors, deterministically, and say only public facts',()=>{
 const day=new Date(2026,10,11,12,0,0),night=new Date(2026,10,11,23,0,0),dusk=new Date(2026,10,11,18,0,0);
 for(const d of districts)for(let t=0;t<60;t++){
  const now=day.getTime()+t*1400;const folk=townsfolk(d.id,shops,now,day);
  assert.equal(folk.length,2);assert.deepEqual(folk,townsfolk(d.id,shops,now,day));
  for(const f of folk){assert.ok(districtWalkable(d.id,f,shops),`${d.id} ${f.x},${f.y}`);assert.ok(!districtPlaces(d.id,shops).some(b=>b.door.x===f.x&&b.door.y===f.y));}
 }
 assert.equal(townsfolk('e',shops,night.getTime(),night).length,1);
 assert.ok(townsfolk('e',shops,dusk.getTime(),dusk).some(f=>f.role==='lamplighter'));
 const digest=districtDigest('e',boardEntries(shops,editions,listings),{},1_060_000);
 for(let m=0;m<30;m++){const line=folkLine(townsfolk('e',shops,day.getTime())[0],digest,new Date(day.getTime()+m*60_000));assert.ok(line.length>10);assert.doesNotMatch(line,/buy from me|for you|gift|reward/i);}
});
test('clock signage follows the viewer clock',()=>{
 assert.equal(period(new Date(2026,10,11,6)),'dawn');assert.equal(period(new Date(2026,10,11,2)),'night');
 assert.equal(season(new Date(2026,10,11)),'storm season');assert.equal(season(new Date(2026,0,3)),'ice season');
 assert.match(clockSign(new Date(2026,10,11,18)).text,/^Dusk\. .*Storm season/);
});
