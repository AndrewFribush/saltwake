import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCustomFloor,encodeCustomModule,decodeCustomModule,type CustomFloor} from '../../../packages/shared/src/custom-layout';
const floor:CustomFloor={tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[{x:9,y:6},{x:10,y:6},{x:9,y:7},{x:10,y:7}]};
test('custom codec validates geometry, connectivity and unique traversable markers',()=>{
 assert.deepEqual(decodeCustomModule(encodeCustomModule(floor)),floor);
 const disconnected=structuredClone(floor);disconnected.tiles[4]='#.###########';disconnected.tiles[5]='#.#.........#';disconnected.tiles[6]='#.#.........#';disconnected.tiles[7]='#.#.........#';
 const overlap={...floor,exit:floor.spawn};
 for(const bad of [null,{},[],{...floor,tiles:floor.tiles.slice(1)},{...floor,tiles:['.############',...floor.tiles.slice(1)]},{...floor,spawn:{x:0,y:0}},{...floor,spawn:{x:1.5,y:1}},{...floor,sockets:floor.sockets.slice(1)},overlap,disconnected]){
  assert.ok(validateCustomFloor(bad).length,JSON.stringify(bad));assert.throws(()=>encodeCustomModule(bad as CustomFloor));
 }
 const sparse=structuredClone(floor);delete sparse.tiles[3];assert.ok(validateCustomFloor(sparse).length);
 assert.throws(()=>decodeCustomModule('cellar'));assert.throws(()=>decodeCustomModule('custom:{'));assert.throws(()=>decodeCustomModule(encodeCustomModule(floor)+' '.repeat(2048)));
});

test('v4 codec supports zero through sixteen arbitrary encounter positions without weakening v3',()=>{for(const count of [0,1,5,16]){const f={...floor,sockets:Array.from({length:count},(_,i)=>({x:1+i%10,y:2+Math.floor(i/10)}))};assert.deepEqual(decodeCustomModule(encodeCustomModule(f,true)),f);if(count!==4)assert.throws(()=>encodeCustomModule(f));}const large={...floor,sockets:Array.from({length:17},(_,i)=>({x:1+i%10,y:2+Math.floor(i/10)}))};assert.throws(()=>encodeCustomModule(large,true),/sixteen/);assert.throws(()=>decodeCustomModule('custom4:'+JSON.stringify({...floor,sockets:[floor.spawn]})));});
