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
