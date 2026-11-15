import React,{useEffect,useState} from 'react';
import './game-screen.css';
import {Demo} from './Demo';
import {WalletGame} from './WalletGame';
import type {NearWalletSelectorAdapter} from './near-wallet-selector-adapter';
import type {InjectedWalletAdapter} from './wallet-transport';
import './fixed-windows.css';
import './saltwake-polish.css';
import './navigation.css';
import './playtest.css';
import {videoMode} from './art/video-mode';

type Config={authMode:'demo';label:string}|{authMode:'wallet';origin:string;network:string;contractId:string};
// localnet: dev-only wallet play against scripts/wallet-sandbox.ts with the dev test signer.
const WALLET_NETWORKS=new Set(import.meta.env.DEV?['testnet','localnet']:['testnet']);

/** The server decides the mode: local sandbox = operator demo profiles; testnet = wallet sign-in only.
 * A wallet-mode server never falls back to demo profiles. */
export function App(){
 const [config,setConfig]=useState<Config|null>(null),[error,setError]=useState('');
 const load=()=>{setError('');fetch('/api/config',{credentials:'same-origin'}).then(r=>r.ok?r.json():Promise.reject(Error('HTTP '+r.status))).then(setConfig,(e:Error)=>setError('Cannot reach the Saltwake server ('+e.message+'). Start it, then retry.'));};
 useEffect(load,[]);
 if(!config)return <main className="saltwake"><section className="arrival"><h1>Saltwake awaits</h1><p>{error||'Connecting to the harbor…'}</p>{error&&<button onClick={load}>Retry</button>}</section></main>;
 if(config.authMode==='wallet')return <main className="saltwake"><WalletShell config={config}/>{!videoMode&&<footer>Saltwake · NEAR {config.network} · {config.contractId}. Sign in with your own wallet; game coins are synthetic.</footer>}</main>;
 return <main className="saltwake"><Demo/>{!videoMode&&<footer>Saltwake · Local playable prototype. Synthetic coins and operator-controlled characters.</footer>}</main>;
}

function WalletShell({config}:{config:Extract<Config,{authMode:'wallet'}>}){
 const [adapter,setAdapter]=useState<NearWalletSelectorAdapter|null>(null),[error,setError]=useState(''),[connecting,setConnecting]=useState(false);
 const [wallets,setWallets]=useState<typeof import('./near-wallet-selector-adapter').SUPPORTED_WALLETS|null>(null);
 // Dev server only: a key-holding stand-in wallet for automated browser runs (see test-signer-plugin.ts).
 const [testSigner,setTestSigner]=useState<InjectedWalletAdapter|null>(null),[useTestSigner,setUseTestSigner]=useState(()=>{try{return sessionStorage.getItem('saltwake.dev-test-signer')==='1';}catch{return false;}});
 const pickTestSigner=(on:boolean)=>{try{sessionStorage.setItem('saltwake.dev-test-signer',on?'1':'0');}catch{}setUseTestSigner(on);};
 useEffect(()=>{if(import.meta.env.DEV)void import('./test-signer-adapter').then(m=>m.probeTestSigner(config.contractId)).then(setTestSigner);},[config.contractId]);
 useEffect(()=>{
  if(location.origin!==config.origin){setError(`Open the game at ${config.origin} (wallet sign-in is bound to that exact address).`);return;}
  if(!WALLET_NETWORKS.has(config.network)){setError('Unsupported wallet network: '+config.network);return;}
  if(config.network==='localnet')return; // no public wallet for a local sandbox; the dev test signer is the wallet
  let live=true,made:NearWalletSelectorAdapter|undefined;
  import('./near-wallet-selector-adapter').then(async m=>{made=await m.createWalletAdapter({network:config.network,contractId:config.contractId,networkOptions:m.TESTNET_NETWORK});if(live){setWallets(m.SUPPORTED_WALLETS);setAdapter(made);}else made.dispose();}).catch((e:Error)=>live&&setError('Wallet setup failed: '+e.message));
  return()=>{live=false;made?.dispose();};
 },[config.origin,config.network,config.contractId]);
 const connect=async(id:Parameters<NearWalletSelectorAdapter['connect']>[0])=>{
  if(!adapter)return;setConnecting(true);setError('');
  try{await adapter.connect(id);}catch(e){setError((e as Error).message||'Wallet connection failed');}finally{setConnecting(false);}
 };
 const picker=<div className="wallet-picker">
  <p>Connect a NEAR <strong>{config.network}</strong> wallet. No real money: testnet accounts are free.</p>
  {!wallets&&!error&&<p>Loading wallets…</p>}
  {wallets?.map(w=><button key={w.id} disabled={!adapter||connecting} onClick={()=>void connect(w.id)}>{w.name} <small>({w.note})</small></button>)}
  {testSigner&&<button onClick={()=>pickTestSigner(true)}>Dev test signer <small>({testSigner.identity()?.accountId})</small></button>}
  <p><small>No testnet account? MyNearWallet creates one for free at testnet.mynearwallet.com.</small></p>
  {error&&<p role="alert">{error}</p>}
 </div>;
 if(error&&!adapter)return <section className="arrival"><h1>Enter Saltwake</h1><p role="alert">{error}</p></section>;
 if(useTestSigner&&testSigner)return <WalletGame config={{origin:config.origin,network:config.network,contractId:config.contractId}} adapter={testSigner} onDisconnect={()=>pickTestSigner(false)}/>;
 return <WalletGame config={{origin:config.origin,network:config.network,contractId:config.contractId}} adapter={adapter??undefined} connectControls={picker} onDisconnect={adapter?()=>void adapter.disconnect().catch(()=>{}):undefined}/>;
}
