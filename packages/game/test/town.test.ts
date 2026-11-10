import {test} from 'node:test';import assert from 'node:assert/strict';
import {places,townPath,townStart,townWalkable,nearbyPlace} from '../src/town';
test('every livelihood and dungeon door is reachable from every other destination',()=>{
 for(const from of [townStart,...places.map(p=>p.door)])for(const b of places){const path=townPath(from,b.door);if(from.x!==b.door.x||from.y!==b.door.y)assert.ok(path.length,b.id);let prior=from;for(const p of path){assert.ok(townWalkable(p));assert.equal(Math.abs(prior.x-p.x)+Math.abs(prior.y-p.y),1);prior=p;}assert.deepEqual(prior,b.door);}
});
test('travel cannot cross buildings, water or map edges; interactions require proximity',()=>{
 for(const p of [{x:1,y:8},{x:24,y:8},{x:7,y:3},{x:3.5,y:4}]){assert.equal(townWalkable(p),false);assert.deepEqual(townPath(townStart,p),[]);}
 assert.equal(nearbyPlace(townStart),undefined);for(const p of places)assert.equal(nearbyPlace(p.door)?.id,p.id);
});
