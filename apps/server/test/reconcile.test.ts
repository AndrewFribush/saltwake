import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconciler} from '../src/reconcile';
test('a sync requested after the current scan drains newly queued work before resolving',async()=>{
 let release!:()=>void;const paused=new Promise<void>(r=>release=r);
 const queue:string[]=[];const applied:string[]=[];let passes=0;
 const sync=reconciler(async()=>{const batch=queue.splice(0);if(++passes===1)await paused;applied.push(...batch);});
 const first=sync();await Promise.resolve();queue.push('terminal-settlement');const second=sync();release();
 await second;assert.deepEqual(applied,['terminal-settlement']);await first;assert.equal(passes,2);
});
test('a failed pass rejects callers and a later request can recover',async()=>{
 let fail=true;const sync=reconciler(async()=>{if(fail)throw Error('offline');});
 await assert.rejects(sync(),/offline/);fail=false;await sync();
});
test('background polling joins an active pass without extending it forever',async()=>{
 let release!:()=>void;const paused=new Promise<void>(r=>release=r);let passes=0;
 const sync=reconciler(async()=>{passes++;await paused;});
 const foreground=sync();const background=sync(false);release();
 await Promise.all([foreground,background]);assert.equal(passes,1);
});
test('later requests do not hold an earlier caller hostage to a subsequent pass',async()=>{
 let firstRelease!:()=>void;const firstGate=new Promise<void>(r=>firstRelease=r);
 let nextRelease!:()=>void;const nextGate=new Promise<void>(r=>nextRelease=r);let passes=0;
 const sync=reconciler(async()=>{if(++passes===1)await firstGate;else await nextGate;});
 const first=sync();await Promise.resolve();const second=sync();firstRelease();
 try{await Promise.race([first,new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('earlier caller starved')),100))]);}
 finally{nextRelease();await second;}
 assert.equal(passes,2);
});
