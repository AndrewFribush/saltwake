import test from 'node:test';
import assert from 'node:assert/strict';
import {roomLevels,roomLabel,levelCount,addSideRoom,passageSpot,connectLinear,isDescent} from '../src/level-map';
import type {CustomFloor} from '../../shared/src/custom-layout';

const blank=():CustomFloor=>({tiles:['#######','#.....#','#.....#','#.....#','#######'],spawn:{x:1,y:1},exit:{x:5,y:3},sockets:[]});

test('levels: linear rooms are one level each; passages group rooms, descents separate them',()=>{
 assert.deepEqual(roomLevels([blank(),blank(),blank()]),[0,1,2]);
 const rooms:CustomFloor[]=[blank(),blank(),blank(),blank()];
 rooms[0].links=[{id:'door-2',x:2,y:1,to:2,require_clear:false},{id:'down0',x:4,y:3,to:1,require_clear:true}];
 rooms[1].links=[{id:'drop',x:2,y:1,to:3,require_clear:false}];rooms[2].links=[{id:'door-back-2',x:2,y:1,to:0,require_clear:false}];rooms[3].links=[];
 assert.deepEqual(roomLevels(rooms),[0,1,0,2]);
 assert.equal(roomLabel(rooms,0),'Level 1 · room A');assert.equal(roomLabel(rooms,2),'Level 1 · room B');assert.equal(roomLabel(rooms,1),'Level 2');assert.equal(roomLabel(rooms,3),'Level 3');
 assert.equal(levelCount(rooms),3);
 assert.ok(isDescent('stairs-1')&&isDescent('DOWN3')&&!isDescent('door-1'));
});

test('a side room joins the current level with a passage each way, and a linear draft gets stairs passages first',()=>{
 const floors=[blank(),blank()];
 const r=addSideRoom(floors,0,blank());
 assert.ok('index' in r);assert.equal(r.index,2);assert.equal(floors.length,3);
 assert.deepEqual(floors[0].links!.map(l=>[l.id,l.to]),[['down0',1],['door-2',2]],'stairs passage kept, side door added');
 assert.deepEqual(floors[2].links!.map(l=>[l.id,l.to]),[['door-back-2',0]]);
 assert.deepEqual(roomLevels(floors),[0,1,0]);
 assert.ok(floors[0].links!.every(l=>floors[0].tiles[l.y][l.x]==='.'),'passages sit on floor tiles');
 const walled:CustomFloor={...blank(),tiles:['#######','#.#...#','###...#','#.....#','#######']};
 assert.equal(passageSpot(walled),undefined);
 assert.ok('error' in addSideRoom([walled],0,blank()));
});

test('connectLinear leaves rooms with passages alone and skips a stairs tile with no free neighbour',()=>{
 const a=blank();a.links=[{id:'door-9',x:2,y:1,to:1,require_clear:false}];const b=blank();
 const floors=[a,b];connectLinear(floors);
 assert.equal(a.links.length,1);assert.deepEqual(b.links,[]);
});
