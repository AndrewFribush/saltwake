import test from 'node:test';import assert from 'node:assert/strict';
import {KeyPair,KeyPairSigner} from 'near-api-js';
import {WalletSessions,walletProfile} from '../src/wallet-auth';
const origin='http://127.0.0.1:18930',account='alice.testnet';
const signer=()=>new KeyPairSigner(KeyPair.fromRandom('ed25519'));
const cookie=(s:string)=>s.split(';')[0];
const setup=(extra:Record<string,unknown>={})=>{
 const calls:any[]=[];const provider={viewAccessKey:async(args:any)=>{calls.push(args);return {permission:'FullAccess',nonce:0};}};
 return {calls,auth:new WalletSessions({origin,network:'local-sandbox',contractId:'game.testnet',provider:provider as any,secureCookies:false,...extra})};
};
async function proof(challenge:ReturnType<WalletSessions['begin']>['challenge'],key=signer()){
 const signed=await key.signNep413Message(challenge.accountId,{message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')});
 return {accountId:signed.accountId,publicKey:signed.publicKey.toString(),signature:Buffer.from(signed.signature).toString('base64')};
}
test('wallet sign-in verifies standard signatures at finality, binds account and creates no demo claim',async()=>{
 const {auth,calls}=setup(),b=auth.begin(account,origin),p=await proof(b.challenge);
 const r=await auth.finish(cookie(b.setCookie),origin,p),sessionCookie=cookie(r.setCookies[1]);
 assert.equal(r.session.profileId,'wallet:alice.testnet');assert.equal(r.session.accountId,account);
 assert.deepEqual(calls[0].finalityQuery,{finality:'final'});assert.equal(calls[0].accountId,account);
 assert.match(b.setCookie,/HttpOnly; SameSite=Strict/);assert.match(r.setCookies[0],/Max-Age=0/);
 assert.equal(auth.requireProfile(sessionCookie),walletProfile(account));
 r.session.profileId='maker';assert.equal(auth.requireProfile(sessionCookie),'wallet:alice.testnet');
 assert.throws(()=>auth.get(sessionCookie+'; '+sessionCookie),/UNAUTHENTICATED/);
 auth.destroy(sessionCookie);assert.throws(()=>auth.get(sessionCookie),/UNAUTHENTICATED/);
});
test('changed signed fields, another account, missing binding and cross-origin proofs reject',async()=>{
 for(const field of ['message','recipient','nonce','accountId']){
  const {auth}=setup(),b=auth.begin(account,origin),changed={...b.challenge,[field]:field==='nonce'?Buffer.alloc(32).toString('base64'):field==='accountId'?'bob.testnet':'changed'};
  const p=await proof(changed);await assert.rejects(auth.finish(cookie(b.setCookie),origin,p),/INVALID_PROOF/);
  await assert.rejects(auth.finish(cookie(b.setCookie),origin,p),/INVALID_CHALLENGE/);
 }
 const {auth}=setup(),b=auth.begin(account,origin),p=await proof(b.challenge);
 await assert.rejects(auth.finish(undefined,origin,p),/INVALID_CHALLENGE/);
 await assert.rejects(auth.finish(cookie(b.setCookie),'https://attacker.example',p),/WRONG_ORIGIN/);
 assert.throws(()=>auth.begin(account,'https://attacker.example'),/WRONG_ORIGIN/);
 const other=auth.begin(account,origin);await assert.rejects(auth.finish(cookie(other.setCookie),origin,p),/INVALID_PROOF/);
});
test('concurrent replay consumes the challenge before asynchronous key verification',async()=>{
 let release!:()=>void;const wait=new Promise<void>(r=>release=r);
 const {auth}=setup({provider:{viewAccessKey:async()=>{await wait;return {permission:'FullAccess',nonce:0};}}});
 const b=auth.begin(account,origin),p=await proof(b.challenge),first=auth.finish(cookie(b.setCookie),origin,p);
 await assert.rejects(auth.finish(cookie(b.setCookie),origin,p),/INVALID_CHALLENGE/);release();await first;
 await assert.rejects(auth.finish(cookie(b.setCookie),origin,p),/INVALID_CHALLENGE/);
});
test('restricted, absent and revoked keys cannot authenticate',async()=>{
 for(const permission of [{FunctionCall:{receiver_id:'game.testnet',method_names:['execute_player'],allowance:null}},null]){
  const {auth}=setup({provider:{viewAccessKey:async()=>{if(permission===null)throw Error('unknown key');return {permission,nonce:0};}}});
  const b=auth.begin(account,origin);await assert.rejects(auth.finish(cookie(b.setCookie),origin,await proof(b.challenge)),/INVALID_PROOF/);
 }
});
test('expiry is checked after asynchronous verification and sessions expire independently',async()=>{
 let now=10000;
 const {auth}=setup({now:()=>now,challengeMs:1000,provider:{viewAccessKey:async()=>{now+=1000;return {permission:'FullAccess',nonce:0};}}});
 const b=auth.begin(account,origin);await assert.rejects(auth.finish(cookie(b.setCookie),origin,await proof(b.challenge)),/EXPIRED_CHALLENGE/);
 const normal=setup({now:()=>now,sessionMs:1000}).auth,c=normal.begin(account,origin),r=await normal.finish(cookie(c.setCookie),origin,await proof(c.challenge));now+=1000;
 assert.throws(()=>normal.get(cookie(r.setCookies[1])),/UNAUTHENTICATED/);
 const expired=normal.begin(account,origin);now+=120000;await assert.rejects(normal.finish(cookie(expired.setCookie),origin,await proof(expired.challenge)),/INVALID_CHALLENGE/);
});
test('challenge replacement, capacities, configuration and restart fail closed',async()=>{
 const {auth}=setup({capacity:1}),b=auth.begin(account,origin);
 assert.throws(()=>auth.begin('bob.testnet',origin),/CHALLENGE_CAPACITY/);
 const next=auth.begin(account,origin,cookie(b.setCookie));
 await assert.rejects(auth.finish(cookie(b.setCookie),origin,await proof(b.challenge)),/INVALID_CHALLENGE/);
 const result=await auth.finish(cookie(next.setCookie),origin,await proof(next.challenge));
 const full=auth.begin(account,origin);await assert.rejects(auth.finish(cookie(full.setCookie),origin,await proof(full.challenge)),/SESSION_CAPACITY/);
 assert.throws(()=>setup().auth.get(cookie(result.setCookies[1])),/UNAUTHENTICATED/);
 for(const bad of ['maker:wallet','A.testnet','a..near','-alice','a'])assert.throws(()=>walletProfile(bad),/INVALID_ACCOUNT/);
 assert.throws(()=>setup({origin:'http://public.example',secureCookies:false}),/local-only/);
 assert.throws(()=>setup({challengeMs:Infinity}),/limits/);
});
test('in-flight verifications retain capacity after response timeout until the RPC actually settles',async()=>{
 let release!:()=>void;const waiting=new Promise<void>(r=>release=r);let lookups=0;
 const {auth}=setup({capacity:1,verificationMs:20,provider:{viewAccessKey:async()=>{lookups++;await waiting;return {permission:'FullAccess',nonce:0};}}});
 const b=auth.begin(account,origin),p=await proof(b.challenge),pending=auth.finish(cookie(b.setCookie),origin,p);
 assert.throws(()=>auth.begin(account,origin),/CHALLENGE_CAPACITY/);
 await assert.rejects(pending,/INVALID_PROOF/);
 assert.throws(()=>auth.begin(account,origin),/CHALLENGE_CAPACITY/,'response timeout cannot release a still-running RPC slot');
 assert.equal(lookups,1);release();await new Promise(r=>setImmediate(r));
 assert.doesNotThrow(()=>auth.begin(account,origin));assert.throws(()=>auth.get(cookie(b.setCookie)),/UNAUTHENTICATED/);
});
test('logout cancels unused and in-flight login proofs and their just-issued sessions',async()=>{
 const first=setup().auth,b=first.begin(account,origin),p=await proof(b.challenge);assert.equal(first.logout(cookie(b.setCookie)).length,2);await assert.rejects(first.finish(cookie(b.setCookie),origin,p),/INVALID_CHALLENGE/);
 let release!:()=>void;const wait=new Promise<void>(r=>release=r),auth=setup({provider:{viewAccessKey:async()=>{await wait;return {permission:'FullAccess',nonce:0};}}}).auth;
 const c=auth.begin(account,origin),signed=await proof(c.challenge),pending=auth.finish(cookie(c.setCookie),origin,signed);
 auth.logout(cookie(c.setCookie));release();await assert.rejects(pending,/CANCELLED_CHALLENGE/);
 const normal=setup().auth,d=normal.begin(account,origin),done=await normal.finish(cookie(d.setCookie),origin,await proof(d.challenge));
 // A logout request captured the old challenge cookie before verification replied.
 normal.logout(cookie(d.setCookie));assert.throws(()=>normal.get(cookie(done.setCookies[1])),/UNAUTHENTICATED/);
});
test('local origin aliases: a second loopback origin can sign in, bound to the origin it used; never with secure cookies',async()=>{
 const alias='http://localhost:18930';const {auth}=setup({aliases:[alias]});
 const b=auth.begin(account,alias);assert.equal(JSON.parse(b.challenge.message).origin,alias);
 await assert.rejects(auth.finish(cookie(b.setCookie),origin,await proof(b.challenge)),/WRONG_ORIGIN/,'cannot finish from the other origin');
 const b2=auth.begin(account,alias);const r=await auth.finish(cookie(b2.setCookie),alias,await proof(b2.challenge));assert.equal(r.session.profileId,'wallet:alice.testnet');
 assert.throws(()=>auth.begin(account,'http://localhost:9999'),/WRONG_ORIGIN/);
 assert.throws(()=>setup({aliases:['http://evil.example']}),/local HTTP only/);
 assert.throws(()=>setup({aliases:[alias],secureCookies:true}),/local/);
});
import {mkdtempSync as mkd,rmSync as rmd} from 'node:fs';import {tmpdir as tmp} from 'node:os';import {join as pj} from 'node:path';import {Store} from '../src/db';
test('wallet sessions survive a restart via hashed tokens in SQLite; expiry and logout remove them',async t=>{
 const dir=mkd(pj(tmp(),'wallet-store-'));let db=new Store(pj(dir,'db'));t.after(()=>{db.close();rmd(dir,{recursive:true,force:true});});
 const store={get:(h:string)=>db.get<any>('wallet-session',h),put:(h:string,s:any)=>db.put('wallet-session',h,s),delete:(h:string)=>db.remove('wallet-session',h)};
 let now=1_000_000;const make=()=>setup({store,now:()=>now,sessionMs:60_000}).auth;
 let auth=make();const b=auth.begin(account,origin);const r=await auth.finish(cookie(b.setCookie),origin,await proof(b.challenge));const sc=cookie(r.setCookies[1]);
 const token=sc.split('=')[1];assert.ok(!JSON.stringify(db.all('wallet-session')).includes(token),'the raw token is never stored');assert.equal(db.all('wallet-session').length,1);
 // "Restart": a new instance and a reopened database still recognise the cookie.
 db.close();db=new Store(pj(dir,'db'));auth=make();assert.equal(auth.requireProfile(sc),'wallet:alice.testnet');
 auth.destroy(sc);assert.equal(db.all('wallet-session').length,0);assert.throws(()=>make().get(sc),/UNAUTHENTICATED/);
 // Expired sessions are refused and removed.
 const b2=auth.begin(account,origin);const r2=await auth.finish(cookie(b2.setCookie),origin,await proof(b2.challenge));const sc2=cookie(r2.setCookies[1]);
 now+=60_001;assert.throws(()=>make().get(sc2),/UNAUTHENTICATED/);assert.equal(db.all('wallet-session').length,0);
});
