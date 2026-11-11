import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {Account,KeyPair,KeyPairSigner,actions,type KeyPairString} from 'near-api-js';
import {extendedFixture,inputs} from '../../../tests/contract/extended-fixture';
import {playerOperationId} from '../../../packages/shared/src/player-identity';
import {commandHash} from '../../../packages/shared/src/protocol';
import {CRAFT_STEPS} from '../../../packages/game/src/craft';
import {WalletSessions} from '../src/wallet-auth';
import {Store} from '../src/db';
import {NearChain} from '../src/chain';
import {Outbox} from '../src/outbox';
import {Runs} from '../src/runs';
import {httpServer} from '../src/http';

const origin='http://127.0.0.1:18930';
test('actual wallet HTTP recovery: prepared signing, persisted challenge gameplay, oracle settlement and unprepared expiry',{timeout:150000},async()=>{
 const f=await extendedFixture(),dir=mkdtempSync(join(tmpdir(),'wallet-craft-http-')),path=join(dir,'db');let db=new Store(path);
 const signer=KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),operator=new Account(f.contractId,f.provider,f.genesis.privateKey as KeyPairString);
 const near=new NearChain(f.provider,signer,f.contractId,f.contractId);
 let playerProfile='',operatorSigns=0,broadcasts=0;const terminalBatches:string[]=[];
 const chain={receipt:(id:string)=>near.receipt(id),clock:()=>near.clock(),sign:async(...args:Parameters<NearChain['sign']>)=>{
  const [id,command]=args;assert.ok(id.length<=64,'terminal operation IDs remain bounded');assert.equal(command.actor,playerProfile);assert.equal(command.action.type,'finish_recovery','only oracle terminal actions may be operator-signed');
  if(command.action.type!=='finish_recovery')throw Error('Unexpected operator action');terminalBatches.push(command.action.batch_id);operatorSigns++;return near.sign(...args);
 },broadcast:async(...args:Parameters<NearChain['broadcast']>)=>{broadcasts++;return near.broadcast(...args);}};
 const sessions=new WalletSessions({origin,network:'local-sandbox',contractId:f.contractId,provider:f.provider,secureCookies:false});
 const make=()=>{const box=new Outbox(db,chain);return httpServer(box,new Runs(db,box),()=>f.view(),undefined,{walletSessions:sessions,origin,network:'local-sandbox',contractId:f.contractId});};
 let app=make(),base='';const listen=async()=>{await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;};await listen();
 const request=async(route:string,cookie:string,body?:unknown)=>{
  const response=await fetch(base+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,value:await response.json(),cookies:response.headers.getSetCookie()};
 };
 const restart=async()=>{await new Promise<void>(r=>app.server.close(()=>r()));await app.sync();db.close();db=new Store(path);app=make();await listen();};
 try{
  const key=KeyPair.fromRandom('ed25519'),accountId='crafter.'+f.contractId;
  await operator.signAndSendTransaction({receiverId:accountId,actions:[actions.createAccount(),actions.transfer(10n**25n),actions.addFullAccessKey(key.getPublicKey())],waitUntil:'FINAL'});
  const player=new Account(accountId,f.provider,key.toString() as KeyPairString),wallet=new KeyPairSigner(key);playerProfile='wallet:'+accountId;
  const challenge=await request('wallet/challenge','',{accountId});assert.equal(challenge.status,200);const c=challenge.value.challenge;
  const proof=await wallet.signNep413Message(accountId,{message:c.message,recipient:c.recipient,nonce:Buffer.from(c.nonce,'base64')});
  const verified=await request('wallet/verify',challenge.cookies[0].split(';')[0],{accountId,publicKey:proof.publicKey.toString(),signature:Buffer.from(proof.signature).toString('base64')});assert.equal(verified.status,200);
  const cookie=verified.cookies.find(c=>c.startsWith('dungeon_wallet_session='))!.split(';')[0];
  const registration=await request('wallet/register',cookie,{});assert.equal(registration.status,200);
  const send=(tx:any)=>player.callFunction<any>({contractId:tx.receiverId,methodName:tx.methodName,args:tx.args,gas:BigInt(tx.gas),deposit:BigInt(tx.deposit),waitUntil:'FINAL'});
  await send(registration.value.transaction);assert.equal((await request('session',cookie,{})).value.registered,true);assert.equal((await f.view()).credits[playerProfile],'0');

  const requestId='prepared-recovery',batchId=playerOperationId(accountId,requestId),body={id:requestId,inputIds:inputs('bank'),recovery:true};
  const prepared=await request('craft/begin',cookie,body);assert.equal(prepared.status,200,JSON.stringify(prepared.value));assert.equal(prepared.value.id,batchId);assert.equal(prepared.value.challengeAvailable,true);assert.equal(prepared.value.status,'pending');
  const tx=prepared.value.transaction,action=tx.args.action;
  assert.deepEqual(tx,{receiverId:f.contractId,methodName:'execute_player',args:{request_id:requestId,action:{type:'begin_recovery',batch_id:batchId,bank_input_ids:inputs('bank'),challenge_commitment:action.challenge_commitment,deadline_ms:'0'}},gas:'100000000000000',deposit:'0'});
  assert.match(action.challenge_commitment,/^[a-f0-9]{64}$/);assert.equal((await f.view()).batches.length,0);assert.equal(operatorSigns,0);assert.equal(broadcasts,0);
  const retry=await request('craft/begin',cookie,body);assert.deepEqual(retry.value.transaction,tx,'preparation retry preserves exact commitment and payload');
  const admitted=await send(tx);assert.equal(admitted.status,'Applied');assert.equal(admitted.op_id,batchId);assert.equal(admitted.payload_hash,commandHash({actor:playerProfile,action}));
  const active=await request('world',cookie);assert.equal(active.status,200,JSON.stringify(active.value));assert.equal(active.value.craft.status,'active');assert.equal(active.value.craft.challengeAvailable,true);
  const effectiveDeadline=(await f.view()).batches.find((b:any)=>b.id===batchId).deadline_ms;assert.equal(String(active.value.craft.deadlineMs),effectiveDeadline);assert.ok(Number(effectiveDeadline)>0);assert.equal(operatorSigns,0);
  const first=await request('craft/start',cookie,{batch:batchId,id:'start-0',seq:0,step:0});assert.equal(first.status,200,JSON.stringify(first.value));assert.equal(first.value.seq,1);
  await restart();const recovered=await request('world',cookie);assert.equal(recovered.status,200);assert.equal(recovered.value.craft.startedAtMs,first.value.startedAtMs);assert.equal(recovered.value.craft.seq,1);assert.equal(recovered.value.craft.challengeAvailable,true);
  let seq=1;
  for(let step=0;step<CRAFT_STEPS;step++){
   if(step>0){const start=await request('craft/start',cookie,{batch:batchId,id:'start-'+step,seq,step});assert.equal(start.status,200,JSON.stringify(start.value));seq=start.value.seq;}
   const input=await request('craft/input',cookie,{batch:batchId,id:'input-'+step,seq,step});assert.equal(input.status,200,JSON.stringify(input.value));seq=input.value.seq;
  }
  const finished=await request('world',cookie);assert.equal(finished.status,200,JSON.stringify(finished.value));assert.equal(finished.value.craft.status,'finished');assert.equal(finished.value.craft.reason,'completed');assert.equal(finished.value.craft.outputIds.length,2);
  let world=await f.view();const firstBatch=world.batches.find((b:any)=>b.id===batchId);assert.equal(firstBatch.status,'finished');assert.equal(world.credits[playerProfile],'2');assert.equal(firstBatch.wage_reserved,'0');
  for(const id of firstBatch.output_ids)assert.deepEqual(world.items.find((i:any)=>i.id===id).location,{kind:'bank'});
  assert.equal(operatorSigns,1);assert.equal(broadcasts,1);assert.deepEqual(terminalBatches,[batchId]);
  await restart();assert.equal((await request('world',cookie)).value.craft.status,'finished');assert.equal(operatorSigns,1);assert.deepEqual(await send(tx),admitted,'start replay after terminal does not restart batch');

  // Submit a valid batch with no HTTP preparation and no recoverable challenge.
  const directRequest='unprepared-recovery',directId=playerOperationId(accountId,directRequest),directAction={type:'begin_recovery',batch_id:directId,bank_input_ids:inputs('bank',2),challenge_commitment:'ab'.repeat(32),deadline_ms:'0'};
  const direct=await player.callFunction<any>({contractId:f.contractId,methodName:'execute_player',args:{request_id:directRequest,action:directAction},gas:100000000000000n,waitUntil:'FINAL'});assert.equal(direct.status,'Applied');assert.equal(db.operation(directId),undefined);
  const discovered=await request('world',cookie);assert.equal(discovered.status,200,JSON.stringify(discovered.value));assert.equal(discovered.value.craft.id,directId);assert.equal(discovered.value.craft.status,'active');assert.equal(discovered.value.craft.challengeAvailable,false);
  const blocked=await request('craft/start',cookie,{batch:directId,id:'no-fake-challenge',seq:0,step:0});assert.equal(blocked.status,400);assert.match(blocked.value.error,/challenge unavailable/);assert.equal(operatorSigns,1);
  await restart();assert.equal((await request('world',cookie)).value.craft.challengeAvailable,false);
  world=await f.view();const directDeadline=world.batches.find((b:any)=>b.id===directId).deadline_ms;
  await f.advance(directDeadline);
  const expired=await request('world',cookie);assert.equal(expired.status,200,JSON.stringify(expired.value));assert.equal(expired.value.craft.status,'finished');assert.equal(expired.value.craft.reason,'expired');assert.equal(expired.value.craft.tier,'normal');
  world=await f.view();const finalBatch=world.batches.find((b:any)=>b.id===directId);assert.equal(finalBatch.status,'finished');assert.equal(finalBatch.wage_reserved,'0');assert.equal(world.credits[playerProfile],'4');assert.equal(world.recovery.budget,'2');
  for(const id of directAction.bank_input_ids)assert.equal(world.items.find((i:any)=>i.id===id).location.kind,'consumed');
  for(const id of finalBatch.output_ids){const item=world.items.find((i:any)=>i.id===id);assert.equal(item.item_type,'tonic');assert.deepEqual(item.location,{kind:'bank'});}
  assert.equal(operatorSigns,2);assert.equal(broadcasts,2);assert.deepEqual(terminalBatches,[batchId,directId]);assert.equal(db.operation(directId),undefined,'discovery never fabricates a start receipt');
  const terminals=db.operations().filter(o=>o.command.action.type==='finish_recovery');assert.equal(terminals.length,2);assert.ok(terminals.every(o=>o.status==='Applied'&&o.id.length<=64));
  await restart();assert.equal((await request('world',cookie)).value.craft.status,'finished');assert.equal(operatorSigns,2);
  console.log('Wallet craft HTTP actual chain: real NEP413 login/register; immutable prepared zero-deadline transaction; wallet-only start; active challenge survives restart mid-step; HTTP gameplay settles; direct unknown batch is discovered without challenge, survives restart, expires on chain clock to normal; two bounded oracle terminal signatures/broadcasts, no operator starts; wages 4, remaining recovery budget 2.');
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));await app.sync();db.close();rmSync(dir,{recursive:true,force:true});await f.close();}
});
