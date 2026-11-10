import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {KeyPairSigner,type KeyPairString} from 'near-api-js';
import {fixture,terms} from '../../../tests/contract/helpers';import {Store} from '../src/db';import {Outbox} from '../src/outbox';import {NearChain} from '../src/chain';import {Runs} from '../src/runs';import {httpServer} from '../src/http';
import type {AddressInfo} from 'node:net';
test('HTTP maker funding -> paid play -> consumed tonic -> extracted sword, session isolation and CSRF', {timeout:90000},async()=>{
 const f=await fixture();const dir=mkdtempSync(join(tmpdir(),'http-game-'));const db=new Store(join(dir,'db'));const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);const box=new Outbox(db,chain);const runs=new Runs(db,box);const app=httpServer(box,runs,()=>f.view('snapshot'));await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;let cookie='';
 const request=async(path:string,body?:unknown,session=cookie)=>{const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:session},body:body===undefined?undefined:JSON.stringify(body)});const value=await r.json();return {r,value};};
 try{
 const created=await request('session',{});cookie=created.r.headers.get('set-cookie')!.split(';')[0];
 const forged=await fetch(base+'/api/profile',{method:'POST',headers:{Host:'127.0.0.1:18931',Origin:'https://evil.example','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({profile:'maker'})});assert.equal(forged.status,403);
 await request('profile',{profile:'maker'});let result=await request('command',{id:'pub',actor:'buyer',action:{type:'publish',terms:terms(Number(await f.view('clock_ms'))),fee:'2',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});assert.equal(result.value.status,'Applied',JSON.stringify(result.value));
 const edition=(await f.view('snapshot')).editions[0];assert.equal(edition.maker,'maker');await request('profile',{profile:'buyer'});
 result=await request('command',{id:'entry',action:{type:'admit',edition_id:edition.id,expected_version:'1',expected_fee:'2',loadout_ids:['buyer-club'],seed:'client-seed-ignored'}});assert.equal(result.value.status,'Applied',JSON.stringify(result.value));
 const run=(await f.view('snapshot')).runs[0];const id=run.id;const stranger=await request('session',{},'');const other=stranger.r.headers.get('set-cookie')!.split(';')[0];assert.equal((await request('runs/'+id,undefined,other)).r.status,400);
 const latency:number[]=[];let seq=0;let latest:any;const step=async(action:unknown)=>{const start=performance.now();const result=await request('runs/'+id+'/action',{id:'action-'+seq,seq,action});assert.equal(result.r.status,200,JSON.stringify(result.value));latest=result.value;seq=latest.seq;latency.push(performance.now()-start);assert.ok(latency.at(-1)!<2000,'local action response under 2s');return latest;};
 await step({type:'wait'});await step({type:'attack',enemyId:'sword'});await step({type:'attack',enemyId:'sword'});
 await step({type:'move',x:2,y:1});await step({type:'move',x:3,y:1});await step({type:'equip',itemId:'maker-sword-0'});
 await step({type:'move',x:2,y:1});await step({type:'move',x:1,y:1});await step({type:'move',x:1,y:2});await step({type:'move',x:1,y:3});
 const payload={id:'drink',seq,action:{type:'use',itemId:'maker-tonic-0'}};const drank=await request('runs/'+id+'/action',payload);assert.equal(drank.r.status,200,JSON.stringify(drank.value));const retry=await request('runs/'+id+'/action',payload);assert.deepEqual(retry.value,drank.value);seq=drank.value.seq;
 await step({type:'move',x:1,y:4});await step({type:'move',x:1,y:5});for(let x=2;x<=7;x++)await step({type:'move',x,y:5});await step({type:'extract'});await app.sync();
 const world=await f.view('snapshot');assert.equal(world.runs[0].status,'extracted');assert.equal(world.credits.buyer,'8');assert.equal(world.credits.maker,'91');assert.deepEqual(world.items.find((i:any)=>i.id==='maker-sword-0').location,{kind:'owned',profile:'buyer'});assert.equal(world.items.find((i:any)=>i.id==='maker-tonic-0').location.kind,'consumed');assert.equal(world.items.find((i:any)=>i.id==='maker-tonic-1').location.kind,'edition_fixed');
 // Fund another copy, then play a death and reconcile an operator void.
 await f.apply('restock',{actor:'maker',action:{type:'refresh',edition_id:edition.id,fixed_funding:['maker-sword-1','maker-tonic-2','maker-tonic-3'],random_funding:[]}});
 await request('profile',{profile:'p2'});
 result=await request('command',{id:'death-entry',action:{type:'admit',edition_id:edition.id,expected_version:'1',expected_fee:'2',loadout_ids:['p2-club'],seed:'0'}});assert.equal(result.value.status,'Applied');
 const doomed=(await f.view('snapshot')).runs.find((r:any)=>r.player==='p2');
 for(let n=0;n<5;n++){const result=await request('runs/'+doomed.id+'/action',{id:'wait-'+n,seq:n,action:{type:'wait'}});assert.equal(result.r.status,200,JSON.stringify(result.value));}
 await app.sync();const afterDeath=await f.view('snapshot');assert.equal(afterDeath.runs.find((r:any)=>r.id===doomed.id).status,'died');assert.equal(afterDeath.items.find((i:any)=>i.id==='p2-club').location.kind,'bank');
 await request('profile',{profile:'p3'});result=await request('command',{id:'void-entry',action:{type:'admit',edition_id:edition.id,expected_version:'1',expected_fee:'2',loadout_ids:['p3-club'],seed:'0'}});assert.equal(result.value.status,'Applied');
 const failed=(await f.view('snapshot')).runs.find((r:any)=>r.player==='p3');db.transaction(()=>runs.finish(runs.get(failed.id,'p3'),'void'));await app.sync();assert.equal((await f.view('snapshot')).credits.p3,'10');
 latency.sort((a,b)=>a-b);console.log('HTTP action response ms',JSON.stringify({samples:latency.length,min:latency[0],median:latency[Math.floor(latency.length/2)],max:latency.at(-1)}));
 console.log('HTTP played extraction: turns',seq,'; buyer credits 8; maker credits 91; sword owned; used tonic consumed; unvisited tonic returned');
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));db.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});
