import test from 'node:test';
import {request as httpRequest} from 'node:http';
import {defaultInterior} from '../../../packages/game/src/interiors';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {Account,KeyPair,KeyPairSigner,actions,type KeyPairString} from 'near-api-js';
import {fixture,terms} from '../../../tests/contract/helpers';
import {WalletSessions} from '../src/wallet-auth';
import {Store} from '../src/db';
import {NearChain} from '../src/chain';
import {Outbox} from '../src/outbox';
import {Runs} from '../src/runs';
import {httpServer} from '../src/http';

const origin='http://127.0.0.1:18930';
test('wallet HTTP uses two real accounts and confirmed direct transactions, never operator spending',{timeout:120000},async()=>{
 const f=await fixture();const dir=mkdtempSync(join(tmpdir(),'wallet-http-'));const db=new Store(join(dir,'db'));
 let now=Date.now(),signs=0,broadcasts=0;
 const near=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);
 const box=new Outbox(db,{receipt:id=>near.receipt(id),sign:async()=>{signs++;throw Error('Operator fallback forbidden');},broadcast:async()=>{broadcasts++;throw Error('Operator fallback forbidden');}});
 let pauseKey:(()=>Promise<void>)|undefined;
 const sessions=new WalletSessions({origin,network:'local-sandbox',contractId:f.contractId,provider:{viewAccessKey:async args=>{if(pauseKey)await pauseKey();return f.provider.viewAccessKey(args);}},secureCookies:false,now:()=>now,sessionMs:60000});
 let pauseSnapshot:(()=>Promise<void>)|undefined;
 assert.throws(()=>httpServer(box,new Runs(db,box),()=>f.view('snapshot'),undefined,{walletSessions:sessions,origin,network:'wrong-network',contractId:f.contractId}),/configuration mismatch/);
 const app=httpServer(box,new Runs(db,box),async()=>{if(pauseSnapshot)await pauseSnapshot();return f.view('snapshot');},undefined,{walletSessions:sessions,origin,network:'local-sandbox',contractId:f.contractId});
 await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 const request=async(path:string,body?:unknown,cookie='')=>{const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});return {response,value:await response.json()};};
 const login=async(accountId:string,signer:KeyPairSigner)=>{
  const c=await request('wallet/challenge',{accountId});assert.equal(c.response.status,200,JSON.stringify(c.value));
  const challenge=c.value.challenge;const proof=await signer.signNep413Message(accountId,{message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')});
  const verified=await request('wallet/verify',{accountId,publicKey:proof.publicKey.toString(),signature:Buffer.from(proof.signature).toString('base64')},c.response.headers.getSetCookie()[0].split(';')[0]);assert.equal(verified.response.status,200,JSON.stringify(verified.value));
  return verified.response.headers.getSetCookie().find(v=>v.startsWith('dungeon_wallet_session='))!.split(';')[0];
 };
 const send=async(account:Account,tx:any)=>account.callFunction({contractId:tx.receiverId,methodName:tx.methodName,args:tx.args,gas:BigInt(tx.gas),deposit:BigInt(tx.deposit),waitUntil:'FINAL'});
 try{
  const people=[];
  for(const name of ['alice','bob']){
   const key=KeyPair.fromRandom('ed25519'),id=name+'.'+f.contractId;
   await f.account.signAndSendTransaction({receiverId:id,actions:[actions.createAccount(),actions.transfer(10n**25n),actions.addFullAccessKey(key.getPublicKey())],waitUntil:'FINAL'});
   people.push({id,account:new Account(id,f.provider,key.toString() as KeyPairString),signer:new KeyPairSigner(key)});
  }
  const [alice,bob]=people,ac=await login(alice.id,alice.signer),bc=await login(bob.id,bob.signer);
  const anonymous=await request('session',{});assert.equal(anonymous.response.status,401);assert.equal(anonymous.response.headers.get('set-cookie'),null);
  const before=await request('session',{},ac);assert.equal(before.value.authMode,'wallet');assert.equal(before.value.registered,false);
  for(const [person,cookie] of [[alice,ac],[bob,bc]] as const){
   const reg=await request('wallet/register',{},cookie);assert.deepEqual(reg.value.transaction,{receiverId:f.contractId,methodName:'register_player',args:{},gas:'100000000000000',deposit:'0'});
   assert.equal((await f.view('snapshot')).credits['wallet:'+person.id],undefined);
   await send(person.account,reg.value.transaction);
   assert.equal((await request('session',{},cookie)).value.registered,true);
   assert.equal((await f.view('snapshot')).credits['wallet:'+person.id],'0');
  }
  assert.equal((await request('profile',{profile:'maker'},ac)).response.status,403);
  assert.equal((await request('craft/begin',{id:'invalid-inputs',inputIds:[]},ac)).response.status,400);
  assert.equal(db.all('craft').length,0,'invalid wallet preparation persists no batch');
  const action={type:'create_shop',title:'Account shop',district:'center',x:14,y:7,interior:JSON.stringify(defaultInterior('market')),open:true};
  const body={id:'shop',actor:'wallet:'+bob.id,action};
  const prepared=await request('command',body,ac);assert.equal(prepared.response.status,200,JSON.stringify(prepared.value));assert.equal(prepared.value.status,'Unknown');
  assert.deepEqual(prepared.value.transaction,{receiverId:f.contractId,methodName:'execute_player',args:{request_id:'shop',action},gas:'100000000000000',deposit:'0'});
  assert.equal(db.operation(prepared.value.id)!.command.actor,'wallet:'+alice.id);
  assert.equal((await f.view('snapshot')).shops.length,0);
  await send(alice.account,prepared.value.transaction);
  const confirmed=await request('command',body,ac);assert.equal(confirmed.value.status,'Applied',JSON.stringify(confirmed.value));
  const aw=(await request('world',undefined,ac)).value,bw=(await request('world',undefined,bc)).value;
  assert.equal(aw.shops[0].owner,'wallet:'+alice.id);assert.ok(aw.shops[0].record);assert.equal(bw.shops[0].record,undefined);assert.equal(bw.operations.length,0);
  const other=await request('command',{...body,action:{...action,x:1}},bc);assert.notEqual(other.value.id,prepared.value.id);assert.equal(db.operation(other.value.id)!.command.actor,'wallet:'+bob.id);
  assert.equal((await request('command',{...body,action:{...action,title:'changed'}},ac)).response.status,400);
  // A late receipt for an already-terminal admission must never recreate playable state.
  const clock=Number(await f.view('clock_ms'));
  const publication=await f.call('execute',{op_id:'http-free',command:{actor:'maker',action:{type:'publish',terms:{...terms(clock),sockets:[],no_reward:true,closes_at_ms:String(clock+600000)},fee:'0',funding:[]}}});assert.equal(publication.status,'Applied');
  const admission={type:'admit',edition_id:publication.result,expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'0'};
  const admitted:any=await alice.account.callFunction({contractId:f.contractId,methodName:'execute_player',args:{request_id:'late-admit',action:admission},gas:100000000000000n,waitUntil:'FINAL'});assert.equal(admitted.status,'Applied');
  await f.call('execute',{op_id:'http-terminal',command:{actor:'wallet:'+alice.id,action:{type:'settle',run_id:admitted.result,outcome:'extracted',disposition:{town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_returned:[],dungeon_extracted:[]},carried_dungeon_ids:[]}}});
  // Background sync can discover the active run; erase that local copy to model fresh recovery.
  db.sql.prepare('DELETE FROM records WHERE kind=? AND id=?').run('run',admitted.result);
  const late=await request('command',{id:'late-admit',action:admission},ac);assert.equal(late.value.status,'Applied',JSON.stringify(late.value));
  assert.equal(db.get('run',admitted.result),undefined);assert.ok(db.get('run-terminal-seen',admitted.result));
  assert.equal((await request('runs/'+admitted.result,undefined,ac)).response.status,400);
  const evil=await fetch(base+'/api/wallet/challenge',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({accountId:alice.id})});assert.equal(evil.status,403);
  assert.equal((await request('wallet/challenge',{accountId:alice.id,padding:'x'.repeat(8192)})).response.status,400);
  // A request waiting for chain state cannot disclose a session after concurrent logout.
  let entered!:()=>void,release!:()=>void;const waiting=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);
  pauseSnapshot=async()=>{entered();await gate;};const pending=request('session',{},ac);await waiting;
  await request('wallet/logout',{},ac);pauseSnapshot=undefined;release();assert.equal((await pending).response.status,401);
  const count=db.operations().length;assert.equal((await request('command',{id:'logged-out',action},ac)).response.status,401);
  // Expire a session while the command body is still streaming: no enqueue.
  let finishBody!:()=>void;
  const delayed=new Promise<number>((resolve,reject)=>{
   const payload=JSON.stringify({id:'expired-stream',action});
   const req=httpRequest(base+'/api/command',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:bc}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode!));});
   req.on('error',reject);req.write(payload.slice(0,10));finishBody=()=>req.end(payload.slice(10));
  });
  await new Promise(r=>setTimeout(r,30));now+=60001;finishBody();assert.equal(await delayed,401);
  assert.equal((await request('command',{id:'expired',action},bc)).response.status,401);assert.equal(db.operations().length,count);
  // Logout must cancel both a pending challenge and an already-running verifier.
  const prepareLogin=async()=>{
   const c=await request('wallet/challenge',{accountId:alice.id});const ch=c.value.challenge;
   const proof=await alice.signer.signNep413Message(alice.id,{message:ch.message,recipient:ch.recipient,nonce:Buffer.from(ch.nonce,'base64')});
   return {cookie:c.response.headers.getSetCookie()[0].split(';')[0],proof:{accountId:alice.id,publicKey:proof.publicKey.toString(),signature:Buffer.from(proof.signature).toString('base64')}};
  };
  const outstanding=await prepareLogin();const loggedOut=await request('wallet/logout',{},outstanding.cookie);
  assert.ok(loggedOut.response.headers.getSetCookie().some(c=>c.startsWith('dungeon_wallet_challenge=;')),'logout clears challenge cookie');
  assert.equal((await request('wallet/verify',outstanding.proof,outstanding.cookie)).response.status,400);
  const inflight=await prepareLogin();let keyEntered!:()=>void,keyRelease!:()=>void;
  const keyWaiting=new Promise<void>(r=>keyEntered=r),keyGate=new Promise<void>(r=>keyRelease=r);
  pauseKey=async()=>{keyEntered();await keyGate;};const verifying=request('wallet/verify',inflight.proof,inflight.cookie);await keyWaiting;
  await request('wallet/logout',{},inflight.cookie);pauseKey=undefined;keyRelease();
  const cancelled=await verifying;assert.equal(cancelled.response.status,400);assert.equal(cancelled.response.headers.getSetCookie().length,0);
  assert.equal(signs,0);assert.equal(broadcasts,0);
  console.log('Actual disposable-chain HTTP: two independent NEP-413 accounts; direct registration grants zero credits; unsigned intent remains Unknown; wallet-signed execute_player confirms Applied; forged actor ignored; ownership isolated; logout/expiry reject; operator sign/broadcast calls = 0.');
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));await app.sync();db.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});

test('wallet HTTP discovers a direct v11 admission, isolates gameplay and confirms oracle-only extraction',{timeout:120000},async()=>{
 const {encodeCustomModule}=await import('../../../packages/shared/src/custom-layout');
 const f=await fixture(),dir=mkdtempSync(join(tmpdir(),'wallet-http-play-')),db=new Store(join(dir,'db'));
 const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);
 let owner='',runId='',operatorSigns=0,broadcasts=0;
 const box=new Outbox(db,{
  receipt:id=>chain.receipt(id),clock:()=>chain.clock(),
  sign:async(id,command,minNonce)=>{
   assert.equal(command.actor,owner);assert.equal(command.action.type,'settle','HTTP may sign only the terminal oracle command');
   if(command.action.type!=='settle')throw Error('Unexpected operator command');
   assert.equal(command.action.run_id,runId);assert.equal(command.action.outcome,'extracted');
   assert.deepEqual(command.action.carried_dungeon_ids,[]);
   assert.ok(Object.values(command.action.disposition).every(ids=>ids.length===0));
   operatorSigns++;return chain.sign(id,command,minNonce);
  },
  broadcast:async tx=>{broadcasts++;await chain.broadcast(tx);}
 });
 const sessions=new WalletSessions({origin,network:'local-sandbox',contractId:f.contractId,provider:f.provider,secureCookies:false});
 const snapshot=()=>f.provider.callFunction<any>({contractId:f.contractId,method:'snapshot',args:{},blockQuery:{finality:'final'}});
 const app=httpServer(box,new Runs(db,box),snapshot,undefined,{walletSessions:sessions,origin,network:'local-sandbox',contractId:f.contractId});
 await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 const request=async(path:string,cookie:string,body?:unknown)=>{
  const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,value:await response.json(),cookies:response.headers.getSetCookie()};
 };
 try{
  const people=[];
  for(const name of ['player','stranger']){
   const key=KeyPair.fromRandom('ed25519'),id=name+'.'+f.contractId,signer=new KeyPairSigner(key);
   await f.account.signAndSendTransaction({receiverId:id,actions:[actions.createAccount(),actions.transfer(10n**25n),actions.addFullAccessKey(key.getPublicKey())],waitUntil:'FINAL'});
   const account=new Account(id,f.provider,key.toString() as KeyPairString);
   const begun=await request('wallet/challenge','',{accountId:id});assert.equal(begun.status,200);
   const c=begun.value.challenge,proof=await signer.signNep413Message(id,{message:c.message,recipient:c.recipient,nonce:Buffer.from(c.nonce,'base64')});
   const verified=await request('wallet/verify',begun.cookies[0].split(';')[0],{accountId:id,publicKey:proof.publicKey.toString(),signature:Buffer.from(proof.signature).toString('base64')});assert.equal(verified.status,200);
   const cookie=verified.cookies.find(c=>c.startsWith('dungeon_wallet_session='))!.split(';')[0];
   const registration=await request('wallet/register',cookie,{});assert.equal(registration.status,200);const tx=registration.value.transaction;
   await account.callFunction({contractId:tx.receiverId,methodName:tx.methodName,args:tx.args,gas:BigInt(tx.gas),deposit:BigInt(tx.deposit),waitUntil:'FINAL'});
   assert.equal((await request('session',cookie,{})).value.registered,true);
   people.push({id,account,cookie});
  }
  const [player,stranger]=people;owner='wallet:'+player.id;
  const module=encodeCustomModule({tiles:['#####','#...#','#...#','#...#','#####'],spawn:{x:1,y:1},exit:{x:2,y:1},sockets:[],tuning:[],devices:[],exit_rule:{extract:true,require_clear:false}},'missions');
  const published=await f.call('execute',{op_id:'http-gameplay-publish',command:{actor:'maker',action:{type:'publish',terms:{...terms(Number(await chain.clock())),rules_version:11,modules:[module],sockets:[],no_reward:true},fee:'0',funding:[]}}});assert.equal(published.status,'Applied');
  // Intentionally bypass /api/command: no local admission intent or receipt ingestion.
  const admitted=await player.account.callFunction<any>({contractId:f.contractId,methodName:'execute_player',args:{request_id:'external-gameplay-entry',action:{type:'admit',edition_id:published.result,expected_version:'1',expected_fee:'0',loadout_ids:[],seed:'0'}},gas:100000000000000n,waitUntil:'FINAL'});
  assert.equal(admitted.status,'Applied');runId=admitted.result;assert.equal(db.operation(admitted.op_id),undefined);
  const world=await request('world',player.cookie);assert.equal(world.status,200,JSON.stringify(world.value));
  const run=world.value.runs.find((r:any)=>r.id===runId);assert.ok(run,'GET world discovers directly admitted wallet run');assert.equal(run.profile,owner);assert.equal(run.seq,0);
  assert.deepEqual(run.state.exitRule,{extract:true,require_clear:false});
  assert.equal(db.get<{admissionSource:string}>('run',runId)!.admissionSource,'chain-discovery');
  assert.equal(operatorSigns,0);assert.equal(broadcasts,0);assert.equal(db.operations().length,0);
  const foreignWorld=await request('world',stranger.cookie);assert.equal(foreignWorld.status,200);assert.deepEqual(foreignWorld.value.runs,[]);
  const deniedRead=await request('runs/'+runId,stranger.cookie);assert.equal(deniedRead.status,400);assert.match(deniedRead.value.error,/owner mismatch/i);
  const deniedAction=await request('runs/'+runId+'/action',stranger.cookie,{id:'foreign-step',seq:0,action:{type:'move',x:2,y:1}});assert.equal(deniedAction.status,400);assert.match(deniedAction.value.error,/owner mismatch/i);
  const unchanged=await request('runs/'+runId,player.cookie);assert.equal(unchanged.status,200);assert.equal(unchanged.value.seq,0);assert.equal(unchanged.value.state.player.x,1);
  const moved=await request('runs/'+runId+'/action',player.cookie,{id:'owner-step',seq:0,action:{type:'move',x:2,y:1}});assert.equal(moved.status,200,JSON.stringify(moved.value));assert.equal(moved.value.seq,1);assert.equal(moved.value.canExtract,true);
  const extracted=await request('runs/'+runId+'/action',player.cookie,{id:'owner-extract',seq:1,action:{type:'extract'}});assert.equal(extracted.status,200,JSON.stringify(extracted.value));assert.equal(extracted.value.state.status,'extracted');
  const settledWorld=await request('world',player.cookie);assert.equal(settledWorld.status,200,JSON.stringify(settledWorld.value));
  const settled=settledWorld.value.runs.find((r:any)=>r.id===runId);assert.equal(settled.terminal,'extracted');assert.equal(settled.settlement.status,'Applied');
  const final=await snapshot();assert.equal(final.runs.find((r:any)=>r.id===runId).status,'extracted');assert.equal(final.credits[owner],'0');assert.equal(final.editions[0].active_runs.length,0);
  assert.equal(operatorSigns,1);assert.equal(broadcasts,1);assert.equal(db.operations().length,1);assert.equal(db.operations()[0].status,'Applied');
  assert.equal(db.operation(admitted.op_id),undefined,'discovery never fabricates a local player admission operation');
  await request('world',player.cookie);assert.equal(operatorSigns,1,'subsequent HTTP sync does not sign settlement again');
  console.log('Actual wallet HTTP gameplay: two independent authenticated registered accounts; direct v11 free/no-stock admission; GET world discovery; foreign GET/action denied; owner move/extract; final chain settlement Applied; exactly one operator signature/broadcast, bound to owner terminal settlement.');
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));await app.sync();db.close();rmSync(dir,{recursive:true,force:true});await f.sandbox.tearDown();}
});
