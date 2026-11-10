import {createServer,type IncomingMessage} from 'node:http';
import {randomBytes} from 'node:crypto';
import {DemoSessions,DEMO_CUSTODY_LABEL,SessionError} from './auth';
import {Outbox} from './outbox';
import {reconciler} from './reconcile';
import {Feedback} from './feedback';
import {Craft} from './craft';
import {catalog} from '../../../packages/shared/src/catalog';
import {availability} from './availability';
import {Runs,type SavedRun} from './runs';
import type {Command,EconomySnapshot} from '../../../packages/shared/src/types';
export function httpServer(box:Outbox,runs:Runs,snapshot:()=>Promise<EconomySnapshot>,sessions=new DemoSessions({profiles:['buyer','maker','p2','p3','p4','p5'],secureCookies:false})){
 const craft=new Craft(box.db,box);const feedback=new Feedback(box.db);
 const sync=reconciler(async()=>{await box.recover();const world=await snapshot();for(const op of box.db.operations())if(op.status==='Applied'&&op.command.action.type==='admit')runs.materialize(op.id,world);runs.expire();craft.materialize({batches:world.batches??[]});craft.expire();if(box.chain.clock){const clock=await box.chain.clock();runs.retryExpiry(clock);craft.retryExpiry(clock);}await box.recover();craft.materialize({batches:(await snapshot()).batches??[]});});
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status:number,value:unknown)=>{res.statusCode=status;res.end(JSON.stringify(value));};
  try{
   if(!['127.0.0.1:18930','127.0.0.1:'+req.socket.localPort].includes(req.headers.host??''))return reply(403,{error:'Local host required'});
   const url=new URL(req.url??'/','http://127.0.0.1:18931');
   if(req.method==='POST'&& !['http://127.0.0.1:18930','http://127.0.0.1:'+req.socket.localPort].includes(req.headers.origin??''))return reply(403,{error:'Same-origin request required'});
   if(req.method==='POST'&&req.headers['content-type']!=='application/json')return reply(415,{error:'JSON required'});
   if(url.pathname==='/api/session'&&req.method==='POST'){
    try{return reply(200,{session:sessions.get(req.headers.cookie),label:DEMO_CUSTODY_LABEL});}catch(e){if(!(e instanceof SessionError)||e.code!=='UNAUTHENTICATED')throw e;}
    const created=sessions.create();res.setHeader('Set-Cookie',created.setCookie);return reply(200,{session:created.session,label:DEMO_CUSTODY_LABEL});
   }
   const profile=sessions.requireProfile(req.headers.cookie);
   if(url.pathname==='/api/profile'&&req.method==='POST'){const body=await bodyOf(req);return reply(200,sessions.claim(req.headers.cookie,body.profile));}
   if(url.pathname==='/api/world'&&req.method==='GET'){
    await sync();const world=await snapshot();
    return reply(200,{profile,craft:craft.view(profile),credits:world.credits[profile],items:world.items.filter(i=>i.location.kind==='owned'&&i.location.profile===profile),listings:world.listings,bankItems:world.items.filter(i=>i.location.kind==='bank'),listedItems:world.items.filter(i=>i.location.kind==='listed'),bank:world.bank,bank_prices:world.bank_prices,npc_order:world.npc_order,recovery:world.recovery,editions:world.editions.map(e=>({id:e.id,maker:e.maker,terms:e.terms,fee:e.fee,version:e.version,closed:e.closed,active:e.active_runs.length,placementPaid:e.placement_paid,pendingConsumptionValue:box.db.all<SavedRun>('run').filter(r=>r.economic.edition===e.id&&(!r.settlement||box.db.operation(r.settlement)?.status!=='Applied')).flatMap(r=>Object.values(r.state.items)).filter(i=>i.origin==='dungeon'&&i.location.kind==='consumed').reduce((n,i)=>n+catalog[i.type].value,0),pendingFees:world.runs.filter(r=>r.edition===e.id&&r.status==='active').reduce((n,r)=>n+Number(r.fee),0),completedRuns:world.runs.filter(r=>r.edition===e.id&&r.status!=='active').length,feedback:feedback.counts(e.id),...availability(e,world.items,Date.now()),settledRevenue:world.runs.filter(r=>r.edition===e.id&&!['active','void'].includes(r.status)).reduce((n,r)=>n+Number(r.fee),0)})),runs:box.db.all<SavedRun>('run').filter(r=>r.profile===profile).map(r=>runs.view(r.id,profile)),operations:box.db.operations().filter(o=>o.command.actor===profile).map(o=>({id:o.id,status:o.status,reason:o.reason,result:o.receipt?.status==='Applied'||o.receipt?.status==='Rejected'?o.receipt.result:undefined}))});
   }
   if(url.pathname==='/api/command'&&req.method==='POST'){
    const body=await bodyOf(req);if(!/^[\w-]{1,40}$/.test(body.id))throw Error('Invalid request ID');
    const id=profile+'-'+body.id;let action=body.action as Command['action'];
    if(!action||!['publish','publish_random','refresh','set_fee','finalize_close','admit','list','cancel_listing','buy','bank_buy','bank_sell','fill_npc_order'].includes(action.type))throw Error('Command not allowed');
    if(action.type==='admit'){
     const prior=box.db.operation(id);const existing=prior?.command.action;
     const seed=existing?.type==='admit'?existing.seed:BigInt('0x'+randomBytes(8).toString('hex')).toString();
     if(box.db.operations().some(o=>o.id!==id&&o.command.actor===profile&&o.command.action.type==='admit'&&(o.status==='Pending'||o.status==='Unknown')))throw Error('Admission still pending');
     action={...action,seed};
    }
    box.enqueue(id,sessions.bindCommand(req.headers.cookie,action));await sync();const op=box.db.operation(id)!;
    return reply(200,{id,status:op.status,reason:op.reason,result:op.receipt?.status==='Applied'||op.receipt?.status==='Rejected'?op.receipt.result:undefined});
   }
   if(url.pathname==='/api/craft/begin'&&req.method==='POST'){const body=await bodyOf(req);craft.begin(profile,body.id,body.inputIds,body.recovery??false);await sync();return reply(200,craft.view(profile));}
   if((url.pathname==='/api/craft/start'||url.pathname==='/api/craft/input')&&req.method==='POST'){const body=await bodyOf(req);const result=url.pathname.endsWith('/start')?craft.startStep(profile,body.batch,body.id,body.seq,body.step):craft.input(profile,body.batch,body.id,body.seq,body.step);void sync().catch(()=>{});return reply(200,result);}
   if(url.pathname==='/api/feedback'&&req.method==='POST'){const body=await bodyOf(req);return reply(200,feedback.submit(body.run,profile,body.choice));}
   const match=url.pathname.match(/^\/api\/runs\/([\w-]+)(?:\/(action|abandon))?$/);
   if(match){const id=match[1];if(req.method==='GET')return reply(200,runs.view(id,profile));if(req.method==='POST'){
    const body=await bodyOf(req);
    if(match[2]==='action'){const result=runs.action(id,profile,body.id,body.seq,body.action);void sync().catch(()=>{});return reply(200,result);}
    if(match[2]==='abandon'){box.db.transaction(()=>runs.finish(runs.get(id,profile),'abandoned'));await sync();return reply(200,runs.view(id,profile));}
   }}
   reply(404,{error:'Not found'});
  }catch(e){reply(e instanceof SessionError?e.status:400,{error:e instanceof Error?e.message:'Request failed'});}
 });
 const timer=setInterval(()=>void sync(false).catch(()=>{}),2000);timer.unref();server.on('close',()=>clearInterval(timer));return {server,sync};
}
async function bodyOf(req:IncomingMessage){let bytes=0;const chunks:Buffer[]=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>32768)throw Error('Request too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
