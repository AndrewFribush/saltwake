import test from 'node:test';import assert from 'node:assert/strict';
import {districts,districtPlaces,districtPath,districtStep,districtWalkable,neighbor} from '../src/town-districts';
const directions=[{dx:0,dy:-1,edge:{x:12,y:0},before:{x:12,y:1}},{dx:1,dy:0,edge:{x:23,y:8},before:{x:22,y:8}},{dx:0,dy:1,edge:{x:12,y:15},before:{x:12,y:14}},{dx:-1,dy:0,edge:{x:0,y:8},before:{x:1,y:8}}];
test('all adjacent districts have reachable crossings and immediate return paths',()=>{
 for(const d of districts)for(const dir of directions){const n=neighbor(d.id,dir.dx,dir.dy);if(!n)continue;
  const path=districtPath(d.id,{x:12,y:9},dir.edge);assert.deepEqual(path.at(-1),dir.edge,`${d.id} to ${n.id}`);
  let p={x:12,y:9};for(const step of path.slice(0,-1)){const result=districtStep(d.id,p,step);assert.equal(result.district,d.id);assert.equal(result.enter,undefined);p=result.position;}
  const crossing=districtStep(d.id,p,path.at(-1)!);assert.equal(crossing.district,n.id);assert.ok(districtWalkable(n.id,crossing.position));
  const back=districtStep(n.id,crossing.position,{x:crossing.position.x-dir.dx,y:crossing.position.y-dir.dy});assert.equal(back.district,d.id);assert.ok(districtWalkable(d.id,back.position));
  for(const place of districtPlaces(n.id))assert.ok(districtPath(n.id,crossing.position,place.door).length,`${n.id} ${place.id}`);
 }
});
test('water and the outer town limits do not teleport the player',()=>{
 const water=districtStep('center',{x:3,y:7},{x:2,y:7});assert.deepEqual(water.position,{x:3,y:7});assert.equal(water.district,'center');
 const blocked=districtStep('w',{x:22,y:7},{x:23,y:7});assert.equal(blocked.district,'w');assert.ok(blocked.blocked);
 for(const d of districts)for(const dir of directions)if(!neighbor(d.id,dir.dx,dir.dy)){const r=districtStep(d.id,dir.before,dir.edge);assert.equal(r.district,d.id);assert.deepEqual(r.position,dir.before);assert.ok(r.blocked);}
});
test('district doors enter the same real service and return just outside',()=>{
 for(const d of districts)for(const p of districtPlaces(d.id)){const outside={x:p.door.x,y:p.door.y+1};assert.deepEqual(districtStep(d.id,outside,p.door),{district:d.id,position:outside,enter:p.id});}
});
