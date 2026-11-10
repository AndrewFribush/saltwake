import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceRun} from '../src/generation';
import {act} from '../src/actions';
test('cannot extract or continue through enemies, or away from exit',()=>{const s=practiceRun();assert.equal(act(s,{type:'extract'}),s);assert.equal(act(s,{type:'continue'}),s);s.enemies=[];assert.equal(act(s,{type:'extract'}),s);});
test('continuing carries health/items but not enemies; extraction ends actions',()=>{const s=practiceRun();s.enemies=[];s.player.x=7;s.player.y=5;s.player.hp=5;const n=act(s,{type:'continue'});assert.equal(n.roomIndex,1);assert.equal(n.player.hp,5);assert.equal(n.enemies[0].kind,'charger');assert.deepEqual(n.originalTownIds,s.originalTownIds);n.enemies=[];n.player.x=7;n.player.y=5;assert.equal(act(n,{type:'continue'}),n);const done=act(n,{type:'extract'});assert.equal(done.status,'extracted');assert.equal(act(done,{type:'wait'}),done);});
