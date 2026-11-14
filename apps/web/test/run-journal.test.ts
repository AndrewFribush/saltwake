import test from 'node:test';
import assert from 'node:assert/strict';
import {freshLines} from '../src/run-journal';

test('the journal takes only the lines the trimmed log gained',()=>{
 assert.deepEqual(freshLines(['a','b'],['a','b','c','d']),['c','d'],'appended lines');
 assert.deepEqual(freshLines(['a','b','c','d','e','f','g','h'],['c','d','e','f','g','h','i','j']),['i','j'],'trimmed to the last 8');
 assert.deepEqual(freshLines(['a','b'],['a','b']),[],'nothing new');
 assert.deepEqual(freshLines(['a','b'],['x','y']),['x','y'],'a fresh run starts over');
 assert.deepEqual(freshLines([],['start']),['start']);
 assert.deepEqual(freshLines(['hit','hit'],['hit','hit','hit']),['hit'],'repeated identical lines keep the shortest reading');
});
