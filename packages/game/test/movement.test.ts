import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/state';
import { act } from '../src/actions';
import { catalog } from '../../shared/src/catalog';
test('move one cardinal step; wall and remote click leave state unchanged', () => {
 const s=createRun();
 assert.equal(act(s,{type:'move',x:0,y:1}),s);
 assert.equal(act(s,{type:'move',x:5,y:1}),s);
 const n=act(s,{type:'move',x:2,y:1});
 assert.deepEqual(n.player,{x:2,y:1,hp:12,weapon:'club',armor:false});
 assert.equal(n.turn,1); assert.equal(s.turn,0);
});
test('catalog matches eight reference prices',()=>assert.deepEqual(Object.values(catalog).map(x=>x.value),[4,12,8,2,2,2,6,8]));
