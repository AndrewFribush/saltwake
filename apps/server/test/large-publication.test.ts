import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {KeyPairSigner,type KeyPairString} from 'near-api-js';
import {fixture,terms} from '../../../tests/contract/helpers';import {Store} from '../src/db';import {Outbox} from '../src/outbox';import {NearChain} from '../src/chain';import {Runs} from '../src/runs';import {httpServer} from '../src/http';
import type {AddressInfo} from 'node:net';
import {encodeCustomModule} from '../../../packages/shared/src/custom-layout';
test('HTTP publishes a large sixteen-floor command end to end while preserving bounded legacy requests',{timeout:90000},async()=>{
 const f=await fixture();const dir=mkdtempSync(join(tmpdir(),'http-game-'));const db=new Store(join(dir,'db'));const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);const box=new Outbox(db,chain);const runs=new Runs(db,box);const app=httpServer(box,runs,()=>f.view('snapshot'));await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;let cookie='';
 const request=async(path:string,body?:unknown,session=cookie)=>{const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:session},body:body===undefined?undefined:JSON.stringify(body)});const value=await r.json();return {r,value};};

 try{
 const session=await request('session',{});cookie=session.r.headers.get('set-cookie')!.split(';')[0];await request('profile',{profile:'maker'});
 const modules=Array.from({length:16},(_,i)=>encodeCustomModule({tiles:Array.from({length:31},(_,y)=>y===0||y===30?'#'.repeat(31):'#'+'.'.repeat(29)+'#'),spawn:{x:1,y:1},exit:{x:29,y:29},sockets:Array.from({length:4},(_,j)=>({x:2+j,y:2})),tuning:Array.from({length:4},(_,slot)=>({slot,trap_period:8,trap_active:4,trap_offset:0,trap_damage:2})),links:Array.from({length:4},(_,j)=>({id:String(j)+'x'.repeat(31),x:10+j,y:10,to:j===0?(i+1)%16:i,require_clear:false}))},'tuned'));
 const sockets=Array.from({length:64},(_,i)=>({id:'trap-'+i,room:Math.floor(i/4),slot:i%4,enemy:'none' as const,trap:true,reward:null}));
 const action={type:'publish' as const,terms:{...terms(Number(await f.view('clock_ms'))),rules_version:9,modules,sockets,no_reward:true},fee:'0',funding:[]};
 const body={id:'large',action};const bytes=Buffer.byteLength(JSON.stringify(body));assert.ok(bytes>32768);assert.ok(bytes<131072);const published=await request('command',body);assert.equal(published.r.status,200,JSON.stringify(published.value));if(published.value.status!=='Applied'){const signed=db.operation('maker-large')?.signed;if(signed){const tx=await f.provider.viewTransactionStatus({txHash:signed.hash,accountId:f.contractId,waitUntil:'FINAL'});console.log('FAILED_EXECUTION_STATUS='+JSON.stringify(tx.status));}}assert.equal(published.value.status,'Applied',JSON.stringify(published.value));assert.deepEqual((await f.view('snapshot')).editions[0].terms.modules,modules);const confirmed=await f.view('snapshot');
 const old=await request('command',{id:'old',action:{...action,terms:{...action.terms,rules_version:8}}});assert.equal(old.r.status,400);assert.match(old.value.error,/too large/i);
 const huge=await request('command',{id:'huge',action:{...action,terms:{...action.terms,title:'x'.repeat(131073)}}});assert.equal(huge.r.status,400);assert.match(huge.value.error,/too large/i);assert.deepEqual(await f.view('snapshot'),confirmed);assert.equal(db.operations().length,1);
 console.log('Large authored HTTP publication bytes:',bytes);
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));db.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});
