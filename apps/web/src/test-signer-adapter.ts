import type {InjectedWalletAdapter,WalletIdentity} from './wallet-transport';
/** Browser side of the dev-only test signer (apps/web/test-signer-plugin.ts). Never holds a key. */
export async function probeTestSigner(contractId:string):Promise<InjectedWalletAdapter|null>{
 // ?devSigner=<account> picks one of several configured dev keys for this browser context.
 const chosen=new URLSearchParams(location.search).get('devSigner');
 try{if(chosen)sessionStorage.setItem('saltwake.devSigner',chosen);}catch{}
 let as:string|null=chosen;try{as??=sessionStorage.getItem('saltwake.devSigner');}catch{}
 const headers:Record<string,string>=as?{'X-Test-Signer':as}:{};
 const r=await fetch('/__test-signer/account',{headers}).catch(()=>null);
 if(!r?.ok||!(r.headers.get('content-type')??'').includes('json'))return null;
 const info=await r.json().catch(()=>null) as {accountId:string;network:string;contractId:string}|null;
 if(!info||info.contractId!==contractId)return null;
 const identity:WalletIdentity={accountId:info.accountId,network:info.network,revision:0};
 const post=async(path:string,body:unknown)=>{const res=await fetch('/__test-signer/'+path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});const v=await res.json();if(!res.ok)throw Error(v.error);return v;};
 return {
  identity:()=>identity,
  signMessage:async i=>post('sign-message',{message:i.message,recipient:i.recipient,nonce:btoa(String.fromCharCode(...i.nonce))}),
  approveTransaction:async i=>{const {hash}=await post('send',i.transaction);return {status:'submitted',accountId:identity.accountId,network:identity.network,transactionHash:hash};},
 };
}
