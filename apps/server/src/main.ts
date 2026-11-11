import {CostJournal} from './cost-ledger';
import {createHash} from 'node:crypto';
import {BoundedChain} from './bounded-chain';
import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {JsonRpcProvider,KeyPairSigner} from 'near-api-js';
import {DemoSessions} from './auth';
import {WalletSessions} from './wallet-auth';
import {checkTestnetApproval} from './testnet-approval';
import {Store} from './db';import {Outbox} from './outbox';import {NearChain} from './chain';import {Runs} from './runs';import {httpServer} from './http';
import type {EconomySnapshot} from '../../../packages/shared/src/types';
// Local sandbox: operator-controlled demo profiles. Testnet: wallet sign-in only, no demo profiles.
const {values:args}=parseArgs({options:{testnet:{type:'boolean',default:false},config:{type:'string'},approval:{type:'string',default:'.state/testnet-runtime-approval.json'},port:{type:'string',default:process.env.SALTWAKE_API_PORT??'18931'},'web-origin':{type:'string',default:'http://127.0.0.1:18930'}}});
const testnet=args.testnet!;const port=Number(args.port);if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Invalid --port');
const webOrigin=args['web-origin']!;{const u=new URL(webOrigin);if(u.origin!==webOrigin||u.protocol!=='http:'||u.hostname!=='127.0.0.1')throw Error('--web-origin must be http://127.0.0.1:<port>');}
const config=JSON.parse(readFileSync(args.config??(testnet?'.state/testnet.json':'.state/sandbox.json'),'utf8'));
if(!/^[a-zA-Z0-9-]{1,80}$/.test(config.epoch))throw Error('Invalid storage epoch');
// Public testnet RPCs rate-limit (JSON-RPC -429). Retry those with backoff instead of
// surfacing them as failed sign-ins or unknown receipts.
if(testnet){const raw=globalThis.fetch;globalThis.fetch=(async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
 for(let attempt=0;;attempt++){const r=await raw(input,init);const text=await r.text();
  if(attempt<5&&(r.status===429||/"code":\s*-429/.test(text.slice(0,300)))){await new Promise(s=>setTimeout(s,300*2**attempt));continue;}
  return new Response(text,{status:r.status,statusText:r.statusText,headers:r.headers});}
}) as typeof fetch;}
let bounds:ReturnType<typeof checkTestnetApproval>|undefined;
if(testnet){
 const approval=JSON.parse(readFileSync(args.approval!,'utf8'));bounds=checkTestnetApproval(config,approval);
 const hash=createHash('sha256').update(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm')).digest('hex');if(approval.wasmSha256!==hash)throw Error('Local artifact differs from approval');
 const result=await fetch(config.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'code',method:'query',params:{request_type:'view_code',finality:'final',account_id:config.accountId}}),signal:AbortSignal.timeout(15000)}).then(r=>r.json()) as any;
 if(result.error)throw Error('Could not read deployed code: '+JSON.stringify(result.error).slice(0,200));
 if(!result.result?.code_base64||createHash('sha256').update(Buffer.from(result.result.code_base64,'base64')).digest('hex')!==approval.wasmSha256)throw Error('Deployed code differs from approved artifact');
}else{const url=new URL(config.rpcUrl);if(url.hostname!=='127.0.0.1'&&url.hostname!=='localhost')throw Error('Only local sandbox RPC allowed');}
const provider=new JsonRpcProvider({url:config.rpcUrl});
const db=new Store('.state/'+config.epoch+'/server.sqlite');const chain=new NearChain(provider,KeyPairSigner.fromSecretKey(config.privateKey),config.accountId,config.accountId);
const bounded=bounds?new BoundedChain(chain,db,bounds.budgetId,bounds.limit,bounds.expiresAt):undefined;
const readSnapshot=async()=>{const s=await provider.callFunction<EconomySnapshot>({contractId:config.accountId,method:'snapshot',args:{},blockQuery:{finality:'final'}});if(!s)throw Error('No chain snapshot');return s;};
// Testnet: a full snapshot view takes seconds on public RPCs. Serve the latest read while it is
// under 5s old and refresh it in the background, so requests do not stack multi-second reads.
// Operation receipts are always read fresh; cost observations use fresh reads too.
let latest:{at:number;value:EconomySnapshot}|undefined,inflight:Promise<EconomySnapshot>|undefined;
const refresh=()=>inflight??=readSnapshot().then(value=>{latest={at:Date.now(),value};return value;}).finally(()=>{inflight=undefined;});
const snapshot=testnet?async()=>{const age=latest?Date.now()-latest.at:Infinity;if(age<5000){if(age>1500)void refresh().catch(()=>{});return latest!.value;}return refresh();}:readSnapshot;
const box=new Outbox(db,bounded??chain,new CostJournal(db,readSnapshot));const runs=new Runs(db,box);
const demo=new DemoSessions({profiles:config.profiles??['buyer','maker','p2','p3','p4','p5'],secureCookies:false});
const wallet=testnet?{origin:webOrigin,network:'testnet',contractId:config.accountId,walletSessions:new WalletSessions({origin:webOrigin,network:'testnet',contractId:config.accountId,provider,secureCookies:false,sessionMs:3600000})}:undefined;
const {server}=httpServer(box,runs,snapshot,demo,wallet,{webOrigin,pollMs:testnet?5000:2000});
server.listen(port,'127.0.0.1',()=>console.log(testnet?`Saltwake testnet API (wallet sign-in) http://127.0.0.1:${port} for ${webOrigin} · contract ${config.accountId} · operator budget ${JSON.stringify(bounded!.status())}`:`Local custodial demo API: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>{db.close();process.exit();}));
