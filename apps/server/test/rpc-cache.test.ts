import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedRead} from '../src/rpc-cache';
test('cachedRead serves fresh values, refreshes in the background and shares in-flight reads',async()=>{
 let t=0,reads=0;const read=cachedRead(async()=>++reads,10000,3000,()=>t);
 assert.deepEqual(await Promise.all([read(),read()]),[1,1]);assert.equal(reads,1);
 t=2000;assert.equal(await read(),1);assert.equal(reads,1);
 t=4000;assert.equal(await read(),1);await new Promise(r=>setImmediate(r));assert.equal(reads,2);
 t=4000+10000;assert.equal(await read(),3);
});
test('cachedRead propagates a failed read when nothing fresh is cached',async()=>{
 let fail=true;const read=cachedRead(async()=>{if(fail)throw Error('429');return 1;},1000,300);
 await assert.rejects(read(),/429/);fail=false;assert.equal(await read(),1);
});
