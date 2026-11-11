import test from 'node:test';
import assert from 'node:assert/strict';
import {copyRegion,rotateStamp,mirrorStamp,pasteStamp,normalRect,builtInStamps,unreachableTiles,sealUnreachable} from '../src/floor-regions';
const floor=()=>({tiles:['#######','#.....#','#.....#','#.....#','#######'],spawn:{x:1,y:1},exit:{x:5,y:3},sockets:[{x:3,y:2}]});
test('copy, rotate and mirror a region',()=>{
 const s=copyRegion({tiles:['abc','def']},normalRect({x:2,y:1},{x:0,y:0}));assert.deepEqual(s.tiles,['abc','def']);
 assert.deepEqual(rotateStamp(s).tiles,['da','eb','fc']);assert.deepEqual(mirrorStamp(s).tiles,['cba','fed']);
 assert.deepEqual(rotateStamp(rotateStamp(rotateStamp(rotateStamp(s)))).tiles,s.tiles);
});
test('paste keeps the boundary closed and never walls over markers',()=>{
 const r=pasteStamp(floor(),{name:'w',tiles:['#####']},0,1);
 assert.equal(r.tiles[1][0],'#');assert.equal(r.tiles[1][1],'.','spawn stays floor');assert.equal(r.tiles[1][2],'#');assert.equal(r.tiles[1][4],'#');
 assert.ok(r.skipped>=2);
 const full=pasteStamp(floor(),builtInStamps.find(s=>s.name==='Corridor junction')!,1,0);assert.equal(full.tiles[0],'#######','outer row untouched');
 assert.equal(full.tiles[2][3],'.','encounter tile stays floor');
});
test('unreachable floor is found and can be sealed',()=>{
 const f={tiles:['#######','#..#..#','#..#..#','#######'],spawn:{x:1,y:1},exit:{x:2,y:2},sockets:[]};
 assert.equal(unreachableTiles(f).size,4);assert.deepEqual(sealUnreachable(f),['#######','#..####','#..####','#######']);
 assert.equal(unreachableTiles({...f,features:[{kind:'crack',x:3,y:1}]}).size,0,'a stash behind a cracked wall is reachable');
});
