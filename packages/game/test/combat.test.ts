import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,type RunState} from '../src/state';
import {act} from '../src/actions';
function encounter():RunState { const s=createRun();s.player={x:2,y:1,hp:12,weapon:'club',armor:false};s.enemies=[{id:'rat',x:3,y:1,hp:4,intent:{x:2,y:1}}];return s; }
test('a committed attack misses when player steps aside',()=>{const s=encounter();const n=act(s,{type:'move',x:1,y:1});assert.equal(n.player.hp,12);assert.equal(n.turn,1);});
test('club deals two; surviving enemy hits; sword kills before enemy acts',()=>{const s=encounter();const n=act(s,{type:'attack',enemyId:'rat'});assert.equal(n.enemies[0].hp,2);assert.equal(n.player.hp,9);s.player.weapon='sword';s.enemies[0].hp=3;const k=act(s,{type:'attack',enemyId:'rat'});assert.equal(k.enemies.length,0);assert.equal(k.player.hp,12);});
test('guard halves one hit rounded up after armor, then expires',()=>{const s=encounter();assert.equal(act(s,{type:'guard'}).player.hp,10);s.player.armor=true;const n=act(s,{type:'guard'});assert.equal(n.player.hp,11);assert.equal(act(n,{type:'wait'}).player.hp,9);});
test('enemies act in ID order and guard absorbs only first hit',()=>{const s=encounter();s.enemies.push({id:'ant',x:1,y:1,hp:4,intent:{x:2,y:1}});const n=act(s,{type:'guard'});assert.equal(n.player.hp,7);assert.deepEqual(n.log.slice(-2),['pursuer (ant) hits for 2.','pursuer (rat) hits for 3.']);});
test('invalid attacks and occupied movement do not spend a turn',()=>{const s=encounter();assert.equal(act(s,{type:'move',x:3,y:1}),s);assert.equal(act(s,{type:'attack',enemyId:'missing'}),s);});
test('death stops all further actions',()=>{const s=encounter();s.player.hp=1;const n=act(s,{type:'wait'});assert.equal(n.status,'died');assert.equal(n.player.hp,0);assert.equal(act(n,{type:'guard'}),n);});
test('pursuer routes around a wall instead of oscillating',async()=>{const {revealIntents}=await import('../src/combat');const s=createRun();s.player.x=5;s.player.y=2;s.enemies=[{id:'rat',x:2,y:2,hp:4,intent:{x:2,y:1}}];revealIntents(s);let n=s;for(let i=0;i<10;i++)n=act(n,{type:'wait'});assert.ok(n.player.hp<12,'rat must find the reachable player');});
