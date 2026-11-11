import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {AddressInfo} from 'node:net';
import {Account,KeyPair,KeyPairSigner,actions,type KeyPairString} from 'near-api-js';
import {extendedFixture,inputs} from '../../../tests/contract/extended-fixture';
import {WalletTransport,type InjectedWalletAdapter,type WalletPost} from '../../web/src/wallet-transport';
import {WalletSessions} from '../src/wallet-auth';
import {Store} from '../src/db';
import {NearChain} from '../src/chain';
import {Outbox} from '../src/outbox';
import {Runs} from '../src/runs';
import {httpServer} from '../src/http';

test('browser transport against real HTTP/chain signs login and crafting, then reconciles a lost approval after reload',{timeout:120000},async()=>{
 const f=await extendedFixture(),dir=mkdtempSync(join(tmpdir(),'browser-wallet-loop-')),db=new Store(join(dir,'db'));
 const config={origin:'http://127.0.0.1:18930',network:'local-sandbox',contractId:f.contractId};
 const chain=new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId);
 const box=new Outbox(db,chain),sessions=new WalletSessions({...config,provider:f.provider,secureCookies:false});
 const app=httpServer(box,new Runs(db,box),()=>f.view(),undefined,{...config,walletSessions:sessions});
 await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(app.server.address() as AddressInfo).port;
 const cookies=new Map<string,string>();
 const request=async(path:string,body?:unknown)=>{
  const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:config.origin,'Content-Type':'application/json',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},body:body===undefined?undefined:JSON.stringify(body)});
  for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],at=pair.indexOf('=');if(/Max-Age=0(?:;|$)/i.test(cookie))cookies.delete(pair.slice(0,at));else cookies.set(pair.slice(0,at),pair.slice(at+1));}
  const value=await response.json();if(!response.ok)throw Error(value.error);return value;
 };
 const post:WalletPost=(path,body)=>request(path,body);
 try{
  const key=KeyPair.fromRandom('ed25519'),accountId='browser.'+f.contractId,signer=new KeyPairSigner(key),root=new Account(f.contractId,f.provider,f.genesis.privateKey as KeyPairString);
  await root.signAndSendTransaction({receiverId:accountId,actions:[actions.createAccount(),actions.transfer(10n**25n),actions.addFullAccessKey(key.getPublicKey())],waitUntil:'FINAL'});
  const player=new Account(accountId,f.provider,key.toString() as KeyPairString);let approvals=0,proofs=0,loseResponse=false;
  const adapter:InjectedWalletAdapter={identity:()=>({accountId,network:config.network,revision:0}),signMessage:async value=>{proofs++;const proof=await signer.signNep413Message(accountId,{message:value.message,recipient:value.recipient,nonce:value.nonce});return {accountId,publicKey:proof.publicKey.toString(),signature:Buffer.from(proof.signature).toString('base64')};},approveTransaction:async value=>{
   assert.equal(value.accountId,accountId);assert.equal(value.network,config.network);assert.equal(value.transaction.receiverId,f.contractId);approvals++;
   const tx=value.transaction;await player.callFunction({contractId:tx.receiverId,methodName:tx.methodName,args:tx.args,gas:BigInt(tx.gas),deposit:BigInt(tx.deposit),waitUntil:'FINAL'});
   if(loseResponse){loseResponse=false;throw Error('Simulated lost response after confirmed broadcast');}
   return {status:'submitted',accountId,network:config.network};
  }};
  const journal=new Map<string,string>(),storage={getItem:(k:string)=>journal.get(k)??null,setItem:(k:string,v:string)=>{journal.set(k,v)}};
  let transport=new WalletTransport(config,adapter,post,Date.now,storage);
  assert.equal((await request('config')).authMode,'wallet');
  await transport.login();await transport.register();assert.equal(proofs,1);assert.equal(approvals,1);
  const started=await transport.beginCraft('recover',inputs('bank'),true);assert.equal(started.status,'Applied');assert.equal(approvals,2);
  let world=await request('world');assert.equal(world.craft.status,'active');assert.equal(world.craft.challengeAvailable,true);
  for(let step=0;step<3;step++){
   let craft=await request('craft/start',{batch:world.craft.id,id:'start'+step,seq:step*2,step});
   craft=await request('craft/input',{batch:world.craft.id,id:'input'+step,seq:craft.seq,step});
  }
  world=await request('world');assert.equal(world.craft.status,'finished');assert.equal(world.credits,'2');
  // This player owns no tradable goods yet. A deliberately rejected immutable
  // listing still creates a real authoritative receipt and tests lost-response recovery.
  const action={type:'list' as const,item_ids:['maker-tonic-0'],unit_price:'1'};loseResponse=true;
  await assert.rejects(transport.execute('lost-response',action),/Simulated lost response/);assert.equal(approvals,3);
  transport=new WalletTransport(config,adapter,post,Date.now,storage);await transport.resume();
  const recovered=await transport.execute('lost-response',action);assert.equal(recovered.status,'Rejected');assert.equal(recovered.result,'UnownedItem');assert.equal(approvals,3);assert.equal(proofs,1);
  const replay=await transport.beginCraft('recover',inputs('bank'),true);assert.equal(replay.status,'Applied');assert.equal(approvals,3);
  assert.equal((await request('world')).credits,'2');
  await transport.logout();await assert.rejects(transport.resume(),/session|sign|auth/i);
  console.log('Real local HTTP+WASM transport: NEP413 login, registration, prepared recovery approval, minigame settlement/wage, reload after broadcast response loss, exact receipt recovery without another approval, and settled craft replay. Test-only local signer adapter; not browser wallet SDK acceptance.');
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));await app.sync();db.close();rmSync(dir,{recursive:true,force:true});await f.close();}
});
