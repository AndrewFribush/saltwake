/** Create, fund, deploy and initialize the public testnet contract (wallet play).
 * Testnet only. Each step is idempotent; keys stay in git-ignored .state and are never printed.
 * usage: tsx scripts/testnet-public-deploy.ts <account>.testnet [<funder>.testnet ...] */
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {Account,JsonRpcProvider,KeyPair,actions,type KeyPairString} from 'near-api-js';
const rpcUrl='https://test.rpc.fastnear.com',helper='https://helper.testnet.near.org/account';
const wasmPath='contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm';
const [target,...funders]=process.argv.slice(2);
if(!target?.endsWith('.testnet')||funders.some(f=>!f.endsWith('.testnet')))throw Error('usage: testnet-public-deploy.ts <account>.testnet [<funder>.testnet ...]');
mkdirSync('.state',{recursive:true,mode:0o700});
const provider=new JsonRpcProvider({url:rpcUrl});
const view=async(id:string)=>provider.viewAccount({accountId:id}).catch(()=>null);
const keyFile=(path:string,accountId:string)=>{if(!existsSync(path)){const k=KeyPair.fromRandom('ed25519');writeFileSync(path,JSON.stringify({accountId,publicKey:k.getPublicKey().toString(),privateKey:k.toString()}),{mode:0o600,flag:'wx'});}const v=JSON.parse(readFileSync(path,'utf8'));if(v.accountId!==accountId)throw Error('key file account mismatch');return v as {accountId:string;publicKey:string;privateKey:string};};
async function faucet(accountId:string,publicKey:string){
 if(await view(accountId))return;
 const r=await fetch(helper,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({newAccountId:accountId,newAccountPublicKey:publicKey}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error(`faucet ${r.status} for ${accountId}`);
 for(let i=0;i<20&&!await view(accountId);i++)await new Promise(s=>setTimeout(s,1500));
 if(!await view(accountId))throw Error('account not visible after faucet: '+accountId);
 console.log('created',accountId);
}
const configPath=`.state/testnet-public.json`;
if(!existsSync(configPath)){const k=KeyPair.fromRandom('ed25519');writeFileSync(configPath,JSON.stringify({epoch:'testnet-'+randomUUID(),rpcUrl,accountId:target,publicKey:k.getPublicKey().toString(),privateKey:k.toString(),profiles:['buyer','maker','p2','p3','p4','p5','worker','worker2']}),{mode:0o600,flag:'wx'});}
const config=JSON.parse(readFileSync(configPath,'utf8'));if(config.accountId!==target)throw Error('config account mismatch');
await faucet(target,config.publicKey);
for(const funder of funders){
 const key=keyFile(`.state/testnet-funder-${funder}.json`,funder);await faucet(funder,key.publicKey);
 const state=await view(funder);const amount=BigInt(state!.amount)-100_000_000_000_000_000_000_000n;
 if(amount<=10n**24n){console.log('funder already drained',funder);continue;}
 const out=await new Account(funder,provider,key.privateKey as KeyPairString).transfer({receiverId:target,amount});
 console.log('topup',funder,'->',target,(amount/10n**21n).toString(),'mNEAR tx',(out as any).transaction?.hash);
}
const account=new Account(target,provider,config.privateKey as KeyPairString);
const wasm=readFileSync(wasmPath),sha=createHash('sha256').update(wasm).digest('hex');
const state=await view(target);
if(state?.code_hash==='11111111111111111111111111111111'){
 const out=await account.deployContract(wasm);console.log('deployed',sha,'tx',(out as any).transaction?.hash);
 const init=await account.signAndSendTransaction({receiverId:target,actions:[actions.functionCall('init_public_testnet',{},100_000_000_000_000n,0n)],waitUntil:'FINAL'});
 console.log('initialized tx',(init as any).transaction?.hash);
}else console.log('contract already deployed; code hash',state?.code_hash);
const after=await view(target);console.log(JSON.stringify({account:target,balanceNear:Number(BigInt(after!.amount)/10n**21n)/1000,storageBytes:after!.storage_usage,wasmSha256:sha}));
