import type {Store} from './db';
import {existsSync,readFileSync} from 'node:fs';
import {WalletSessions,WalletAuthError} from './wallet-auth';
import {playerOperationId} from '../../../packages/shared/src/player-identity';
import {commandGas,largePublicationBytes,legacyCommandBytes} from '../../../packages/shared/src/command-limits';
import {recoveryOffer} from '../../../packages/shared/src/workbench';
import {editionCostReport} from './cost-ledger';
import {shopRecord} from './shop-record';
import {editionRecord} from './edition-record';
import {publicShopRecord} from './shop-record';
import {businessLedger} from './business-ledger';
import {townSquare} from './town-square';
import {createServer,type IncomingMessage} from 'node:http';
import {randomBytes} from 'node:crypto';
import {DemoSessions,DEMO_CUSTODY_LABEL,SessionError} from './auth';
import {Outbox} from './outbox';
import {reconciler} from './reconcile';
import {Feedback} from './feedback';
import {Craft} from './craft';
import {catalog} from '../../../packages/shared/src/catalog';
import {availability} from './availability';
import {walletView} from './wallet';
import {Runs,type SavedRun} from './runs';
import {TownPresence,presenceIdentity} from './presence';
import type {Command,EconomySnapshot} from '../../../packages/shared/src/types';
export type WalletHttpConfig={walletSessions:WalletSessions;origin:string;network:string;contractId:string;aliases?:readonly string[]};
export function httpServer(box:Outbox,runs:Runs,snapshot:()=>Promise<EconomySnapshot>,sessions=new DemoSessions({profiles:['buyer','maker','p2','p3','p4','p5'],secureCookies:false}),wallet?:WalletHttpConfig,options:{webOrigin?:string;pollMs?:number;historyPath?:string}={}){
 const webOrigin=wallet?.origin??options.webOrigin??'http://127.0.0.1:18930';{const u=new URL(webOrigin);if(u.origin!==webOrigin||u.protocol!=='http:'||u.hostname!=='127.0.0.1')throw Error('Web origin must be a local HTTP origin');}const webHost=new URL(webOrigin).host;
 if(wallet){if(!wallet.walletSessions.matchesConfiguration(wallet.origin,wallet.network,wallet.contractId))throw Error('Wallet authentication configuration mismatch');const origin=new URL(wallet.origin);if(origin.origin!==wallet.origin||origin.protocol!=='http:'||origin.hostname!=='127.0.0.1')throw Error('Wallet origin must match the local HTTP origin');}
 const identity=wallet?.walletSessions??sessions;
 const craft=new Craft(box.db,box);const feedback=new Feedback(box.db);
 const sync=reconciler(async()=>{
  await box.recover();const world=await snapshot();
  for(const op of box.db.operations()){
   if(op.status!=='Applied'||op.command.action.type!=='admit')continue;
   const runId=op.receipt?.status==='Applied'?op.receipt.run?.id??op.receipt.result:undefined;
   // Tombstone receipts carry no run copy; without a local record, only a still-active snapshot run can be materialized.
   if(runId&&op.receipt?.status==='Applied'&&!op.receipt.run&&!box.db.get('run',runId)&&world.runs.find(r=>r.id===runId)?.status!=='active')continue;
   // A recovered admission receipt is historical, not permission to resurrect play.
   if(wallet&&runId&&!box.db.get('run',runId)){
    const current=world.runs.find(r=>r.id===runId);
    if(box.db.get('run-terminal-seen',runId)||current?.status!=='active')continue;
   }
   runs.materialize(op.id,world);
  }
  if(wallet){runs.discoverPlayerRuns(world);craft.discoverPlayerBatches(world);}
  runs.expire();craft.materialize({batches:world.batches??[]});craft.expire();
  if(box.chain.clock){const clock=await box.chain.clock();runs.retryExpiry(clock);craft.expire(clock);craft.retryExpiry(clock);}
  await box.recover();const finalWorld=await snapshot();
  if(wallet){runs.discoverPlayerRuns(finalWorld);craft.discoverPlayerBatches(finalWorld);}
  craft.materialize({batches:finalWorld.batches??[]});
 });
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status:number,value:unknown)=>{res.statusCode=status;res.end(JSON.stringify(value));};
  try{
   const aliases=wallet?.aliases??[];const alias=aliases.find(a=>new URL(a).host===req.headers.host);
   if(![webHost,'127.0.0.1:'+req.socket.localPort].includes(req.headers.host??'')&&!alias)return reply(403,{error:'Local host required'});
   const url=new URL(req.url??'/','http://127.0.0.1:18931');
   if(wallet&&![webOrigin,'http://127.0.0.1:'+req.socket.localPort].includes(wallet.origin))return reply(403,{error:'Configured wallet origin does not match local server'});
   if(req.method==='POST'&& !(wallet?[wallet.origin,...aliases]:[webOrigin,'http://127.0.0.1:'+req.socket.localPort]).includes(req.headers.origin??''))return reply(403,{error:'Same-origin request required'});
   if(req.method==='POST'&&req.headers['content-type']!=='application/json')return reply(415,{error:'JSON required'});
   // Simulation history written by `npm run simulate` for this storage epoch (read-only, labelled SIMULATION).
   if(req.method==='GET'&&url.pathname==='/api/town-square'){identity.requireProfile(req.headers.cookie);return reply(200,{highlights:townSquare(await snapshot(),box.db)});}
   if(req.method==='GET'&&url.pathname==='/api/town-history'){let history:unknown={days:[]};try{if(options.historyPath&&existsSync(options.historyPath))history=JSON.parse(readFileSync(options.historyPath,'utf8'));}catch{}return reply(200,history);}
   if(req.method==='GET'&&url.pathname==='/api/config')return reply(200,wallet?{authMode:'wallet',origin:alias??wallet.origin,network:wallet.network,contractId:wallet.contractId}:{authMode:'demo',label:DEMO_CUSTODY_LABEL});
   // Operator moderation: only in the local operator-custody demo (never in wallet or testnet mode). Chat only.
   if(url.pathname.startsWith('/api/moderation/')){if(wallet)return reply(404,{error:'Not found'});sessions.requireProfile(req.headers.cookie);
    if(req.method==='GET'&&url.pathname==='/api/moderation/reports')return reply(200,{reports:presence.reports().slice().reverse(),timeouts:presence.timeouts()});
    if(req.method==='POST'&&url.pathname==='/api/moderation/timeout'){const body=await bodyOf(req,1024);try{return reply(200,presence.timeout(body.player,body.minutes));}catch(e){return reply(400,{error:(e as Error).message});}}
    return reply(404,{error:'Not found'});}
   if(url.pathname.startsWith('/api/presence/'))return await presence.handle(req,res,url,presenceIdentity(identity));
   if(wallet&&req.method==='POST'&&url.pathname.startsWith('/api/wallet/')){
    const body=await bodyOf(req,8192);
    if(url.pathname==='/api/wallet/challenge'){
     const used=alias&&req.headers.origin===alias?alias:wallet.origin;
     const result=wallet.walletSessions.begin(body.accountId,used,req.headers.cookie);
     const binding=JSON.parse(result.challenge.message);
     if(binding.origin!==used||binding.network!==wallet.network||binding.contractId!==wallet.contractId||result.challenge.recipient!==wallet.contractId)throw Error('Wallet authentication configuration mismatch');
     res.setHeader('Set-Cookie',result.setCookie);return reply(200,{challenge:result.challenge});
    }
    if(url.pathname==='/api/wallet/verify'){
     const result=await wallet.walletSessions.finish(req.headers.cookie,alias&&req.headers.origin===alias?alias:wallet.origin,body);
     res.setHeader('Set-Cookie',result.setCookies);return reply(200,{session:result.session,authMode:'wallet'});
    }
    if(url.pathname==='/api/wallet/logout'){res.setHeader('Set-Cookie',wallet.walletSessions.logout(req.headers.cookie));return reply(200,{authMode:'wallet',session:null});}
    if(url.pathname==='/api/wallet/register'){
     const session=wallet.walletSessions.get(req.headers.cookie);
     return reply(200,{authMode:'wallet',accountId:session.accountId,transaction:{receiverId:wallet.contractId,methodName:'register_player',args:{},gas:'100000000000000',deposit:'0'}});
    }
   }
   if(url.pathname==='/api/session'&&req.method==='POST'){
    if(wallet){await bodyOf(req,8192);const session=wallet.walletSessions.get(req.headers.cookie);const world=await snapshot();wallet.walletSessions.get(req.headers.cookie);return reply(200,{session,authMode:'wallet',registered:Object.hasOwn(world.credits,session.profileId),network:wallet.network,contractId:wallet.contractId});}
    try{return reply(200,{session:sessions.get(req.headers.cookie),authMode:'demo',label:DEMO_CUSTODY_LABEL});}catch(e){if(!(e instanceof SessionError)||e.code!=='UNAUTHENTICATED')throw e;}
    const created=sessions.create();res.setHeader('Set-Cookie',created.setCookie);return reply(200,{session:created.session,authMode:'demo',label:DEMO_CUSTODY_LABEL});
   }
   const profile=identity.requireProfile(req.headers.cookie);
   const recheck=()=>{if(identity.requireProfile(req.headers.cookie)!==profile)throw Error('Profile changed; refresh before acting');};
   const readAction=async()=>{const body=await bodyOf(req,url.pathname==='/api/command'?largePublicationBytes:legacyCommandBytes);const current=identity.requireProfile(req.headers.cookie);if(current!==profile||(body.expectedProfile!==undefined&&body.expectedProfile!==current))throw Error('Profile changed; refresh before acting');return body;};
   if(url.pathname==='/api/profile'&&req.method==='POST'){if(wallet)return reply(403,{error:'Wallet profiles are account-bound'});const body=await readAction();return reply(200,sessions.claim(req.headers.cookie,body.profile));}
   if(url.pathname==='/api/wallet'&&req.method==='GET'){
    await sync();recheck();const world=await snapshot();recheck();
    return reply(200,walletView(world,box.db,profile));
   }
   if(url.pathname==='/api/world'&&req.method==='GET'){
    await sync();recheck();const world=await snapshot();recheck();const shopOps=world.shops?.length?box.db.operations():[];
    return reply(200,{profile,authMode:wallet?'wallet':'demo',registered:Object.hasOwn(world.credits,profile),shops:(world.shops??[]).map(shop=>({...shop,publicRecord:publicShopRecord(world,shopOps,shop.id),...(shop.owner===profile?{record:shopRecord(world,box.db.operations(),shop.id)}:{})})),shopContract:world.shops!==undefined,wallet:walletView(world,box.db,profile),businessLedger:businessLedger(world,box.db,profile),craft:craft.view(profile),credits:world.credits[profile]??'0',items:world.items.filter(i=>i.location.kind==='owned'&&i.location.profile===profile),listings:world.listings,reservations:world.reservations??{},commissions:world.commissions??[],bankItems:world.items.filter(i=>i.location.kind==='bank'),listedItems:world.items.filter(i=>i.location.kind==='listed'),bank:world.bank,bank_prices:world.bank_prices,npc_order:world.npc_order,recovery:world.recovery,recoveryOffer:recoveryOffer(world,profile),...(wallet&&world.coin_issuance?{buyIn:true}:{}),editions:world.editions.map(e=>({id:e.id,maker:e.maker,terms:e.terms,randomTables:e.random_tables,fee:e.fee,version:e.version,closed:e.closed,active:e.active_runs.length,placementPaid:e.placement_paid,retired:(world.retired_editions??[]).includes(e.id),...(e.maker===profile?{costs:editionCostReport(box.db,world,e.id),runMarks:runMarks(box.db,e.id)}:{}),pendingConsumptionValue:box.db.all<SavedRun>('run').filter(r=>r.economic.edition===e.id&&(!r.settlement||box.db.operation(r.settlement)?.status!=='Applied')).flatMap(r=>Object.values(r.state.items)).filter(i=>i.origin==='dungeon'&&i.location.kind==='consumed').reduce((n,i)=>n+catalog[i.type].value,0),pendingFees:world.runs.filter(r=>r.edition===e.id&&r.status==='active').reduce((n,r)=>n+Number(r.fee),0),completedRuns:world.runs.filter(r=>r.edition===e.id&&r.status!=='active').length,feedback:feedback.counts(e.id),record:editionRecord(world,box.db,e.id),...availability(e,world.items,Date.now(),(world.retired_editions??[]).includes(e.id)),settledRevenue:world.runs.filter(r=>r.edition===e.id&&!['active','void'].includes(r.status)).reduce((n,r)=>n+Number(r.fee),0)})),runs:box.db.all<SavedRun>('run').filter(r=>r.profile===profile).map(r=>runs.view(r.id,profile)),operations:box.db.operations().filter(o=>o.command.actor===profile).map(o=>({id:o.id,status:o.status,reason:o.reason,result:o.receipt?.status==='Applied'||o.receipt?.status==='Rejected'?o.receipt.result:undefined}))});
   }
   if(url.pathname==='/api/command'&&req.method==='POST'){
    const body=await readAction();if(typeof body.id!=='string'||!/^[\w-]{1,40}$/.test(body.id))throw Error('Invalid request ID');
    const accountId=wallet?.walletSessions.get(req.headers.cookie).accountId;const id=accountId?playerOperationId(accountId,body.id):profile+'-'+body.id;let action=body.action as Command['action'];
    if(!action||(!['publish','publish_random','refresh','set_fee','finalize_close','retire','post_commission','fill_commission','cancel_commission','admit','list','cancel_listing','buy','bank_buy','bank_sell','fill_npc_order','create_shop','update_shop','stock_shop','remove_shop','list_for'].includes(action.type)&&!(wallet&&['begin_craft','begin_recovery'].includes(action.type)&&box.db.operation(id)?.authority==='player')))throw Error('Command not allowed');
    if(action.type==='admit'){
     const prior=box.db.operation(id);const existing=prior?.command.action;
     const seed=existing?.type==='admit'?existing.seed:BigInt('0x'+randomBytes(8).toString('hex')).toString();
     if(box.db.operations().some(o=>o.id!==id&&o.command.actor===profile&&o.command.action.type==='admit'&&(o.status==='Pending'||o.status==='Unknown')))throw Error('Admission still pending');
     if(!wallet)action={...action,seed};
    }
    if(accountId)box.enqueuePlayer(accountId,body.id,action);else box.enqueue(id,sessions.bindCommand(req.headers.cookie,action));await sync();recheck();const op=box.db.operation(id)!;
    return reply(200,{...(wallet?{transaction:{receiverId:wallet.contractId,methodName:'execute_player',args:{request_id:body.id,action:op.command.action},gas:commandGas(op.command.action).toString(),deposit:'0'}}:{}),id,status:op.status,reason:op.reason,result:op.receipt?.status==='Applied'||op.receipt?.status==='Rejected'?op.receipt.result:undefined});
   }
   if(url.pathname==='/api/craft/begin'&&req.method==='POST'){const body=await readAction();
    const prepared=wallet?craft.beginPlayer(wallet.walletSessions.get(req.headers.cookie).accountId,body.id,body.inputIds,body.recovery??false):craft.begin(profile,body.id,body.inputIds,body.recovery??false);
    await sync();recheck();const view=craft.view(profile);
    if(wallet){const op=box.db.operation(prepared.beginOp)!;return reply(200,{...view,transaction:{receiverId:wallet.contractId,methodName:'execute_player',args:{request_id:body.id,action:op.command.action},gas:commandGas(op.command.action).toString(),deposit:'0'}});}
    return reply(200,view);}
   if((url.pathname==='/api/craft/start'||url.pathname==='/api/craft/input')&&req.method==='POST'){const body=await readAction();const result=url.pathname.endsWith('/start')?craft.startStep(profile,body.batch,body.id,body.seq,body.step):craft.input(profile,body.batch,body.id,body.seq,body.step);void sync().catch(()=>{});return reply(200,result);}
   if(url.pathname==='/api/feedback'&&req.method==='POST'){const body=await readAction();return reply(200,feedback.submit(body.run,profile,body.choice));}
   const match=url.pathname.match(/^\/api\/runs\/([\w-]+)(?:\/(action|abandon))?$/);
   if(match){const id=match[1];if(req.method==='GET')return reply(200,runs.view(id,profile));if(req.method==='POST'){
    const body=await readAction();
    if(match[2]==='action'){const result=runs.action(id,profile,body.id,body.seq,body.action);void sync().catch(()=>{});return reply(200,result);}
    if(match[2]==='abandon'){box.db.transaction(()=>runs.finish(runs.get(id,profile),'abandoned'));await sync();recheck();return reply(200,runs.view(id,profile));}
   }}
   reply(404,{error:'Not found'});
  }catch(e){reply(e instanceof SessionError?e.status:e instanceof WalletAuthError?(e.code==='UNAUTHENTICATED'?401:400):400,{...(wallet?{authMode:'wallet'}:{}),error:e instanceof Error?e.message:'Request failed'});}
 });
 const presence=new TownPresence().attach(server);
 const timer=setInterval(()=>void sync(false).catch(()=>{}),options.pollMs??2000);timer.unref();server.on('close',()=>clearInterval(timer));return {server,sync};
}
async function bodyOf(req:IncomingMessage,maxBytes:number){let bytes=0;const chunks:Buffer[]=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>maxBytes)throw Error('Request too large');chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!body||typeof body!=='object'||Array.isArray(body))throw Error('JSON object required');return body;}
/** Where finished runs of an edition ended, for its maker's revision view: floor, tile, outcome, killer and turn.
 * Only runs this server hosted; positions inside the maker's own dungeon reveal nothing about other players' goods. */
function runMarks(db:Store,editionId:string){
 return db.all<SavedRun>('run').filter(r=>r.economic.edition===editionId&&r.terminal&&r.terminal!=='void').slice(-200).map(r=>({floor:r.state.roomIndex,x:r.state.player.x,y:r.state.player.y,outcome:r.terminal!,turn:r.state.turn,floors:visitedFloors(r),loot:runLoot(r),...(r.state.killedBy?{killer:r.state.killedBy}:{}),...(r.terminal==='died'&&!r.state.killedBy?{killer:lastHitter(r.state.log)}:{})}));
}
function lastHitter(log:string[]){for(let i=log.length-1;i>=0;i--){const m=/^(.+?) (?:strikes|hits|bites|smashes)/.exec(log[i]);if(m&&!m[1].startsWith('You'))return m[1];}return undefined;}
function visitedFloors(r:SavedRun){const floors=new Set<number>([0,r.state.roomIndex]);for(const k of r.state.explored??[]){const n=Number(k.split(':')[0]);if(Number.isInteger(n))floors.add(n);}return [...floors].sort((a,b)=>a-b);}
/** What became of each funded reward this run was assigned: carried out, left on the floor, used up, or lost when the delver fell. */
function runLoot(r:SavedRun){return r.economic.assignments.map(a=>{const item=r.state.items[a.item_id];const kind=item?.location.kind;const fate=kind==='consumed'?'used':r.terminal==='extracted'&&kind&&kind!=='floor'?'taken':r.terminal==='extracted'?'left':'lost';return {socket:a.socket,item_type:item?.type??'unknown',fate};});}
