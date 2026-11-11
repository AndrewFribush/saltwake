import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Demo,offline,type WalletDemoConnection} from './Demo';
import {WalletOnboarding} from './WalletOnboarding';
import {WalletTransport,walletOperationId,type InjectedWalletAdapter,type WalletIdentity,type WalletSession} from './wallet-transport';
import type {CraftView} from '../../server/src/craft';

export type WalletGameConfig={origin:string;network:string;contractId:string};
const identityKey=(id:WalletIdentity|null)=>JSON.stringify(id?[id.accountId,id.network,id.revision]:null);
function identity(adapter?:InjectedWalletAdapter):WalletIdentity|null{
 try{const id=adapter?.identity();return id?{...id}:null;}catch{return null;}
}
async function request(path:string,body?:unknown):Promise<any>{
 const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',redirect:'error',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json().catch(()=>{throw offline();});
 if(!response.ok)throw Object.assign(Error(value.error??'Wallet request failed'),{status:response.status});
 return value;
}

/** Opt-in host integration. App remains demo-only until its caller supplies the
 * exact public configuration and an actual wallet SDK adapter. No automatic signing. */
export function WalletGame({config,adapter,connectControls,onDisconnect}:{config:WalletGameConfig;adapter?:InjectedWalletAdapter;connectControls?:React.ReactNode;onDisconnect?:()=>void}){
 const [observed,setObserved]=useState(()=>identity(adapter));
 useEffect(()=>{
  const update=()=>setObserved(old=>{const next=identity(adapter);return identityKey(old)===identityKey(next)?old:next;});
  update();const timer=setInterval(update,250);return()=>clearInterval(timer);
 },[adapter]);
 const live=identity(adapter);
 const mark=identityKey(live)===identityKey(observed)?observed:live;
 return <WalletAccount key={JSON.stringify([config.origin,config.network,config.contractId,identityKey(mark)])} config={config} adapter={adapter} identity={mark} connectControls={connectControls} onDisconnect={onDisconnect}/>;
}

function WalletAccount({config,adapter,identity:mark,connectControls,onDisconnect}:{config:WalletGameConfig;adapter?:InjectedWalletAdapter;identity:WalletIdentity|null;connectControls?:React.ReactNode;onDisconnect?:()=>void}){
 const [session,setSession]=useState<WalletSession|null>(null),[registered,setRegistered]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true),epoch=useRef(0),lock=useRef(false);
 const setup=useMemo(()=>{
  if(!adapter||!mark)return {};
  try{return {transport:new WalletTransport(config,adapter)};}catch(e){return {error:(e as Error).message};}
 },[adapter,config.origin,config.network,config.contractId]);
 const transport=setup.transport;
 const connected=!!transport&&!!mark&&mark.network===config.network;
 const invalidate=()=>{epoch.current++;transport?.invalidateSession();if(mounted.current){setSession(null);setRegistered(false);}};
 const check=(version:number)=>{
  if(!mounted.current||version!==epoch.current||!mark||identityKey(identity(adapter))!==identityKey(mark))throw Error('Wallet account or session changed');
 };
 const load=async(s:WalletSession,version:number)=>{
  check(version);const result=await request('session',{});check(version);
  if(result.authMode!=='wallet'||result.network!==config.network||result.contractId!==config.contractId||result.session?.accountId!==mark?.accountId||result.session?.profileId!==s.profileId||result.session?.publicKey!==s.publicKey||result.session?.expiresAtMs!==s.expiresAtMs||s.expiresAtMs<=Date.now())throw Error('Wallet session binding changed');
  setSession(s);setRegistered(result.registered===true);
 };
 const work=async(fn:()=>Promise<WalletSession>)=>{
  if(lock.current)return;lock.current=true;setBusy(true);const version=epoch.current;
  try{const s=await fn();await load(s,version);setError('');}
  catch(e){if(mounted.current&&version===epoch.current){setError((e as Error).message);if((e as {status?:number}).status===401|| (e as Error).message.includes('session'))invalidate();}}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 useEffect(()=>{
  mounted.current=true;
  if(connected)void work(()=>transport!.resume());
  return()=>{mounted.current=false;epoch.current++;transport?.invalidateSession();};
 },[transport,connected]);
 useEffect(()=>{
  if(!session)return;
  const timer=setTimeout(()=>{invalidate();setError('Your session expired. Sign in again.');},Math.max(0,session.expiresAtMs-Date.now()));
  return()=>clearTimeout(timer);
 },[session]);
 const logout=async()=>{
  invalidate();setError('');setBusy(true);
  try{await transport?.logout();}catch(e){if(mounted.current)setError((e as Error).message);}finally{if(mounted.current)setBusy(false);}
 };
 if(!connected||!session||!registered)return <WalletOnboarding connected={connected} accountId={mark?.accountId} network={config.network} contractId={config.contractId} authenticated={!!session} busy={busy} error={setup.error??(error||(mark&&mark.network!==config.network?'Select the configured wallet network.':undefined))} onLogin={()=>void work(()=>transport!.login())} onRegister={()=>void work(()=>transport!.register())} onRefresh={()=>void work(()=>transport!.resume())} onLogout={()=>void logout()} connectControls={connectControls} onDisconnect={onDisconnect&&(()=>void logout().finally(onDisconnect))}/>;
 const version=epoch.current;
 const guard=()=>{check(version);if(session.expiresAtMs<=Date.now()){invalidate();throw Error('Wallet session expired');}};
 const guardedRequest=async(path:string,body?:unknown)=>{
  guard();
  try{
   // Revalidate the cookie before world polling. Never silently switch accounts.
   if(path==='world'){
    const current=await request('session',{});guard();
    if(current.session?.accountId!==session.accountId||current.session?.publicKey!==session.publicKey||current.session?.expiresAtMs!==session.expiresAtMs){invalidate();throw Error('Wallet session changed');}
   }
   const result=await request(path,body===undefined?undefined:{...(body as object),expectedProfile:session.profileId});guard();
   if(path==='world'&&result.profile!==session.profileId){invalidate();throw Error('Wallet world account mismatch');}
   return result;
  }catch(e){if((e as {status?:number}).status===401|| (e as {status?:number}).status===403)invalidate();throw e;}
 };
 const connection=createWalletGameConnection({config,session,guard,guardedRequest,transport:transport!,sessionControls:<><p style={{overflowWrap:'anywhere'}}>{session.accountId} · {config.network}</p><p>Wallet-authenticated on NEAR {config.network}. Game coins are synthetic.</p><button disabled={busy} onClick={()=>void logout()}>Sign out</button>{onDisconnect&&<button disabled={busy} onClick={()=>void logout().finally(onDisconnect)}>Disconnect wallet</button>}</>});
 return <Demo key={JSON.stringify([identityKey(mark),session.publicKey,session.expiresAtMs,version])} walletConnection={connection}/>;
}

/** Request seams shared by the mounted UI and isolated transport tests. */
export function createWalletGameConnection({config,session,guard,guardedRequest,transport,sessionControls}:{
 config:WalletGameConfig;session:WalletSession;guard:()=>void;
 guardedRequest:(path:string,body?:unknown)=>Promise<any>;
 transport:Pick<WalletTransport,'execute'|'beginCraft'>&Partial<Pick<WalletTransport,'buyCoins'>>;sessionControls:React.ReactNode;
}):WalletDemoConnection{
 return {
  profile:session.profileId,storageScope:JSON.stringify([config.origin,config.network,config.contractId,session.accountId]),
  request:guardedRequest,operationId:id=>walletOperationId(session.accountId,id),
  execute:async(id,action)=>{guard();const result=await transport!.execute(id,action);guard();return result;},
  buyCoins:async(id,coins)=>{guard();if(!transport!.buyCoins)throw Error("Buy-in unavailable");await transport!.buyCoins(id,coins);guard();},
  craft:async(path,body)=>{
   guard();
   if(path!=='begin')return guardedRequest('craft/'+path,body);
   const result=await transport!.beginCraft(body.id,body.inputIds,body.recovery??false);guard();
   if(result.status==='Rejected')throw Object.assign(Error(String(result.result??'Craft start rejected')),{terminal:true});
   if(result.status!=='Applied')throw Error('Awaiting wallet confirmation. Retry the saved workbench request.');
   const world=await guardedRequest('world');const craft=world.craft as CraftView|null;
   if(!craft||craft.id!==result.id||craft.profile!==session.profileId)throw Error('Craft confirmation is not yet available; retry the saved request.');
   return craft;
  },
  sessionControls,
 };
}
