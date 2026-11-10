import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from '../src/state';
import {act} from '../src/actions';
import {revealIntents} from '../src/combat';
function lane(){const s=createRun();s.player.x=3;s.player.y=3;s.enemies=[{id:'boar',kind:'charger',x:6,y:3,hp:6,intent:{x:5,y:3}}];revealIntents(s);return s;}
test('charge is committed to a lane; sidestepping dodges; recovery gives a free turn',()=>{const s=lane();assert.equal(s.enemies[0].lane?.length,5);assert.equal(act(s,{type:'wait'}).player.hp,8);const n=act(s,{type:'move',x:3,y:4});assert.equal(n.player.hp,12);assert.equal(n.enemies[0].recovering,true);const p=act(n,{type:'wait'});assert.equal(p.player.hp,12);assert.equal(p.enemies[0].recovering,false);});
test('charge strikes and stops at first enemy, protecting player behind',()=>{const s=lane();s.enemies.push({id:'z-rat',x:4,y:3,hp:4,intent:{x:3,y:3}});const n=act(s,{type:'wait'});assert.equal(n.player.hp,12);assert.equal(n.enemies.length,1);assert.equal(n.enemies[0].x,5);});
test('armed traps hit player and enemies, alternate visibly; invalid moves do not toggle',()=>{const s=createRun();s.traps=[{id:'spikes',x:2,y:1,armed:true}];const hit=act(s,{type:'move',x:2,y:1});assert.equal(hit.player.hp,9);assert.equal(hit.traps[0].armed,false);assert.equal(act(s,{type:'move',x:0,y:1}),s);s.enemies=[{id:'rat',x:3,y:1,hp:3,intent:{x:2,y:1}}];const dodge=act(s,{type:'move',x:1,y:2});assert.equal(dodge.player.hp,12);assert.equal(dodge.enemies.length,0);});
test('identical action trace reproduces hazards',()=>{const s=lane();const trace=[{type:'wait'},{type:'guard'},{type:'move',x:2,y:3}] as const;assert.deepEqual(trace.reduce(act,s),trace.reduce(act,structuredClone(s)));});
