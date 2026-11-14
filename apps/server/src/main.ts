import {CostJournal} from './cost-ledger';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {publicOriginProblem,isLocalOrigin} from './static-web';
import {createHash} from 'node:crypto';
import {BoundedChain} from './bounded-chain';
import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {JsonRpcProvider,KeyPairSigner} from 'near-api-js';
import {DemoSessions} from './auth';
import {WalletSessions} from './wallet-auth';
import {checkTestnetApproval} from './testnet-approval';
import {cachedRead} from './rpc-cache';
import {withArchive} from './history-archive';
import {Store} from './db';import {Outbox} from './outbox';import {NearChain} from './chain';import {Runs} from './runs';import {httpServer} from './http';
import type {EconomySnapshot} from '../../../packages/shared/src/types';
// Local sandbox: operator-controlled demo profiles. Testnet: wallet sign-in only, no demo profiles.
const {values:args}=parseArgs({options:{testnet:{type:'boolean',default:false},'wallet-local':{type:'boolean',default:false},'wallet-local-alias':{type:'string',multiple:true,default:[]},config:{type:'string'},approval:{type:'string',default:'.state/testnet-runtime-approval.json'},port:{type:'string',default:process.env.SALTWAKE_API_PORT??'18931'},'web-origin':{type:'string',default:'http://127.0.0.1:18930'},'rpc-cache-ms':{type:'string',default:'5000'},crowd:{type:'string'},'public-origin':{type:'string'},'serve-web':{type:'string'},listen:{type:'string',default:'127.0.0.1'}}});
const testnet=args.testnet!;
// --wallet-local: wallet sign-in against the local sandbox (scripts/wallet-sandbox.ts). Dev only; never testnet.
const walletLocal=args['wallet-local']!;if(walletLocal&&testnet)throw Error('--wallet-local and --testnet are exclusive');const port=Number(args.port);if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Invalid --port');
// Hosted mode (`--public-origin https://host --serve-web apps/web/dist --listen 0.0.0.0`, see static-web.ts): one
// container behind a TLS proxy serves the built web and /api on the public origin. Testnet only; cookies become Secure.
const publicOrigin=args['public-origin'];const hosted=publicOrigin!==undefined;
if(hosted){if(!testnet)throw Error('--public-origin is for --testnet servers only');const problem=publicOriginProblem(publicOrigin!);if(problem)throw Error('--public-origin '+problem);if(!args['serve-web'])throw Error('--public-origin requires --serve-web <built web directory>');}
const webDir=args['serve-web'];if(webDir!==undefined&&!existsSync(join(webDir,'index.html')))throw Error('--serve-web directory has no index.html (run npm run build)');
const listenHost=args.listen!;if(!['127.0.0.1','0.0.0.0','::'].includes(listenHost))throw Error('--listen must be 127.0.0.1, 0.0.0.0 or ::');if(listenHost!=='127.0.0.1'&&!hosted)throw Error('--listen beyond loopback requires --public-origin');
const webOrigin=hosted?publicOrigin!:args['web-origin']!;if(!hosted&&!isLocalOrigin(webOrigin))throw Error('--web-origin must be http://127.0.0.1:<port>');
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
// Terminal records pruned on chain stay visible to history views through the server's bounded archive (CAPACITY.md).
const readSnapshot=async()=>{const s=await provider.callFunction<EconomySnapshot>({contractId:config.accountId,method:'snapshot',args:{},blockQuery:{finality:'final'}});if(!s)throw Error('No chain snapshot');return withArchive(db,s);};
// Testnet: a full snapshot view takes seconds on public RPCs, and every client poll asks for a reconcile pass.
// Snapshot and contract clock reads are cached for --rpc-cache-ms (default 5000; raise it when the public RPC
// returns -429). Operation receipts are always read fresh; cost observations use fresh reads too.
const cacheMs=Number(args['rpc-cache-ms']);if(!Number.isSafeInteger(cacheMs)||cacheMs<1000||cacheMs>60000)throw Error('--rpc-cache-ms must be 1000..60000');
const snapshot=testnet?cachedRead(readSnapshot,cacheMs,cacheMs*0.3):readSnapshot;
if(testnet){
 const clock=chain.clock.bind(chain);chain.clock=cachedRead(clock,cacheMs,cacheMs*0.6);
 // Every reconcile pass re-reads the receipt of each op still awaiting a player signature; reuse a read for half the window.
 const receipt=chain.receipt.bind(chain),receipts=new Map<string,ReturnType<typeof cachedRead<Awaited<ReturnType<typeof receipt>>>>>();
 chain.receipt=id=>{let read=receipts.get(id);if(!read)receipts.set(id,read=cachedRead(()=>receipt(id),cacheMs/2,cacheMs/2));return read();};
}
// The outbox mirrors the contract's whole receipt window (recent receipts plus tombstones); older contracts have no `capacity` view.
const windowSize=await provider.callFunction<{receipts:{recent_capacity:number;tombstone_capacity:number}}>({contractId:config.accountId,method:'capacity',args:{},blockQuery:{finality:'final'}}).then(c=>c?c.receipts.recent_capacity+c.receipts.tombstone_capacity:256,()=>256);
const box=new Outbox(db,bounded??chain,new CostJournal(db,readSnapshot),{capacity:windowSize});const runs=new Runs(db,box);
const demo=new DemoSessions({profiles:config.profiles??['buyer','maker','p2','p3','p4','p5'],secureCookies:hosted});
const walletNetwork=testnet?'testnet':'localnet';
// --wallet-local-alias http://localhost:<port>: a second loopback origin (separate cookie jar) for two local wallet players. Local wallet mode only.
const aliases=args['wallet-local-alias'] as string[];if(aliases.length&&!walletLocal)throw Error('--wallet-local-alias requires --wallet-local');for(const a of aliases){const u=new URL(a);if(u.origin!==a||u.protocol!=='http:'||!['localhost','127.0.0.1'].includes(u.hostname)||a===webOrigin)throw Error('--wallet-local-alias must be another http://localhost:<port> origin');}
const wallet=testnet||walletLocal?{origin:webOrigin,network:walletNetwork,contractId:config.accountId,aliases,walletSessions:new WalletSessions({origin:webOrigin,network:walletNetwork,contractId:config.accountId,provider,secureCookies:hosted,sessionMs:3600000,aliases,
 // Sessions survive a server restart: hashed tokens with expiry in this epoch's SQLite.
 store:{get:h=>db.get('wallet-session',h),put:(h,s)=>db.put('wallet-session',h,s),delete:h=>db.remove('wallet-session',h)}})}:undefined;
// --crowd N: hosted townsfolk walking and chatting in presence (scenery only). Default 10 on the local demo, 0 for wallet and testnet servers.
const crowd=Number(args.crowd??(wallet?'0':process.env.SALTWAKE_CROWD??'10'));if(!Number.isInteger(crowd)||crowd<0||crowd>40)throw Error('--crowd must be 0-40');
const {server}=httpServer(box,runs,snapshot,demo,wallet,{webOrigin,pollMs:testnet?5000:2000,historyPath:'.state/'+config.epoch+'/town-history.json',crowd,webDir});
server.listen(port,listenHost,()=>console.log((hosted?`Hosted at ${webOrigin} (listening on ${listenHost}:${port}, serving ${webDir}) · `:'')+(walletLocal?`Saltwake LOCAL wallet API http://127.0.0.1:${port} for ${webOrigin} · sandbox contract ${config.accountId}`:testnet?`Saltwake testnet API (wallet sign-in) http://127.0.0.1:${port} for ${webOrigin} · contract ${config.accountId} · operator budget ${JSON.stringify(bounded!.status())}`:`Local custodial demo API: http://127.0.0.1:${port}`)));
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>{db.close();process.exit();}));
