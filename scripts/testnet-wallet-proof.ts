/** End-to-end wallet-play proof against the running testnet server, using a local
 * key in place of a browser wallet (same WalletTransport the web app uses).
 * Creates one faucet-funded player account, then: NEP-413 sign-in, register_player,
 * a bank recovery job (player-signed begin_recovery, operator-signed finish), and a
 * player-signed bank_buy. Testnet only; the key stays in git-ignored .state.
 * usage: tsx scripts/testnet-wallet-proof.ts <player>.testnet [apiBase] [webOrigin] [--create-only|--world-only] */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {Account,JsonRpcProvider,KeyPair,KeyPairSigner,type KeyPairString} from 'near-api-js';
import {WalletTransport,type InjectedWalletAdapter} from '../apps/web/src/wallet-transport';
const [accountId,base='http://127.0.0.1:18941',origin='http://127.0.0.1:18940']=process.argv.slice(2).filter(a=>!a.startsWith('--'));
if(!accountId?.endsWith('.testnet'))throw Error('usage: testnet-wallet-proof.ts <player>.testnet');
const rpcUrl='https://test.rpc.fastnear.com',provider=new JsonRpcProvider({url:rpcUrl});
const keyPath=`.state/testnet-player-${accountId}.json`;
if(!existsSync(keyPath)){const k=KeyPair.fromRandom('ed25519');writeFileSync(keyPath,JSON.stringify({accountId,publicKey:k.getPublicKey().toString(),privateKey:k.toString()}),{mode:0o600,flag:'wx'});}
const key=JSON.parse(readFileSync(keyPath,'utf8'));
if(!await provider.viewAccount({accountId}).catch(()=>null)){
 const r=await fetch('https://helper.testnet.near.org/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({newAccountId:accountId,newAccountPublicKey:key.publicKey}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('faucet '+r.status);for(let i=0;i<20&&!await provider.viewAccount({accountId}).catch(()=>null);i++)await new Promise(s=>setTimeout(s,1500));
}
// NEP-413 verification reads the key at final finality; a just-created account needs a moment.
for(let i=0;i<20&&!await provider.viewAccessKey({accountId,publicKey:key.publicKey,finalityQuery:{finality:'final'}}).catch(()=>null);i++)await new Promise(s=>setTimeout(s,1500));
if(process.argv.includes('--create-only')){console.log('account ready',accountId,'key file',keyPath);process.exit(0);}
const cookies=new Map<string,string>();
const request=async(path:string,body?:unknown)=>{
 const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Host:new URL(origin).host,Origin:origin,'Content-Type':'application/json',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},body:body===undefined?undefined:JSON.stringify(body)});
 for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],at=pair.indexOf('=');if(/Max-Age=0(?:;|$)/i.test(cookie))cookies.delete(pair.slice(0,at));else cookies.set(pair.slice(0,at),pair.slice(at+1));}
 const value=await response.json();if(!response.ok)throw Error(value.error);return value;
};
const config=await request('config');assert.equal(config.authMode,'wallet');assert.equal(config.network,'testnet');
const signer=new KeyPairSigner(KeyPair.fromString(key.privateKey)),player=new Account(accountId,provider,key.privateKey as KeyPairString);
const hashes:Record<string,string>={};
const adapter:InjectedWalletAdapter={identity:()=>({accountId,network:'testnet',revision:0}),
 signMessage:async v=>{const p=await signer.signNep413Message(accountId,{message:v.message,recipient:v.recipient,nonce:v.nonce});return {accountId,publicKey:p.publicKey.toString(),signature:Buffer.from(p.signature).toString('base64')};},
 approveTransaction:async ({transaction:tx})=>{
  assert.equal(tx.receiverId,config.contractId);
  const out=await player.signAndSendTransaction({receiverId:tx.receiverId,actions:[(await import('near-api-js')).actions.functionCall(tx.methodName,tx.args,BigInt(tx.gas),0n)],waitUntil:'FINAL'});
  const label=tx.methodName==='register_player'?'register_player':String((tx.args.action as any).type);hashes[label]=out.transaction.hash;console.log('player tx',label,out.transaction.hash);
  return {status:'submitted',accountId,network:'testnet',transactionHash:out.transaction.hash};
 }};
const journal=new Map<string,string>();
const transport=new WalletTransport({origin,network:'testnet',contractId:config.contractId},adapter,request,Date.now,{getItem:k=>journal.get(k)??null,setItem:(k,v)=>{journal.set(k,v);}});
const session=await transport.login();console.log('signed in',session.profileId);
if(process.argv.includes('--world-only')){for(let i=0;i<3;i++){const t=Date.now();try{const w=await request('world');console.log('world',Date.now()-t,'ms registered',w.registered,'credits',w.credits);}catch(e){console.log('world error',Date.now()-t,'ms',(e as Error).message);}}process.exit(0);}
await transport.register();
let world=await request('world');assert.equal(world.registered,true);
if(Number(world.credits)<2&&!world.craft){
 const bank=world.bankItems.map((i:any)=>i),pick=(t:string)=>bank.filter((i:any)=>i.type===t||i.item_type===t).slice(-2).map((i:any)=>i.id);
 const inputs=[...pick('herb'),...pick('flask')];assert.equal(inputs.length,4);
 const started=await transport.beginCraft('work-'+Date.now().toString(36),inputs,true);assert.equal(started.status,'Applied');
 world=await request('world');
}
if(world.craft?.status==='active'){
 let seq=world.craft.seq??0;
 for(let step=0;step<3;step++){let c=await request('craft/start',{batch:world.craft.id,id:'start'+step,seq,step});c=await request('craft/input',{batch:world.craft.id,id:'input'+step,seq:c.seq,step});seq=c.seq;}
 for(let i=0;i<30;i++){world=await request('world');if(world.craft?.status==='finished')break;await new Promise(s=>setTimeout(s,2000));}
}
console.log('credits after recovery',world.credits);
const herb=world.bankItems.find((i:any)=>(i.type??i.item_type)==='herb');
const bought=await transport.execute('buy-'+Date.now().toString(36),{type:'bank_buy',item_ids:[herb.id],expected_unit_prices:['2']});
console.log('bank_buy',bought.status,bought.result??'');
world=await request('world');
console.log(JSON.stringify({accountId,profile:world.profile,credits:world.credits,items:world.items.map((i:any)=>i.id),hashes}));
