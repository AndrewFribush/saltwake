import type {Command} from '../../../packages/shared/src/types';
import {commandGas} from '../../../packages/shared/src/command-limits';

import {buyInTransaction,isExactBuyIn,type BuyInTransaction} from '../../../packages/shared/src/buy-in';
export type WalletIdentity={accountId:string;network:string;revision:number};
export type WalletProof={accountId:string;publicKey:string;signature:string};
export type WalletTransaction={receiverId:string;methodName:'register_player'|'execute_player';args:Record<string,unknown>;gas:string;deposit:'0'};
/** Anything an adapter may be asked to sign: zero-deposit game calls, or the exact NEAR buy-in. */
export type WalletCall=WalletTransaction|BuyInTransaction;
/** Implement with a real wallet SDK. revision must advance on every account/network
 * change or disconnect, including switching away and back during a prompt.
 * The adapter must enforce the supplied account/network before opening approval. */
export interface InjectedWalletAdapter{
 identity():WalletIdentity|null;
 signMessage(input:{accountId:string;network:string;message:string;recipient:string;nonce:Uint8Array}):Promise<WalletProof|null>;
 approveTransaction(input:{accountId:string;network:string;transaction:WalletCall}):Promise<
  {status:'submitted';accountId:string;network:string;transactionHash?:string}|{status:'cancelled'|'rejected'}>;
}
export type WalletSession={accountId:string;profileId:string;publicKey:string;expiresAtMs:number};
export type WalletIntentStorage=Pick<Storage,'getItem'|'setItem'>;
export type WalletPost=(path:string,body:unknown)=>Promise<unknown>;
export type CommandResult={id:string;status:'Pending'|'Unknown'|'Applied'|'Rejected';reason?:string;result?:unknown;transaction:WalletTransaction};
// Crafting uses the prepared challenge route before requesting transaction approval.
const allowed=new Set(['publish','publish_random','refresh','set_fee','finalize_close','admit','list','cancel_listing','buy','bank_buy','bank_sell','fill_npc_order','create_shop','update_shop','stock_shop','remove_shop','begin_craft','begin_recovery']);
const account=(s:unknown):s is string=>typeof s==='string'&&s.length>=2&&s.length<=64&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(s);
function object(value:unknown):Record<string,any>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid wallet response');return value;}
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
 const encoded=JSON.stringify(value);if(encoded===undefined)throw Error('Non-JSON wallet payload');return encoded;
}
/** Matches the contract Borsh tuple (domain, account, request), using browser crypto. */
export async function walletOperationId(accountId:string,requestId:string):Promise<string>{
 if(!account(accountId)||typeof requestId!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(requestId))throw Error('Invalid wallet operation identity');
 const parts=['saltwake.player-operation.v1',accountId,requestId].map(value=>new TextEncoder().encode(value));
 const bytes=new Uint8Array(parts.reduce((size,part)=>size+4+part.length,0));const view=new DataView(bytes.buffer);let offset=0;
 for(const part of parts){view.setUint32(offset,part.length,true);offset+=4;bytes.set(part,offset);offset+=part.length;}
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
}
/** Same-origin cookie transport; injectable for deterministic tests, never takes keys. */
export function browserWalletPost(origin:string):WalletPost{
 if(globalThis.location?.origin!==origin)throw Error('Wallet origin mismatch');
 return async(path,body)=>{
  const response=await fetch(new URL('/api/'+path,origin),{method:'POST',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const value=await response.json();if(!response.ok)throw Error(value.error??'Wallet HTTP request failed');return value;
 };
}

/** Isolated boundary, not an installed wallet integration. Host must invalidate on
 * observed session/logout changes. No transaction is approved solely by login.
 * Pending intents persist before approval, scoped to origin/network/contract.
 * Use the same request ID/action when retrying after a reload. A thrown approval is uncertain and is never auto-resubmitted. */
export class WalletTransport{
 private session:WalletSession|null=null;
 private epoch=0;
 private busy=false;
 private loggingOut=0;
 private intents=new Map<string,{action:Command['action'];attempted:boolean}>();
 private config:Readonly<{origin:string;network:string;contractId:string}>;
 constructor(config:{origin:string;network:string;contractId:string},private adapter:InjectedWalletAdapter,private post:WalletPost=browserWalletPost(config.origin),private now=Date.now,private storage:WalletIntentStorage|undefined=typeof sessionStorage==='undefined'?undefined:sessionStorage){
  const url=new URL(config.origin);if(url.origin!==config.origin||!['http:','https:'].includes(url.protocol)||!account(config.contractId)||!/^[A-Za-z0-9_-]{1,64}$/.test(config.network))throw Error('Invalid wallet configuration');
  this.config=Object.freeze({...config});
  this.restoreIntents();
 }
 private storageKey(){return 'saltwake.wallet-intents.v1:'+JSON.stringify([this.config.origin,this.config.network,this.config.contractId]);}
 private restoreIntents(){
  const raw=this.storage?.getItem(this.storageKey());if(raw===null||raw===undefined)return;
  try{
   if(raw.length>4*1024*1024)throw Error('large');
   const value=JSON.parse(raw);if(value.version!==1||!Array.isArray(value.entries)||value.entries.length>256)throw Error('shape');
   for(const entry of value.entries){
    if(!Array.isArray(entry)||entry.length!==2)throw Error('entry');
    const [key,intent]=entry;if(typeof key!=='string')throw Error('key');const [owner,request,...rest]=key.split(':');
    if(rest.length||!account(owner)||!request||!/^[A-Za-z0-9_-]{1,40}$/.test(request)||this.intents.has(key)||!intent||typeof intent.attempted!=='boolean'||!allowed.has(intent.action?.type))throw Error('intent');
    this.intents.set(key,{action:JSON.parse(canonical(intent.action)),attempted:intent.attempted});
   }
  }catch{this.intents.clear();throw Error('Saved wallet requests are invalid; preserve them for recovery before signing');}
 }
 private persistIntents(){
  if(!this.storage)return;
  const raw=JSON.stringify({version:1,entries:[...this.intents]});
  if(raw.length>4*1024*1024)throw Error('Wallet request storage capacity reached');
  this.storage.setItem(this.storageKey(),raw);
 }
 /** Reuse an existing authenticated cookie after reload without signing again. */
 async resume(){return this.exclusive(async()=>{const mark=this.capture();return {...await this.refresh(mark)};});}
 invalidateSession(){this.epoch++;this.session=null;}
 private capture(){const id=this.adapter.identity();if(!id||!account(id.accountId)||id.network!==this.config.network||!Number.isSafeInteger(id.revision))throw Error('Wallet account/network mismatch');return {...id,epoch:this.epoch};}
 private check(mark:ReturnType<WalletTransport['capture']>){const id=this.adapter.identity();if(mark.epoch!==this.epoch||!id||id.accountId!==mark.accountId||id.network!==mark.network||id.revision!==mark.revision)throw Error('Wallet identity/session changed');if(this.session&&this.session.expiresAtMs<=this.now()){this.invalidateSession();throw Error('Wallet session expired');}}
 private async wait<T>(mark:ReturnType<WalletTransport['capture']>,work:Promise<T>){const value=await work;this.check(mark);return value;}
 private async exclusive<T>(work:()=>Promise<T>){if(this.busy||this.loggingOut)throw Error('Wallet approval already pending');this.busy=true;try{return await work();}finally{this.busy=false;}}
 private validateSession(value:unknown,accountId:string){
  const response=object(value),s=object(response.session);
  if(response.authMode!=='wallet'||response.network!==this.config.network||response.contractId!==this.config.contractId||s.accountId!==accountId||s.profileId!=='wallet:'+accountId||typeof s.publicKey!=='string'||!Number.isSafeInteger(s.expiresAtMs)||s.expiresAtMs<=this.now())throw Error('Wallet session binding mismatch');
  return s as WalletSession;
 }
 private async refresh(mark:ReturnType<WalletTransport['capture']>){
  this.check(mark);const s=this.validateSession(await this.wait(mark,this.post('session',{})),mark.accountId);
  if(this.session&&canonical(this.session)!==canonical(s)){this.invalidateSession();throw Error('Wallet session changed');}
  this.session={...s};return s;
 }
 async login(){return this.exclusive(async()=>{
  this.invalidateSession();const mark=this.capture();
  const c=object(object(await this.wait(mark,this.post('wallet/challenge',{accountId:mark.accountId}))).challenge),binding=object(JSON.parse(c.message));
  if(c.accountId!==mark.accountId||c.recipient!==this.config.contractId||binding.accountId!==mark.accountId||binding.origin!==this.config.origin||binding.network!==this.config.network||binding.contractId!==this.config.contractId||binding.purpose!=='Saltwake sign-in only; does not authorize transactions'||!Number.isSafeInteger(c.expiresAtMs)||binding.expiresAtMs!==c.expiresAtMs||c.expiresAtMs<=this.now()||!Number.isSafeInteger(binding.issuedAtMs)||binding.issuedAtMs>this.now()||c.expiresAtMs-binding.issuedAtMs>300000||c.expiresAtMs<=binding.issuedAtMs||typeof c.nonce!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(c.nonce))throw Error('Wallet challenge binding mismatch');
  const nonce=Uint8Array.from(atob(c.nonce),ch=>ch.charCodeAt(0));if(nonce.length!==32)throw Error('Invalid challenge nonce');
  this.check(mark);const proof=await this.wait(mark,this.adapter.signMessage({accountId:mark.accountId,network:mark.network,message:c.message,recipient:c.recipient,nonce}));
  if(!proof)throw Error('Wallet signing cancelled');
  if(proof.accountId!==mark.accountId||!/^ed25519:[A-Za-z0-9]+$/.test(proof.publicKey)||! /^[A-Za-z0-9+/]{86}==$/.test(proof.signature)||c.expiresAtMs<=this.now())throw Error('Invalid wallet proof');
  const verified=object(await this.wait(mark,this.post('wallet/verify',proof)));
  if(verified.authMode!=='wallet'||object(verified.session).accountId!==mark.accountId||verified.session.publicKey!==proof.publicKey)throw Error('Wallet verification binding mismatch');
  const s=await this.refresh(mark);if(s.publicKey!==proof.publicKey){this.invalidateSession();throw Error('Wallet verification key mismatch');}return {...s};
 });}
 async logout(){this.invalidateSession();this.loggingOut++;try{await this.post('wallet/logout',{});}finally{this.loggingOut--;}}
 private descriptor(value:unknown,methodName:WalletTransaction['methodName'],args:Record<string,unknown>,gas:string):WalletTransaction{
  const expected:WalletTransaction={receiverId:this.config.contractId,methodName,args,gas,deposit:'0'};
  if(canonical(value)!==canonical(expected))throw Error('Unsafe wallet transaction descriptor');return structuredClone(expected);
 }
 private async approve(mark:ReturnType<WalletTransport['capture']>,transaction:WalletCall){
  this.check(mark);const result=await this.wait(mark,this.adapter.approveTransaction({accountId:mark.accountId,network:mark.network,transaction}));
  if(result.status!=='submitted')throw Error('Wallet transaction '+result.status);
  if(result.accountId!==mark.accountId||result.network!==mark.network)throw Error('Wallet approval binding mismatch');
 }
 async register(){return this.exclusive(async()=>{
  const mark=this.capture();if(!this.session)throw Error('Wallet login required');await this.refresh(mark);
  const response=object(await this.wait(mark,this.post('wallet/register',{})));
  if(response.authMode!=='wallet'||response.accountId!==mark.accountId)throw Error('Wallet registration account mismatch');
  const tx=this.descriptor(response.transaction,'register_player',{},'100000000000000');
  await this.refresh(mark);await this.approve(mark,tx);return this.refresh(mark);
 });}
 async beginCraft(requestId:string,inputIds:readonly string[],recovery=false):Promise<CommandResult>{return this.exclusive(async()=>{
  const mark=this.capture();if(!this.session)throw Error('Wallet login required');
  if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(requestId)||!Array.isArray(inputIds)||inputIds.length!==4||new Set(inputIds).size!==4||inputIds.some(id=>typeof id!=='string'||!id.length||id.length>128)||typeof recovery!=='boolean')throw Error('Invalid wallet craft request');
  const inputs=[...inputIds];await this.refresh(mark);
  const id=await this.wait(mark,walletOperationId(mark.accountId,requestId));
  const response=object(await this.wait(mark,this.post('craft/begin',{id:requestId,inputIds:inputs,recovery,expectedProfile:'wallet:'+mark.accountId})));
  if(response.id!==id||response.profile!=='wallet:'+mark.accountId||response.recovery!==recovery)throw Error('Wallet craft binding mismatch');
  const action=object(object(object(response.transaction).args).action);
  if(typeof action.challenge_commitment!=='string'||!/^[a-f0-9]{64}$/.test(action.challenge_commitment))throw Error('Invalid prepared craft commitment');
  const common={batch_id:id,challenge_commitment:action.challenge_commitment,deadline_ms:'0'};
  const expected:Command['action']=recovery?{type:'begin_recovery',...common,bank_input_ids:inputs}:{type:'begin_craft',...common,input_ids:inputs};
  this.descriptor(response.transaction,'execute_player',{request_id:requestId,action:expected},commandGas(expected).toString());
  this.check(mark);return this.executeCommand(requestId,expected);
 });}
 /** NEAR buy-in: the only call that attaches a deposit. The exact amount (coins × published price) is built
  * here and re-checked by the adapter before the wallet shows it; the contract rejects any other amount. */
 async buyCoins(requestId:string,coins:number){return this.exclusive(async()=>{
  const mark=this.capture();if(!this.session)throw Error('Wallet login required');
  const tx=buyInTransaction(this.config.contractId,requestId,coins);if(!isExactBuyIn(tx,this.config.contractId))throw Error('Unsafe buy-in transaction');
  await this.refresh(mark);await this.approve(mark,tx);return this.refresh(mark);
 });}
 async execute(requestId:string,action:Command['action']):Promise<CommandResult>{return this.exclusive(()=>this.executeCommand(requestId,action));}
 private async executeCommand(requestId:string,action:Command['action']):Promise<CommandResult>{
  const mark=this.capture();if(!this.session)throw Error('Wallet login required');
  if(typeof requestId!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(requestId)||!allowed.has(action?.type))throw Error('Unsupported wallet request');
  const key=mark.accountId+':'+requestId;let intent=this.intents.get(key);
  if(intent&&canonical(intent.action)!==canonical(action))throw Error('Wallet request payload conflict');
  if(!intent){if(this.intents.size>=256)throw Error('Wallet retry capacity reached');intent={action:JSON.parse(canonical(action)),attempted:false};this.intents.set(key,intent);this.persistIntents();}
  await this.refresh(mark);
  const operationId=await this.wait(mark,walletOperationId(mark.accountId,requestId));
  const sync=async()=>{
   this.check(mark);const result=object(await this.wait(mark,this.post('command',{id:requestId,action:structuredClone(intent!.action),expectedProfile:'wallet:'+mark.accountId})));
   this.descriptor(result.transaction,'execute_player',{request_id:requestId,action:intent!.action},commandGas(intent!.action).toString());
   if(result.id!==operationId||!['Pending','Unknown','Applied','Rejected'].includes(result.status))throw Error('Invalid command receipt');return result as CommandResult;
  };
  const result=await sync();await this.refresh(mark);if(result.status==='Applied'||result.status==='Rejected'||intent.attempted)return result;
  await this.refresh(mark);this.check(mark);intent.attempted=true;this.persistIntents();
  // A thrown SDK error can occur after broadcast; only explicit cancellation is safe to retry approval.
  const approval=await this.wait(mark,this.adapter.approveTransaction({accountId:mark.accountId,network:mark.network,transaction:structuredClone(result.transaction)}));
  if(approval.status==='cancelled'||approval.status==='rejected'){intent.attempted=false;this.persistIntents();throw Error('Wallet transaction '+approval.status);}
  if(approval.status!=='submitted'||approval.accountId!==mark.accountId||approval.network!==mark.network)throw Error('Wallet approval binding mismatch');
  await this.refresh(mark);const confirmed=await sync();await this.refresh(mark);return confirmed;
 }
}
