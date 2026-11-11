import {validPlayerAccount} from '../../../packages/shared/src/player-identity';
import {randomBytes,createHash} from 'node:crypto';
import {verifyMessage} from 'near-api-js/nep413';
import type {JsonRpcProvider} from 'near-api-js';

export const WALLET_SESSION_COOKIE='dungeon_wallet_session',WALLET_CHALLENGE_COOKIE='dungeon_wallet_challenge';
type Challenge={accountId:string;message:string;recipient:string;nonce:string;expiresAtMs:number};
export type WalletSession={accountId:string;profileId:string;publicKey:string;expiresAtMs:number};
export type WalletProof={accountId:string;publicKey:string;signature:string};
type AccessProvider=Pick<JsonRpcProvider,'viewAccessKey'>;
export class WalletAuthError extends Error {constructor(readonly code:string){super(code);}}
const validAccount=validPlayerAccount;
export const walletProfile=(accountId:string)=>{if(!validAccount(accountId))throw new WalletAuthError('INVALID_ACCOUNT');return 'wallet:'+accountId;};
function tokenFrom(header:string|undefined,name:string):string|undefined{
 if(typeof header!=='string'||header.length>8192)return;
 const matches=header.split(';').map(p=>p.trim()).filter(p=>p.startsWith(name+'='));
 if(matches.length!==1)return;const token=matches[0].slice(name.length+1);return /^[A-Za-z0-9_-]{43}$/.test(token)?token:undefined;
}
/** Authentication only. Never signs transactions, assigns demo profiles or grants assets.
 * Single-process state: restart logs users out; multi-worker deployments need an atomic store.
 */
/** Durable wallet sessions: keyed by a SHA-256 hash of the cookie token (the token itself is never stored), so a
 * server restart does not sign players out. Expired or logged-out sessions are removed. */
export type SessionStore={get(hash:string):WalletSession|undefined;put(hash:string,session:WalletSession):void;delete(hash:string):void};
const tokenHash=(token:string)=>createHash('sha256').update('saltwake.wallet-session.v1:'+token).digest('hex');
export class WalletSessions{
 private challenges=new Map<string,Challenge>();
 private verifying=0;
 private sessions=new Map<string,WalletSession>();
 private sessionOrigins=new Map<string,string>();
 private attempts=new Map<string,{cancelled:boolean}>();
 private now:()=>number;private secure:boolean;private challengeMs:number;private sessionMs:number;private capacity:number;private verificationMs:number;
 constructor(private config:{origin:string;network:string;contractId:string;provider:AccessProvider;secureCookies?:boolean;now?:()=>number;challengeMs?:number;sessionMs?:number;capacity?:number;verificationMs?:number;aliases?:readonly string[];store?:SessionStore}){
  const origin=new URL(config.origin);
  if(origin.origin!==config.origin||origin.username||origin.password||!['https:','http:'].includes(origin.protocol)||!validAccount(config.contractId)||!config.network||config.network.length>64||!/^[a-zA-Z0-9_-]+$/.test(config.network))throw Error('Invalid wallet authentication configuration');
  this.secure=config.secureCookies??true;
  if(origin.protocol==='http:'&&(this.secure||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)))throw Error('Insecure wallet cookies are local-only');
  if(!this.secure&&!['127.0.0.1','localhost','[::1]'].includes(origin.hostname))throw Error('Insecure wallet cookies are local-only');
  // Local multi-player testing only: extra loopback origins (e.g. http://localhost:<port>) give a second browser cookie jar.
  for(const a of config.aliases??[]){const u=new URL(a);if(this.secure||u.origin!==a||u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw Error('Wallet origin aliases are local HTTP only');}
  this.now=config.now??Date.now;this.challengeMs=config.challengeMs??120000;this.sessionMs=config.sessionMs??900000;this.capacity=config.capacity??256;this.verificationMs=config.verificationMs??10000;
  if(!Number.isSafeInteger(this.verificationMs)||this.verificationMs<10||this.verificationMs>30000||!Number.isSafeInteger(this.challengeMs)||this.challengeMs<1000||this.challengeMs>300000||!Number.isSafeInteger(this.sessionMs)||this.sessionMs<1000||this.sessionMs>3600000||!Number.isSafeInteger(this.capacity)||this.capacity<1||this.capacity>10000)throw Error('Invalid wallet authentication limits');
 }
 /** The configured origin or a local alias; sign-in messages name the origin the player actually used. */
 allows(origin:string){return origin===this.config.origin||(this.config.aliases??[]).includes(origin);}
 matchesConfiguration(origin:string,network:string,contractId:string){return this.config.origin===origin&&this.config.network===network&&this.config.contractId===contractId;}
 private prune(){const now=this.now();for(const [key,c] of this.challenges)if(c.expiresAtMs<=now)this.challenges.delete(key);for(const [key,s] of this.sessions)if(s.expiresAtMs<=now){this.sessions.delete(key);this.sessionOrigins.delete(key);this.config.store?.delete(tokenHash(key));}}
 private cookie(name:string,value:string,maxAge:number){return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.secure?'; Secure':''}`;}
 begin(accountId:string,origin:string,cookieHeader?:string):{challenge:Challenge;setCookie:string}{
  if(!this.allows(origin))throw new WalletAuthError('WRONG_ORIGIN');walletProfile(accountId);this.prune();
  const prior=tokenFrom(cookieHeader,WALLET_CHALLENGE_COOKIE);if(prior){this.challenges.delete(prior);const attempt=this.attempts.get(prior);if(attempt)attempt.cancelled=true;}
  if(this.challenges.size+this.verifying>=this.capacity)throw new WalletAuthError('CHALLENGE_CAPACITY');
  const issuedAtMs=this.now(),expiresAtMs=issuedAtMs+this.challengeMs,nonce=randomBytes(32).toString('base64'),token=randomBytes(32).toString('base64url');
  const challenge={accountId,recipient:this.config.contractId,nonce,expiresAtMs,message:JSON.stringify({purpose:'Saltwake sign-in only; does not authorize transactions',origin,network:this.config.network,contractId:this.config.contractId,accountId,issuedAtMs,expiresAtMs})};
  this.challenges.set(token,challenge);return {challenge:{...challenge},setCookie:this.cookie(WALLET_CHALLENGE_COOKIE,token,Math.floor(this.challengeMs/1000))};
 }
 async finish(cookieHeader:string|undefined,origin:string,proof:WalletProof):Promise<{session:WalletSession;setCookies:string[]}>{
  if(!this.allows(origin))throw new WalletAuthError('WRONG_ORIGIN');this.prune();
  const token=tokenFrom(cookieHeader,WALLET_CHALLENGE_COOKIE),challenge=token?this.challenges.get(token):undefined;
  if(!token||!challenge)throw new WalletAuthError('INVALID_CHALLENGE');
  if(JSON.parse(challenge.message).origin!==origin)throw new WalletAuthError('WRONG_ORIGIN');
  // Consume before any await: concurrent retries cannot mint two sessions.
  this.challenges.delete(token);
  if(!proof||proof.accountId!==challenge.accountId||typeof proof.publicKey!=='string'||proof.publicKey.length>100||!proof.publicKey.startsWith('ed25519:')||typeof proof.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(proof.signature)||Buffer.from(proof.signature,'base64').length!==64)throw new WalletAuthError('INVALID_PROOF');
  const attempt={cancelled:false};this.attempts.set(token,attempt);
  this.verifying++;let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const verification=verifyMessage({signerAccountId:proof.accountId,signerPublicKey:proof.publicKey,payload:{message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')},signature:Buffer.from(proof.signature,'base64'),provider:{viewAccessKey:args=>this.config.provider.viewAccessKey({...args,finalityQuery:{finality:'final'}})} as JsonRpcProvider}).finally(()=>{this.verifying--;});
   await Promise.race([verification,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Verification timed out')),this.verificationMs);})]);
  }catch{throw new WalletAuthError('INVALID_PROOF');}finally{if(timer)clearTimeout(timer);this.attempts.delete(token);}
  if(attempt.cancelled)throw new WalletAuthError('CANCELLED_CHALLENGE');
  this.prune();if(challenge.expiresAtMs<=this.now())throw new WalletAuthError('EXPIRED_CHALLENGE');
  if(this.sessions.size>=this.capacity)throw new WalletAuthError('SESSION_CAPACITY');
  const session={accountId:proof.accountId,profileId:walletProfile(proof.accountId),publicKey:proof.publicKey,expiresAtMs:this.now()+this.sessionMs},sessionToken=randomBytes(32).toString('base64url');
  this.sessions.set(sessionToken,session);this.sessionOrigins.set(sessionToken,token);this.config.store?.put(tokenHash(sessionToken),session);
  return {session:{...session},setCookies:[this.cookie(WALLET_CHALLENGE_COOKIE,'',0),this.cookie(WALLET_SESSION_COOKIE,sessionToken,Math.floor(this.sessionMs/1000))]};
 }
 get(cookieHeader:string|undefined):WalletSession{this.prune();const token=tokenFrom(cookieHeader,WALLET_SESSION_COOKIE);let session=token?this.sessions.get(token):undefined;
  if(!session&&token&&this.config.store){const stored=this.config.store.get(tokenHash(token));
   if(stored&&stored.expiresAtMs>this.now()&&this.sessions.size<this.capacity&&validAccount(stored.accountId)&&stored.profileId===walletProfile(stored.accountId)){session={...stored};this.sessions.set(token,session);}
   else if(stored)this.config.store.delete(tokenHash(token));}
  if(!session)throw new WalletAuthError('UNAUTHENTICATED');return {...session};}
 requireProfile(cookieHeader:string|undefined){return this.get(cookieHeader).profileId;}
 logout(cookieHeader:string|undefined):string[]{
  const token=tokenFrom(cookieHeader,WALLET_CHALLENGE_COOKIE);
  if(token){this.challenges.delete(token);const attempt=this.attempts.get(token);if(attempt)attempt.cancelled=true;
   // A logout sent during verification may arrive after its response minted a
   // session but before the browser received the new cookie.
   for(const [session,source] of this.sessionOrigins)if(source===token){this.sessions.delete(session);this.sessionOrigins.delete(session);this.config.store?.delete(tokenHash(session));}
  }
  return [this.destroy(cookieHeader),this.cookie(WALLET_CHALLENGE_COOKIE,'',0)];
 }
 destroy(cookieHeader:string|undefined):string{const token=tokenFrom(cookieHeader,WALLET_SESSION_COOKIE);if(token){this.sessions.delete(token);this.sessionOrigins.delete(token);this.config.store?.delete(tokenHash(token));}return this.cookie(WALLET_SESSION_COOKIE,'',0);}
}
