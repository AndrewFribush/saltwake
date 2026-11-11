import test from 'node:test';import assert from 'node:assert/strict';
import {authoredLayout} from '../src/authored-layout';
import type {CustomFloor} from '../../shared/src/custom-layout';
import type {Socket} from '../../shared/src/types';
function floor():CustomFloor{return {tiles:Array.from({length:9},(_,y)=>y===0||y===8?'#############':'#...........#'),spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[{x:3,y:2},{x:8,y:2},{x:3,y:5},{x:8,y:5}]};}
const socket:Socket={id:'guard',room:0,slot:2,enemy:'charger',trap:true,reward:'iron'};
test('same authored definition produces identical encounters with no adventure-specific data',()=>{const f=floor();const a=authoredLayout([f],[socket]);const b=authoredLayout([structuredClone(f)],[{...socket}]);assert.deepEqual(a,b);assert.deepEqual(a[0].enemies[0],{x:3,y:5,id:'guard',kind:'charger',hp:6,intent:{x:3,y:5},alerted:false});assert.equal(a[0].traps[0].id,'guard-trap');assert.equal(a[0].tiles[1],f.tiles[1]);});
test('different authored arrangements and empty floors require no code or rewards',()=>{const f=floor();f.sockets[2]={x:9,y:6};const r=authoredLayout([floor(),f],[{...socket,room:1,enemy:'pursuer',trap:false}]);assert.equal(r[0].enemies.length,0);assert.equal(r[1].enemies[0].x,9);assert.equal(r[1].enemies[0].hp,4);assert.equal(r[1].traps.length,0);r[1].enemies[0].x=1;assert.equal(f.sockets[2].x,9);});
test('invalid geometry, missing room, duplicate slot and unknown behavior reject',()=>{const f=floor();assert.throws(()=>authoredLayout([f],[{...socket,room:3}]));assert.throws(()=>authoredLayout([f],[socket,{...socket,id:'other'}]));assert.throws(()=>authoredLayout([f],[{...socket,enemy:'script' as Socket['enemy']}]));f.tiles[1]='#';assert.throws(()=>authoredLayout([f],[]));});

test('creator rehearsal supports selectable synthetic loadouts without mutating authored content',async()=>{
 const {authoredRehearsal}=await import('../src/authored-layout');const f=floor();const before=JSON.stringify(f);
 for(const kit of ['club','sword','armored'] as const){const s=authoredRehearsal([f],[socket],kit);assert.equal(s.player.weapon,kit==='sword'?'sword':'club');assert.equal(s.player.armor,kit==='armored');assert.equal(s.rulesVersion,undefined);assert.ok(Object.keys(s.items).every(id=>id.startsWith('preview-')));assert.equal(s.items['preview-reward-0-2'].type,'iron');assert.equal(s.items['preview-tonic'].origin,'town');}
 assert.equal(JSON.stringify(f),before);
});
