/** Top up the testnet demo account from one new faucet-funded account. Testnet only; keys stay in git-ignored .state. */
import {existsSync,readFileSync,writeFileSync} from 'node:fs';import {Account,JsonRpcProvider,KeyPair,type KeyPairString} from 'near-api-js';
const rpcUrl='https://test.rpc.fastnear.com',helper='https://helper.testnet.near.org/account',target='dungeon-economy-demo-20261110.testnet';
const funder=process.argv[2];if(!funder?.endsWith('.testnet'))throw Error('usage: testnet-topup.ts <new-funder>.testnet');
const keyPath=`.state/testnet-funder-${funder}.json`;
if(!existsSync(keyPath)){const k=KeyPair.fromRandom('ed25519');writeFileSync(keyPath,JSON.stringify({accountId:funder,publicKey:k.getPublicKey().toString(),privateKey:k.toString()}),{mode:0o600,flag:'wx'});}
const key=JSON.parse(readFileSync(keyPath,'utf8'));const provider=new JsonRpcProvider({url:rpcUrl});
const view=async(id:string)=>provider.viewAccount({accountId:id}).catch(()=>null);
if(!await view(funder)){const r=await fetch(helper,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({newAccountId:funder,newAccountPublicKey:key.publicKey}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`faucet ${r.status}`);for(let i=0;i<20&&!await view(funder);i++)await new Promise(s=>setTimeout(s,1500));}
const state=await view(funder);if(!state)throw Error('funder account not visible');
const keep=100_000_000_000_000_000_000_000n;const amount=BigInt(state.amount)-keep;if(amount<=0n)throw Error('funder empty');
const account=new Account(funder,provider,key.privateKey as KeyPairString);const out=await account.transfer({receiverId:target,amount});
console.log(JSON.stringify({funder,sent:amount.toString(),tx:(out as any).transaction?.hash,target}));
