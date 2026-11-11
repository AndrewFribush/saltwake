import test from 'node:test';
import assert from 'node:assert/strict';
import type {ChildProcess} from 'node:child_process';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,KeyPair,KeyPairSigner,actions,type KeyPairString} from 'near-api-js';
import {WalletSessions,type WalletProof} from '../src/wallet-auth';

const origin='http://127.0.0.1:18930';
const cookie=(value:string)=>value.split(';')[0];

test('NEP-413 ownership uses actual final access keys on a disposable chain',{timeout:90000},async t=>{
 // createDefault reuses one key for every account; independent keys are essential here.
 const genesis=(id:string)=>{const key=KeyPair.fromRandom('ed25519');return new GenesisAccount(id,key.getPublicKey().toString(),key.toString(),10n**27n);};
 const alice=genesis('auth-alice'),bob=genesis('auth-bob');
 assert.notEqual(alice.publicKey,bob.publicKey);
 const sandbox=await Sandbox.start({config:{additionalAccounts:[alice,bob]}});
 try{
  const provider=new JsonRpcProvider({url:sandbox.rpcUrl});
  const account=new Account(alice.accountId,provider,alice.privateKey as KeyPairString);
  const aliceSigner=KeyPairSigner.fromSecretKey(alice.privateKey as KeyPairString);
  const bobSigner=KeyPairSigner.fromSecretKey(bob.privateKey as KeyPairString);
  const restricted=KeyPair.fromRandom('ed25519'),revocable=KeyPair.fromRandom('ed25519');
  const added=await account.signAndSendTransaction({receiverId:alice.accountId,actions:[actions.addFunctionCallAccessKey(restricted.getPublicKey(),alice.accountId,['execute_player']),actions.addFullAccessKey(revocable.getPublicKey())],waitUntil:'FINAL'});
  assert.equal(added.final_execution_status,'FINAL');
  const calls:Parameters<JsonRpcProvider['viewAccessKey']>[0][]=[];
  const auth=new WalletSessions({origin,network:'local-sandbox',contractId:alice.accountId,secureCookies:false,provider:{viewAccessKey:async args=>{
   calls.push(args);assert.deepEqual(args.finalityQuery,{finality:'final'});
   return provider.viewAccessKey(args);
  }}});
  const signed=async(challenge:ReturnType<WalletSessions['begin']>['challenge'],signer:KeyPairSigner):Promise<WalletProof>=>{
   const result=await signer.signNep413Message(challenge.accountId,{message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')});
   return {accountId:result.accountId,publicKey:result.publicKey.toString(),signature:Buffer.from(result.signature).toString('base64')};
  };

  await t.test('account full-access key authenticates, cookie owns only that account, and replay rejects',async()=>{
   const b=auth.begin(alice.accountId,origin),proof=await signed(b.challenge,aliceSigner);
   const key=await provider.viewAccessKey({accountId:alice.accountId,publicKey:proof.publicKey,finalityQuery:{finality:'final'}});
   assert.equal(key.permission,'FullAccess');
   const result=await auth.finish(cookie(b.setCookie),origin,proof);
   assert.equal(result.session.accountId,alice.accountId);
   assert.equal(auth.requireProfile(cookie(result.setCookies[1])),`wallet:${alice.accountId}`);
   assert.equal(calls.at(-1)!.accountId,alice.accountId);
   assert.equal(calls.at(-1)!.publicKey,proof.publicKey);
   await assert.rejects(auth.finish(cookie(b.setCookie),origin,proof),/INVALID_CHALLENGE/);
   auth.destroy(cookie(result.setCookies[1]));
   assert.throws(()=>auth.get(cookie(result.setCookies[1])),/UNAUTHENTICATED/);
  });

  await t.test('valid signature from another account key cannot claim Alice',async()=>{
   const b=auth.begin(alice.accountId,origin),proof=await signed(b.challenge,bobSigner);
   assert.equal((await provider.viewAccessKey({accountId:bob.accountId,publicKey:proof.publicKey,finalityQuery:{finality:'final'}})).permission,'FullAccess');
   await assert.rejects(provider.viewAccessKey({accountId:alice.accountId,publicKey:proof.publicKey,finalityQuery:{finality:'final'}}));
   await assert.rejects(auth.finish(cookie(b.setCookie),origin,proof),/INVALID_PROOF/);
   assert.equal(calls.at(-1)!.accountId,alice.accountId);
  });

  await t.test('an existing function-call-only key cannot authenticate',async()=>{
   const b=auth.begin(alice.accountId,origin),proof=await signed(b.challenge,new KeyPairSigner(restricted));
   const key=await provider.viewAccessKey({accountId:alice.accountId,publicKey:proof.publicKey,finalityQuery:{finality:'final'}});
   assert.equal(typeof key.permission,'object');
   assert.ok('FunctionCall' in (key.permission as object));
   await assert.rejects(auth.finish(cookie(b.setCookie),origin,proof),/INVALID_PROOF/);
  });

  await t.test('a full-access key revoked after signing is rejected at final verification',async()=>{
   const b=auth.begin(alice.accountId,origin),proof=await signed(b.challenge,new KeyPairSigner(revocable));
   assert.equal((await provider.viewAccessKey({accountId:alice.accountId,publicKey:proof.publicKey,finalityQuery:{finality:'final'}})).permission,'FullAccess');
   const removed=await account.signAndSendTransaction({receiverId:alice.accountId,actions:[actions.deleteKey(revocable.getPublicKey())],waitUntil:'FINAL'});
   assert.equal(removed.final_execution_status,'FINAL');
   await assert.rejects(provider.viewAccessKey({accountId:alice.accountId,publicKey:proof.publicKey,finalityQuery:{finality:'final'}}));
   await assert.rejects(auth.finish(cookie(b.setCookie),origin,proof),/INVALID_PROOF/);
  });
  assert.equal(calls.length,4,'every fresh proof checks its real account key at finality');
 }finally{
  // Only the ephemeral child created above is eligible for forced cleanup.
  const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;
  const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);
  try{await sandbox.tearDown();}finally{clearTimeout(timer);}
 }
});
