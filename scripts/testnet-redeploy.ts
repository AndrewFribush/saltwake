/** Bounded testnet redeploy: one fresh contract account, funded by faucet accounts, running the current verified WASM.
 *
 *  1. Prepare (default, no network writes): generates keys under git-ignored .state, hashes the WASM and prints the
 *     exact approval file to write. Keys are never printed.
 *       npx tsx scripts/testnet-redeploy.ts --account <new>.testnet --funder <f1>.testnet --funder <f2>.testnet
 *  2. Execute (only with --execute AND a matching, unexpired approval naming these exact accounts and hash):
 *     faucet-create the contract account and funders -> top up -> deploy -> verify code hash -> init_public_testnet
 *     -> write server config + runtime approval -> read-only smoke (snapshot, land_rules, coin_offer).
 *
 *  Every step is recorded in a journal BEFORE it is sent. A journal from an earlier execute stops the script: inspect the
 *  chain and the journal, never retry blindly. Testnet RPC/helper only; mainnet is refused. `--rpc http://127.0.0.1:<port>`
 *  rehearses against a local sandbox (loopback only): the faucet is emulated by the sandbox root account, which then
 *  also names the accounts (`<name>.<root>`). */
import {existsSync,mkdirSync,readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {parseArgs} from 'node:util';
import {Account,JsonRpcProvider,KeyPair,actions,type KeyPairString} from 'near-api-js';
import {TESTNET_RPCS,TESTNET_LATEST_EXPIRY,TESTNET_MAX_TRANSACTIONS,checkTestnetApproval} from '../apps/server/src/testnet-approval';

const WASM='contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm';
const HELPER='https://helper.testnet.near.org/account';
const NEAR=10n**24n;
const KEEP_IN_FUNDER=NEAR/10n; // leave 0.1 NEAR so the funder account stays valid
const STORAGE_MARGIN=2n*NEAR; // beyond the contract bytes, for state growth and gas
const {values:args}=parseArgs({options:{account:{type:'string'},funder:{type:'string',multiple:true,default:[]},execute:{type:'boolean',default:false},approval:{type:'string'},rpc:{type:'string'},'rehearsal-root':{type:'string',default:'.state/sandbox.json'}}});
const fail=(why:string):never=>{console.error('REFUSED: '+why);process.exit(2);};

// --- destination checks ---------------------------------------------------------------------------------------------
const rehearsal=args.rpc!==undefined;
const rpcUrl=args.rpc??TESTNET_RPCS[0];
if(rehearsal){const u=new URL(rpcUrl);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.protocol!=='http:')fail('--rpc is only for loopback rehearsal; testnet uses the built-in RPC');}
else if(!(TESTNET_RPCS as readonly string[]).includes(rpcUrl))fail('RPC is not a testnet endpoint');
const root=rehearsal?JSON.parse(readFileSync(args['rehearsal-root']!,'utf8')) as {accountId:string;privateKey:string;rpcUrl:string}:undefined;
if(root&&root.rpcUrl.replace(/\/$/,'')!==rpcUrl.replace(/\/$/,''))fail('rehearsal root config is for a different sandbox RPC');
const suffix=rehearsal?'.'+root!.accountId:'.testnet';
const named=(id:string|undefined,what:string)=>{if(!id||!id.endsWith(suffix)||!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id)||id.length>64)fail(`${what} must be a valid account ending in ${suffix}`);if(id!.endsWith('.near')&&!rehearsal)fail('mainnet accounts are refused');return id!;};
const accountId=named(args.account,'--account');
const funders=(args.funder as string[]).map(f=>named(f,'--funder'));
if(new Set([accountId,...funders]).size!==funders.length+1)fail('accounts must be distinct');
if(funders.length>3)fail('at most three funders (four faucet requests in total)');

// --- local preparation (no network writes) -------------------------------------------------------------------------
const dir=`.state/redeploy/${accountId}`;mkdirSync(dir,{recursive:true,mode:0o700});
const keyFile=(id:string)=>{const path=`${dir}/${id}.key.json`;if(!existsSync(path)){const k=KeyPair.fromRandom('ed25519');writeFileSync(path,JSON.stringify({accountId:id,publicKey:k.getPublicKey().toString(),privateKey:k.toString()}),{mode:0o600,flag:'wx'});}const v=JSON.parse(readFileSync(path,'utf8'));if(v.accountId!==id||KeyPair.fromString(v.privateKey).getPublicKey().toString()!==v.publicKey)throw Error('key file mismatch for '+id);return v as {accountId:string;publicKey:string;privateKey:string};};
const keys=Object.fromEntries([accountId,...funders].map(id=>[id,keyFile(id)]));
const wasm=readFileSync(WASM),wasmSha256=createHash('sha256').update(wasm).digest('hex');
const proposal={purpose:'Saltwake testnet redeploy',accountId,funders,rpcUrl,helper:rehearsal?'local-rehearsal':HELPER,wasmSha256,init:'init_public_testnet',maximumFaucetRequests:funders.length+1,maximumTransactions:funders.length+2,noMainnet:true,noPaidService:true};
const approvalPath=args.approval??`${dir}/approval.json`;
const runtimeDefaults={maximumTransactions:3000,expiresAt:new Date(TESTNET_LATEST_EXPIRY).toISOString()};
if(!args.execute){
 console.log(JSON.stringify({status:'PREPARED_NOT_SENT',proposal,publicKeys:Object.fromEntries(Object.entries(keys).map(([id,k])=>[id,k.publicKey])),
  approvalFile:approvalPath,approvalTemplate:{...proposal,approvedBy:rehearsal?'local-rehearsal':'Andrew',expiresAt:'<ISO time, at most '+runtimeDefaults.expiresAt+'>',runtime:runtimeDefaults}},null,2));
 process.exit(0);
}

// --- approval ------------------------------------------------------------------------------------------------------
if(!existsSync(approvalPath))fail('approval file missing: '+approvalPath);
const approval=JSON.parse(readFileSync(approvalPath,'utf8'));
for(const [k,v] of Object.entries(proposal))if(JSON.stringify(approval[k])!==JSON.stringify(v))fail(`approval does not match the prepared ${k}`);
const approver=rehearsal?'local-rehearsal':'Andrew';
if(approval.approvedBy!==approver)fail(`approvedBy must be ${approver}`);
const expires=Date.parse(approval.expiresAt);if(!Number.isFinite(expires)||expires<=Date.now())fail('approval expired');if(expires>TESTNET_LATEST_EXPIRY)fail('approval outlives the testnet window');
const runtime=approval.runtime;if(!runtime||!Number.isSafeInteger(runtime.maximumTransactions)||runtime.maximumTransactions<1||runtime.maximumTransactions>TESTNET_MAX_TRANSACTIONS||!Number.isFinite(Date.parse(runtime.expiresAt))||Date.parse(runtime.expiresAt)>TESTNET_LATEST_EXPIRY)fail('approval.runtime is out of bounds');

// --- journal: written before every send, never resumed automatically -----------------------------------------------
const journal=`${dir}/journal.jsonl`;
if(existsSync(journal))fail(`a previous execute is recorded in ${journal}; inspect the chain and journal before any retry`);
const record=(entry:object)=>appendFileSync(journal,JSON.stringify({at:new Date().toISOString(),...entry})+'\n',{mode:0o600});
record({step:'start',proposal});
let sent=0;const budget=proposal.maximumFaucetRequests+proposal.maximumTransactions;
const attempt=async<T>(step:string,fn:()=>Promise<T>)=>{if(++sent>budget)fail('send budget exhausted');record({step,status:'attempting'});try{const out=await fn();record({step,status:'done',tx:(out as any)?.transaction?.hash});return out;}catch(e){record({step,status:'failed',error:String((e as Error).message).slice(0,500)});console.error(`Step ${step} failed; stopping. See ${journal}. Do not retry without checking the chain.`);process.exit(1);}};

const provider=new JsonRpcProvider({url:rpcUrl});
const view=(id:string)=>provider.viewAccount({accountId:id}).catch(()=>null);
const rootAccount=root&&new Account(root.accountId,provider,root.privateKey as KeyPairString);
async function faucet(id:string){
 if(await view(id))fail(`${id} already exists; this script only creates fresh accounts`);
 await attempt('create '+id,async()=>{
  if(rootAccount)return rootAccount.signAndSendTransaction({receiverId:id,actions:[actions.createAccount(),actions.transfer(10n*NEAR),actions.addFullAccessKey(KeyPair.fromString(keys[id].privateKey as KeyPairString).getPublicKey())],waitUntil:'FINAL'});
  const r=await fetch(HELPER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({newAccountId:id,newAccountPublicKey:keys[id].publicKey}),signal:AbortSignal.timeout(30000)});
  const body=(await r.text()).slice(0,2000);if(!r.ok)throw Error(`faucet HTTP ${r.status}: ${body}`);
  for(let i=0;i<20&&!await view(id);i++)await new Promise(s=>setTimeout(s,1500));return {faucet:body};
 });
 if(!await view(id))fail(`${id} not visible after creation; check the journal`);
}

// --- execute -------------------------------------------------------------------------------------------------------
await faucet(accountId);
for(const f of funders){
 await faucet(f);
 const amount=BigInt((await view(f))!.amount)-KEEP_IN_FUNDER;
 await attempt(`top up ${f} -> ${accountId}`,()=>new Account(f,provider,keys[f].privateKey as KeyPairString).transfer({receiverId:accountId,amount}));
}
const need=BigInt(wasm.length)*10n**19n+STORAGE_MARGIN,have=BigInt((await view(accountId))!.amount);
if(have<need)fail(`contract account holds ${have/10n**21n} mNEAR; needs ${need/10n**21n} mNEAR for ${wasm.length} bytes of code. Add another --funder (new approval) before deploying.`);
const contract=new Account(accountId,provider,keys[accountId].privateKey as KeyPairString);
await attempt('deploy',()=>contract.deployContract(wasm));
// The deploy is included before it is final; wait (bounded, read-only) for the final code.
let code:any;for(let i=0;i<30&&!code;i++){code=await provider.query<any>({request_type:'view_code',finality:'final',account_id:accountId}).catch(()=>undefined);if(!code)await new Promise(r=>setTimeout(r,1000));}
if(!code){record({step:'verify code',status:'not visible'});fail('deployed code not visible at final; check the journal and chain');}
const deployed=createHash('sha256').update(Buffer.from(code.code_base64,'base64')).digest('hex');
if(deployed!==wasmSha256){record({step:'verify code',status:'mismatch',deployed});fail('deployed code hash differs from the approved artifact; not initializing');}
record({step:'verify code',status:'done',sha256:deployed});
await attempt('init_public_testnet',()=>contract.signAndSendTransaction({receiverId:accountId,actions:[actions.functionCall('init_public_testnet',{},100_000_000_000_000n,0n)],waitUntil:'FINAL'}));

// --- server config + runtime approval (from Andrew's approval file) -------------------------------------------------
const configPath=`.state/testnet-${accountId}.json`,runtimePath=`.state/testnet-${accountId}-approval.json`;
const config={epoch:'testnet-'+randomUUID(),rpcUrl,accountId,privateKey:keys[accountId].privateKey,profiles:['buyer','maker','p2','p3','p4','p5','worker','worker2']};
const runtimeApproval={approvedBy:approver,accountId,rpcUrl,wasmSha256,maximumTransactions:runtime.maximumTransactions,expiresAt:runtime.expiresAt,approvalId:'redeploy-'+createHash('sha256').update(JSON.stringify(approval)).digest('hex').slice(0,16)};
if(!rehearsal)checkTestnetApproval(config,runtimeApproval);
writeFileSync(configPath,JSON.stringify(config),{mode:0o600,flag:'wx'});writeFileSync(runtimePath,JSON.stringify(runtimeApproval,null,1),{mode:0o600,flag:'wx'});
record({step:'server config',status:'done',config:configPath,runtimeApproval:runtimePath});

// --- read-only smoke ------------------------------------------------------------------------------------------------
const call=(method:string)=>provider.callFunction<any>({contractId:accountId,method,args:{},blockQuery:{finality:'final'}});
const snapshot=await call('snapshot'),land=await call('land_rules'),offer=await call('coin_offer'),state=await view(accountId);
const smoke={account:accountId,wasmSha256:deployed,balanceNear:Number(BigInt(state!.amount)/10n**21n)/1000,storageBytes:state!.storage_usage,
 bank:snapshot.bank,recoveryBudget:snapshot.recovery?.budget,shops:snapshot.shops?.length,land:land.version,plotsPerOwner:land.max_plots_per_owner,coinPriceYocto:offer.price_yocto_per_coin,maxCoinsPerPurchase:offer.max_coins_per_purchase};
if(land.version!=='land-v1'||!Array.isArray(snapshot.shops)||!offer.price_yocto_per_coin)fail('smoke check failed: '+JSON.stringify(smoke));
record({step:'smoke',status:'done',smoke});
console.log(JSON.stringify({status:'DEPLOYED',...smoke,serverConfig:configPath,serverApproval:runtimePath},null,2));
