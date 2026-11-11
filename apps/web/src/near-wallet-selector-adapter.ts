import {Buffer} from 'buffer';
import {isExactBuyIn} from '../../../packages/shared/src/buy-in';
import type {WalletSelector,Network,InjectedWallet} from '@near-wallet-selector/core';
import type {InjectedWalletAdapter,WalletIdentity,WalletProof,WalletTransaction,WalletCall} from './wallet-transport';
import {commandGas} from '../../../packages/shared/src/command-limits';
import type {Command} from '../../../packages/shared/src/types';

export type NearAdapterConfig={network:string;contractId:string};
type IdentityRequest={accountId:string;network:string};
const supportedActions=new Set(['publish','publish_random','refresh','set_fee','finalize_close','retire','post_commission','fill_commission','cancel_commission','admit','list','cancel_listing','buy','bank_buy','bank_sell','fill_npc_order','create_shop','update_shop','stock_shop','remove_shop','list_for','begin_craft','begin_recovery']);
/** Wallets offered on testnet. MyNearWallet and Meteor open a popup (no install needed); Nightly is an extension. */
export const SUPPORTED_WALLETS=[
 {id:'my-near-wallet',name:'MyNearWallet',note:'web wallet, no install'},
 {id:'meteor-wallet',name:'Meteor',note:'web wallet or extension'},
 {id:'nightly',name:'Nightly',note:'browser extension'},
] as const;
export type SupportedWalletId=typeof SUPPORTED_WALLETS[number]['id'];
const walletIds=new Set<string>(SUPPORTED_WALLETS.map(w=>w.id));
const validAccount=(value:string)=>typeof value==='string'&&/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)&&value.length>=2&&value.length<=64;
function sdkBuffer(){
 // Wallet Selector 10.1.4 checks the global Buffer in its NEP-413 decorator.
 // This is the standard browser buffer polyfill, not a wallet injection shim.
 if(typeof globalThis.Buffer==='undefined')Object.defineProperty(globalThis,'Buffer',{value:Buffer,writable:true,configurable:true});
 // Some wallet SDKs (Meteor) reference Node's `global`/`process` at import time.
 if(typeof (globalThis as {global?:unknown}).global==='undefined')Object.defineProperty(globalThis,'global',{value:globalThis,writable:true,configurable:true});
 if(typeof (globalThis as {process?:unknown}).process==='undefined')Object.defineProperty(globalThis,'process',{value:{env:{},browser:true,version:'',versions:{},nextTick:(fn:(...a:unknown[])=>void,...args:unknown[])=>queueMicrotask(()=>fn(...args))},writable:true,configurable:true});
}
/** Bridge to @near-wallet-selector/core 10.1.4 with MyNearWallet, Meteor and Nightly.
 * Never reaches into wallet globals: provider detection/permissions belong to the SDK.
 * SDK errors propagate as uncertain outcomes, never falsely classified as cancellation.
 * The transport must still validate the server descriptor against the original intent. */
export class NearWalletSelectorAdapter implements InjectedWalletAdapter{
 private revision=0;
 private disposed=false;
 private fingerprint='';
 private network:string;
 private networkOptions:string;
 private listeners=new Set<(identity:WalletIdentity|null)=>void>();
 private cleanups:(()=>void)[]=[];
 private config:Readonly<NearAdapterConfig>;
 constructor(private selector:WalletSelector,config:NearAdapterConfig){
  if(!validAccount(config.contractId)||!/^[A-Za-z0-9_-]{1,64}$/.test(config.network)||selector.options.network.networkId!==config.network)throw Error('Wallet selector configuration mismatch');
  sdkBuffer();this.config=Object.freeze({...config});this.network=config.network;this.networkOptions=JSON.stringify(selector.options.network);
  this.fingerprint=this.stateFingerprint();
  const subscription=selector.store.observable.subscribe(()=>this.readState());this.cleanups.push(()=>subscription.unsubscribe());
  for(const event of ['signedIn','signedOut','accountsChanged'] as const){
   const subscription=selector.on(event,e=>{if(walletIds.has(e.walletId)){this.fingerprint=this.stateFingerprint();this.changed();}});this.cleanups.push(()=>subscription.remove());
  }
  const network=selector.on('networkChanged',e=>{if(walletIds.has(e.walletId)){this.network=e.networkId;this.changed();}});this.cleanups.push(()=>network.remove());
 }
 private stateFingerprint(){const state=this.selector.store.getState();return JSON.stringify([state.selectedWalletId,state.accounts,state.contract,this.selector.options.network]);}
 private readState(){const fingerprint=this.stateFingerprint();if(fingerprint!==this.fingerprint){this.fingerprint=fingerprint;this.changed();}}
 private changed(){this.revision++;for(const listener of this.listeners)listener(this.current());}
 private current():WalletIdentity|null{
  const state=this.selector.store.getState(),active=state.accounts.filter(a=>a.active);
  if(this.disposed||this.network!==this.config.network||JSON.stringify(this.selector.options.network)!==this.networkOptions||!walletIds.has(state.selectedWalletId??'')||state.contract?.contractId!==this.config.contractId||active.length!==1||!validAccount(active[0].accountId))return null;
  return {accountId:active[0].accountId,network:this.network,revision:this.revision};
 }
 identity(){this.readState();return this.current();}
 /** Name of the connected wallet, for display only. */
 walletName(){const id=this.selector.store.getState().selectedWalletId;return SUPPORTED_WALLETS.find(w=>w.id===id)?.name??null;}
 /** Subscribe the host's session invalidation to account/key/network/wallet changes. */
 subscribe(listener:(identity:WalletIdentity|null)=>void){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
 dispose(){if(this.disposed)return;this.disposed=true;this.cleanups.forEach(cleanup=>cleanup());this.changed();this.listeners.clear();}
 private capture(request:IdentityRequest){const id=this.identity();if(!id||id.accountId!==request.accountId||id.network!==request.network)throw Error('Wallet identity mismatch');return id;}
 private check(mark:WalletIdentity){const id=this.identity();if(!id||id.accountId!==mark.accountId||id.network!==mark.network||id.revision!==mark.revision)throw Error('Wallet identity changed during approval');}
 private async wallet(mark:WalletIdentity){
  const selected=this.selector.store.getState().selectedWalletId;if(!selected||!walletIds.has(selected))throw Error('Unsupported wallet provider');
  const wallet=await this.selector.wallet<InjectedWallet>(selected);this.check(mark);
  if(wallet.id!==selected)throw Error('Unsupported wallet provider');
  const accounts=await wallet.getAccounts();this.check(mark);
  // Single-account use. Also compare the public key against Selector state.
  const active=this.selector.store.getState().accounts.find(a=>a.active);
  if(accounts.length!==1||accounts[0].accountId!==mark.accountId||(active?.publicKey&&accounts[0].publicKey&&accounts[0].publicKey!==active.publicKey))throw Error('Wallet SDK account mismatch');
  return wallet;
 }
 /** Explicit user action: the SDK asks the chosen wallet to connect to the game contract. */
 async connect(walletId:SupportedWalletId){
  if(!walletIds.has(walletId)||this.disposed||this.network!==this.config.network||JSON.stringify(this.selector.options.network)!==this.networkOptions)throw Error('Wallet selector configuration mismatch');
  const wallet=await this.selector.wallet<InjectedWallet>(walletId);
  if(this.disposed||wallet.id!==walletId||this.network!==this.config.network||JSON.stringify(this.selector.options.network)!==this.networkOptions)throw Error('Wallet selector configuration changed');
  await wallet.signIn({contractId:this.config.contractId,methodNames:[]});
  const identity=this.identity();if(!identity)throw Error('Wallet did not connect to the configured account/network');return identity;
 }
 async disconnect(){this.revision++;for(const listener of this.listeners)listener(null);const selected=this.selector.store.getState().selectedWalletId;if(selected){const wallet=await this.selector.wallet(selected);await wallet.signOut();}this.readState();}
 async signMessage(input:Parameters<InjectedWalletAdapter['signMessage']>[0]):Promise<WalletProof|null>{
  const mark=this.capture(input);
  if(input.recipient!==this.config.contractId||typeof input.message!=='string'||!input.message.trim()||input.nonce.length!==32)throw Error('Invalid NEP-413 request');
  const params={message:input.message,recipient:input.recipient,nonce:Buffer.from(input.nonce)};
  const wallet=await this.wallet(mark);this.check(mark);
  const signed=await wallet.signMessage(params);this.check(mark);
  // void can mean a redirect, not proof of cancellation. Never invent a proof.
  if(!signed)throw Error('Wallet returned no signed message; outcome unknown');
  if(signed.accountId!==mark.accountId||!/^ed25519:[1-9A-HJ-NP-Za-km-z]+$/.test(signed.publicKey)||! /^[A-Za-z0-9+/]{86}==$/.test(signed.signature))throw Error('Wallet signed-message binding mismatch');
  return {accountId:signed.accountId,publicKey:signed.publicKey,signature:signed.signature};
 }
 private validateTransaction(input:WalletCall){
  const tx=structuredClone(input);
  // NEAR buy-in is the one deposit-bearing call: exact shape and deposit = coins × published price.
  if(tx.methodName==='buy_coins'){if(!isExactBuyIn(tx,this.config.contractId))throw Error('Unsafe buy-in transaction');return tx;}
  if(Object.keys(tx).sort().join(',')!=='args,deposit,gas,methodName,receiverId'||tx.receiverId!==this.config.contractId||tx.deposit!=='0'||!tx.args||Array.isArray(tx.args))throw Error('Unsafe wallet transaction');
  if(tx.methodName==='register_player'){
   if(Object.keys(tx.args).length||tx.gas!=='100000000000000')throw Error('Unsafe registration transaction');
  }else if(tx.methodName==='execute_player'){
   const {request_id,action}=tx.args;
   if(Object.keys(tx.args).sort().join(',')!=='action,request_id'||typeof request_id!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(request_id)||!action||!supportedActions.has((action as Command['action']).type)||tx.gas!==commandGas(action as Command['action']).toString())throw Error('Unsafe player transaction');
   // Prepared crafting/recovery starts: namespaced batch, chain-time deadline, server commitment.
   const a=action as {type:string;batch_id?:string;deadline_ms?:string;challenge_commitment?:string};
   if((a.type==='begin_craft'||a.type==='begin_recovery')&&(!/^[a-f0-9]{64}$/.test(a.batch_id??'')||a.deadline_ms!=='0'||!/^[a-f0-9]{64}$/.test(a.challenge_commitment??'')))throw Error('Unsafe prepared craft transaction');
  }else throw Error('Unsupported wallet method');
  return tx;
 }
 async approveTransaction(input:Parameters<InjectedWalletAdapter['approveTransaction']>[0]):ReturnType<InjectedWalletAdapter['approveTransaction']>{
  const mark=this.capture(input),tx=this.validateTransaction(input.transaction);
  const {actionCreators}=await import('@near-wallet-selector/core');this.check(mark);
  const wallet=await this.wallet(mark);this.check(mark);
  // 10.x takes real NEAR Action objects, not the older {type, params} format.
  const outcome=await wallet.signAndSendTransaction({signerId:mark.accountId,receiverId:tx.receiverId,actions:[actionCreators.functionCall(tx.methodName,tx.args,BigInt(tx.gas),BigInt(tx.deposit))]});this.check(mark);
  if(!outcome||outcome.transaction.signer_id!==mark.accountId||outcome.transaction.receiver_id!==tx.receiverId||!outcome.transaction.hash)throw Error('Wallet transaction outcome missing or mismatched; synchronize original request');
  return {status:'submitted',accountId:mark.accountId,network:mark.network,transactionHash:outcome.transaction.hash};
 }
}

/** Lazy SDK initialization. Supply exact network endpoints; no implicit mainnet fallback or relayer. */
export async function createWalletAdapter(config:NearAdapterConfig&{networkOptions:Network}){
 if(config.networkOptions.networkId!==config.network)throw Error('Wallet selector network mismatch');
 sdkBuffer();
 const [{setupWalletSelector},{setupMyNearWallet},{setupMeteorWallet},{setupNightly}]=await Promise.all([import('@near-wallet-selector/core'),import('@near-wallet-selector/my-near-wallet'),import('@near-wallet-selector/meteor-wallet'),import('@near-wallet-selector/nightly')]);
 const selector=await setupWalletSelector({network:structuredClone(config.networkOptions),modules:[setupMyNearWallet(),setupMeteorWallet(),setupNightly()],debug:false,optimizeWalletOrder:false,randomizeWalletOrder:false});
 return new NearWalletSelectorAdapter(selector,config);
}
export const TESTNET_NETWORK:Network={networkId:'testnet',nodeUrl:'https://test.rpc.fastnear.com',helperUrl:'https://helper.testnet.near.org',explorerUrl:'https://testnet.nearblocks.io',indexerUrl:'https://test.api.fastnear.com/v0'};
