import {CostJournal} from './cost-ledger';
import {createHash} from 'node:crypto';
import {BoundedChain} from './bounded-chain';
import {readFileSync} from 'node:fs';
import {JsonRpcProvider,KeyPairSigner} from 'near-api-js';
import {DemoSessions} from './auth';
import {Store} from './db';import {Outbox} from './outbox';import {NearChain} from './chain';import {Runs} from './runs';import {httpServer} from './http';
import type {EconomySnapshot} from '../../../packages/shared/src/types';
const testnet=process.argv.includes('--testnet');
const config=JSON.parse(readFileSync(testnet?'.state/testnet.json':'.state/sandbox.json','utf8'));
if(!/^[a-zA-Z0-9-]{1,80}$/.test(config.epoch))throw Error('Invalid storage epoch');
let approval:any;
const url=new URL(config.rpcUrl);if(testnet){
 approval=JSON.parse(readFileSync('.state/testnet-runtime-approval.json','utf8'));
 if(config.rpcUrl!=='https://test.rpc.fastnear.com'||config.accountId!=='dungeon-economy-demo-20261110.testnet'||!config.epoch.startsWith('testnet-')||approval.approvedBy!=='Andrew'||approval.accountId!==config.accountId||approval.rpcUrl!==config.rpcUrl||approval.maximumTransactions!==20||!Number.isFinite(Date.parse(approval.expiresAt))||Date.parse(approval.expiresAt)-Date.now()>20*60000)throw Error('Exact unexpired bounded testnet approval required');
 const hash=createHash('sha256').update(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm')).digest('hex');if(approval.wasmSha256!==hash)throw Error('Artifact differs from approval');
}else if(url.hostname!=='127.0.0.1'&&url.hostname!=='localhost')throw Error('Only local sandbox RPC allowed');
const provider=new JsonRpcProvider({url:config.rpcUrl});
if(testnet){const result=await fetch(config.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'code',method:'query',params:{request_type:'view_code',finality:'final',account_id:config.accountId}}),signal:AbortSignal.timeout(15000)}).then(r=>r.json()) as any;if(!result.result?.code_base64||createHash('sha256').update(Buffer.from(result.result.code_base64,'base64')).digest('hex')!==approval.wasmSha256)throw Error('Deployed code differs from approved artifact');}
const db=new Store('.state/'+config.epoch+'/server.sqlite');const chain=new NearChain(provider,KeyPairSigner.fromSecretKey(config.privateKey),config.accountId,config.accountId);const transport=testnet?new BoundedChain(chain,db,config.accountId,approval.maximumTransactions,Date.parse(approval.expiresAt)):chain;const snapshot=async()=>{const s=await provider.callFunction<EconomySnapshot>({contractId:config.accountId,method:'snapshot',args:{},blockQuery:{finality:'final'}});if(!s)throw Error('No chain snapshot');return s;};const box=new Outbox(db,transport,new CostJournal(db,snapshot));const runs=new Runs(db,box);
const {server}=httpServer(box,runs,async()=>{const s=await provider.callFunction<EconomySnapshot>({contractId:config.accountId,method:'snapshot',args:{},blockQuery:{finality:'final'}});if(!s)throw Error('No chain snapshot');return s;},new DemoSessions({profiles:config.profiles??['buyer','maker','p2','p3','p4','p5'],secureCookies:false}));
server.listen(18931,'127.0.0.1',()=>console.log('Local custodial demo API: http://127.0.0.1:18931'));
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>{db.close();process.exit();}));
