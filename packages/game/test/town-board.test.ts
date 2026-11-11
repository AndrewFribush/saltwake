import test from 'node:test';import assert from 'node:assert/strict';
import {defaultInterior} from '../src/interiors';import {withBuildingUse} from '../src/town-spaces';
import {boardEntries,directionsTo,atNoticeBoard,noticeBoard} from '../src/town-board';
import {districtWalkable} from '../src/town-districts';
const hall=JSON.stringify(withBuildingUse(defaultInterior('market'),'dungeon','edition-0'));
const shops=[{id:'shop-0',owner:'maker',title:'Hollow gate',district:'e',x:4,y:10,interior:hall,version:'1',open:true,listing_ids:[]},
 {id:'shop-1',owner:'p2',title:'Tonic stall',district:'center',x:14,y:7,interior:JSON.stringify(defaultInterior('market')),version:'1',open:true,listing_ids:['listing-1','listing-2']},
 {id:'shop-2',owner:'p3',title:'Shut stall',district:'center',x:4,y:10,interior:JSON.stringify(defaultInterior('market')),version:'1',open:false,listing_ids:[]}];
test('the notice board lists player buildings from public records',()=>{
 const editions=[{id:'edition-0',fee:'3',status:'open',bundles:2,terms:{title:'Smugglers'},record:{attempts:5,completed:4,extracted:1,died:3,recent:[{outcome:'died',finishedAtMs:9},{outcome:'extracted',finishedAtMs:5}]}}];
 const listings=[{id:'listing-1',status:'active',unit_price:'4',remaining_ids:['a','b']},{id:'listing-2',status:'active',unit_price:'9',remaining_ids:['c']},{id:'listing-3',status:'active',unit_price:'1',remaining_ids:['d']}];
 const e=boardEntries(shops,editions,listings);
 assert.deepEqual(e.map(x=>x.shopId),['shop-1','shop-0','shop-2'],'open first, then district order');
 assert.deepEqual(e[0].goods,{count:3,min:4,max:9});
 assert.deepEqual(e[1].dungeon,{title:'Smugglers',fee:'3',status:'open',funded:2,treasure:true,attempts:4,extracted:1,died:3,recent:['died','extracted']});
 assert.deepEqual(boardEntries([{...shops[1],publicRecord:{sold:7,buyers:2}}],[],listings)[0].goods,{count:3,min:4,max:9,sold:7,buyers:2});
 assert.deepEqual(e[1].door,{x:5,y:11});
 assert.equal(boardEntries([shops[0]],[],[])[0].dungeon,null,'missing edition is disclosed, not invented');
});
test('directions describe the walk without moving the player',()=>{
 assert.equal(directionsTo('center',{district:'e',door:{x:5,y:11}}),'Go east to Market Ward; the door at 5, 11.');
 assert.equal(directionsTo('nw',{district:'se',door:{x:1,y:2}}),'Go east to North Ward, then east to Old Wall, then south to Market Ward, then south to Guild Quarter; the door at 1, 2.');
 assert.match(directionsTo('center',{district:'center',door:{x:15,y:8}}),/here in Harbor Square/);
 assert.ok(districtWalkable(noticeBoard.district,noticeBoard)&&atNoticeBoard('center',{x:3,y:7})&&!atNoticeBoard('e',{x:3,y:7}));
});
