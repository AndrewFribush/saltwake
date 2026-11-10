import test from 'node:test';
import assert from 'node:assert/strict';
import {keyAction} from '../src/controls';
import {createRun} from '../src/state';
test('one discrete key action; ignore repeat and browser shortcuts',()=>{
 const s=createRun();
 assert.equal(keyAction(s,{key:'ArrowRight',repeat:true}),null);
 assert.equal(keyAction(s,{key:'s',metaKey:true}),null);
 assert.equal(keyAction(s,{key:'d',ctrlKey:true}),null);
 assert.deepEqual(keyAction(s,{key:'D'}),{type:'move',x:2,y:1});
 assert.deepEqual(keyAction(s,{key:'G'}),{type:'guard'});
});
