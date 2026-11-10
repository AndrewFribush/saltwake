import {test} from 'node:test';
import assert from 'node:assert/strict';
import {places} from '../src/town';
import {roomEntry,roomExit,roomFixtures,roomWalkable,roomPath,fixtureApproach} from '../src/interiors';
test('every house has reachable services and a traversable return door',()=>{
 for(const place of places){for(const f of roomFixtures(place.id).filter(f=>!f.id.startsWith('decor'))){const approach=fixtureApproach(place.id,roomEntry,f);assert.ok(approach,`${place.id}: ${f.id}`);let prev=roomEntry;for(const p of approach.path){assert.ok(roomWalkable(place.id,p));assert.equal(Math.abs(prev.x-p.x)+Math.abs(prev.y-p.y),1);prev=p;}assert.equal(Math.abs(prev.x-f.x)+Math.abs(prev.y-f.y),1);const exit=roomPath(place.id,prev,roomExit);assert.deepEqual(exit.at(-1),roomExit);}}
});
test('house walls and fixtures block walking; paths never cut diagonally through them',()=>{
 for(const place of places){for(const p of [{x:0,y:1},{x:10,y:4},{x:4,y:8},{x:3.5,y:4},...roomFixtures(place.id)]){assert.equal(roomWalkable(place.id,p),false);assert.deepEqual(roomPath(place.id,roomEntry,p),[]);}assert.ok(roomWalkable(place.id,roomExit));}
});

test('authored interiors move counters and doors without losing reachability',async()=>{
 const {defaultInterior,validateInterior}=await import('../src/interiors');
 for(const place of places){const layout=defaultInterior(place.id);layout.fixtures.find(f=>f.id==='service')!.x=7;layout.tiles[8]='###.#######';layout.exit={x:3,y:8};assert.deepEqual(validateInterior(layout),[]);assert.deepEqual(roomPath(place.id,layout.entry,layout.exit,layout).at(-1),layout.exit);assert.equal(roomWalkable(place.id,{x:5,y:2},layout),true);assert.equal(roomWalkable(place.id,{x:7,y:2},layout),false);}
});
test('interior saves reject blocked doors, isolated counters and malformed drafts',async()=>{
 const {defaultInterior,validateInterior}=await import('../src/interiors');
 assert.ok(validateInterior(null).length);assert.ok(validateInterior({tiles:['x']}).length);
 const overlap=defaultInterior('inn');overlap.fixtures[0]={...overlap.fixtures[0],...overlap.entry};assert.ok(validateInterior(overlap).length);
 const sealed=defaultInterior('inn');sealed.tiles[7]='###########';assert.ok(validateInterior(sealed).length);
 const isolated=defaultInterior('inn');for(const p of [{x:4,y:2},{x:6,y:2},{x:5,y:1},{x:5,y:3}]){const row=[...isolated.tiles[p.y]];row[p.x]='#';isolated.tiles[p.y]=row.join('');}assert.ok(validateInterior(isolated).some(e=>e.includes('cannot be reached')));
 const duplicate=defaultInterior('inn');duplicate.fixtures.push({...duplicate.fixtures[0],x:3});assert.ok(validateInterior(duplicate).length);
 const absent=defaultInterior('inn');absent.fixtures=absent.fixtures.filter(f=>f.id!=='wallet');assert.ok(validateInterior(absent).length);
});
