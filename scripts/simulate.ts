/** SIMULATION: a week of Saltwake trading in a few minutes, for watching the economy move.
 *
 *   npm run simulate -- --days 7 [--seed 1]
 *
 * Starts an isolated local sandbox (demo town), then bot players act through the REAL HTTP API and contract:
 * newcomers take recovery jobs, artisans buy ingredients and brew, shop owners stock shelves, merchants buy and
 * resell, delvers pay into dungeons and play them with the dungeon lane's bot policies (scripts/depth-sim.ts), and
 * makers revise entry fees from observed demand. Nothing is minted except labelled issuance (none happens here).
 * Each simulated day is one round of bot turns; chain time does not jump. After the run the sandbox stays up and
 * `.state/sandbox.json` is written, so `npm run server` + `npm run dev` show the resulting town, and the harbor
 * notice board's "Town history" tab shows the day-by-day report. Bots read their own full run state (no fog) to
 * choose moves; every move still goes through the server's run endpoint and settlement through the contract.
 */
import type {ChildProcess} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {parseArgs} from 'node:util';
import {Sandbox,GenesisAccount} from 'near-sandbox';
import {Account,JsonRpcProvider,KeyPairSigner,type KeyPairString} from 'near-api-js';
import {starterTownCommands} from '../packages/shared/src/starter-town';
import {catalog} from '../packages/shared/src/catalog';
import {Store} from '../apps/server/src/db';import {Outbox} from '../apps/server/src/outbox';import {NearChain} from '../apps/server/src/chain';import {Runs,type SavedRun} from '../apps/server/src/runs';import {httpServer} from '../apps/server/src/http';import {CostJournal} from '../apps/server/src/cost-ledger';import {DemoSessions} from '../apps/server/src/auth';
import {apiClient,seedDemoTown} from './demo-town';
import {choose,type Policy} from './depth-sim';
import type {DayReport,TownHistory} from '../packages/shared/src/town-history';

const {values:args}=parseArgs({options:{days:{type:'string',default:'7'},seed:{type:'string',default:'1'},'exit-when-done':{type:'boolean',default:false}}});
const days=Math.max(1,Math.min(30,Number(args.days)||7));let rng=Number(args.seed)||1;
const rand=()=>{rng=(rng*1103515245+12345)%2147483648;return rng/2147483648;};
const PROFILES=['buyer','maker','p2','p3','p4','p5','worker','worker2'];

const genesis=GenesisAccount.createDefault();const sandbox=await Sandbox.start({});
const started=Date.now();
try{
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const root=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
 await root.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
 await root.callFunction({contractId:genesis.accountId,methodName:'init_demo_extended',args:{},gas:100_000_000_000_000n,waitUntil:'FINAL'});
 const now=await provider.callFunction<string>({contractId:genesis.accountId,method:'clock_ms',args:{},blockQuery:{finality:'final'}});
 for(const {id,command} of starterTownCommands(Number(now))){const r=await root.callFunction<any>({contractId:genesis.accountId,methodName:'execute',args:{op_id:id,command},gas:100_000_000_000_000n,waitUntil:'FINAL'});if(r.status!=='Applied')throw Error('Starter town failed: '+r.result);}
 const local={epoch:randomUUID(),profiles:PROFILES,rpcUrl:sandbox.rpcUrl,accountId:genesis.accountId,privateKey:genesis.privateKey};
 mkdirSync('.state/'+local.epoch,{recursive:true,mode:0o700});
 const db=new Store('.state/'+local.epoch+'/server.sqlite');
 const chain=new NearChain(provider,KeyPairSigner.fromSecretKey(local.privateKey as KeyPairString),local.accountId,local.accountId);
 const snapshot=()=>provider.callFunction<any>({contractId:local.accountId,method:'snapshot',args:{},blockQuery:{finality:'final'}});
 const box=new Outbox(db,chain,new CostJournal(db,snapshot));
 const {server}=httpServer(box,new Runs(db,box),snapshot,new DemoSessions({profiles:PROFILES,secureCookies:false}));
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const api=apiClient('http://127.0.0.1:'+(server.address() as AddressInfo).port);
 const history:TownHistory={label:'SIMULATION',days:[],startedAt:new Date().toISOString(),note:'Bot players acting through the real server and contract on an isolated local sandbox. Each day is one round of bot turns; chain time does not jump. Not organic activity.'};
 const historyPath='.state/'+local.epoch+'/town-history.json';
 try{
  await seedDemoTown(api,()=>{});
  let opSeq=0;const cmd=async(profile:string,action:any)=>{const r=await api(profile,'command',{id:`sim-${++opSeq}`,action});return {ok:r.status==='Applied',result:r.result as string};};
  const world=(p:string)=>api(p,'world');
  // Coins anywhere: purses, bank, entry fees in escrow, the bank's reserved wage budget and wages reserved for active jobs, and the seeded NPC order budget.
  const supply=(s:any)=>Object.values(s.credits).reduce((n:bigint,v:any)=>n+BigInt(v),0n)+BigInt(s.bank)+s.runs.filter((r:any)=>r.status==='active').reduce((n:bigint,r:any)=>n+BigInt(r.fee),0n)
   +BigInt(s.recovery?.budget??0)+s.batches.filter((b:any)=>b.recovery&&b.status==='active').reduce((n:bigint,b:any)=>n+BigInt(b.wage_reserved),0n)+BigInt(s.npc_order?.budget??0);
  const issuance=(s:any)=>BigInt(s.coin_issuance?.coins_issued??0);
  const start=await snapshot();const baseline=supply(start)-issuance(start);
  let prev=start;
  for(let day=1;day<=days;day++){
   const events:string[]=[];const tally={fees:0n,wages:0n,trades:0,tradeCoins:0n,bankSales:0,crafted:0,runs:{extracted:0,died:0,abandoned:0}};
   // Newcomers: one recovery job each while the bank's wage budget lasts.
   for(const p of ['worker','worker2']){
    const w=await world(p);if(!w.recoveryOffer?.eligible)continue;
    const job=await recovery(p,events);if(job){tally.wages+=BigInt(w.recoveryOffer.wage??'2');}
   }
   // Artisans: buy two herbs and two flasks from the bank when affordable, brew, and put tonics on sale.
   for(const p of ['worker2','p4']){
    let w=await world(p);const has=(t:string)=>w.items.filter((i:any)=>i.item_type===t).map((i:any)=>i.id);
    if(has('herb').length<2||has('flask').length<2){
     const bank=w.bankItems as any[];const need=[...bank.filter(i=>i.item_type==='herb').slice(0,2-Math.min(2,has('herb').length)),...bank.filter(i=>i.item_type==='flask').slice(0,2-Math.min(2,has('flask').length))];
     const cost=need.reduce((n,i)=>n+catalog[i.item_type as keyof typeof catalog].value,0);
     if(need.length&&cost<=Number(w.credits)){const r=await cmd(p,{type:'bank_buy',item_ids:need.map(i=>i.id),expected_unit_prices:need.map(i=>String(catalog[i.item_type as keyof typeof catalog].value))});if(r.ok)events.push(`${p} bought ${need.length} ingredients from the bank for ${cost}`);}
     w=await world(p);
    }
    if(has('herb').length>=2&&has('flask').length>=2&&await brew(p,[...has('herb').slice(0,2),...has('flask').slice(0,2)],events))tally.crafted++;
    w=await world(p);const tonics=w.items.filter((i:any)=>i.item_type==='tonic'||i.item_type==='fineTonic');
    if(tonics.length){const shop=(w.shops??[]).find((s:any)=>s.owner===p);const price=String(4+Math.floor(rand()*3));
     const r=await cmd(p,shop?{type:'stock_shop',shop_id:shop.id,item_ids:tonics.map((i:any)=>i.id),unit_price:price}:{type:'list',item_ids:tonics.map((i:any)=>i.id),unit_price:price});
     if(r.ok)events.push(`${p} put ${tonics.length} tonics on sale at ${price}${shop?` in ${shop.title}`:' at the market'}`);}
   }
   // Delvers: pay into an open dungeon they can afford, pack a weapon if owned, and play it out.
   for(const [p,policy] of [['buyer','cautious'],['p5','greedy'],['p2','reckless']] as [string,Policy][]){
    const w=await world(p);const open=(w.editions as any[]).filter(e=>e.status==='open'&&e.maker!==p&&BigInt(e.fee)<=BigInt(w.credits)&&e.valueBalanced!==false);
    if(!open.length){if(day>1)events.push(`${p} could not afford any dungeon (${w.credits} coins)`);continue;}
    const e=open[Math.floor(rand()*open.length)];
    // Prepare: buy the cheapest tonic on offer if one is affordable on top of the fee (demand for artisans' shelves).
    if(!(w.items as any[]).some(i=>i.item_type==='tonic')){const listed=w.listedItems as any[];const offer=(w.listings as any[]).filter(l=>l.status==='active'&&l.seller!==p&&!w.reservations?.[l.id]).map(l=>({l,item:listed.find(i=>i.location.listing===l.id&&l.remaining_ids.includes(i.id)&&i.item_type==='tonic')})).filter(x=>x.item).sort((a,b)=>Number(a.l.unit_price)-Number(b.l.unit_price))[0];
     if(offer&&BigInt(offer.l.unit_price)+BigInt(e.fee)<=BigInt(w.credits)){const b=await cmd(p,{type:'buy',listing_id:offer.l.id,item_ids:[offer.item.id],expected_unit_price:offer.l.unit_price});if(b.ok){tally.trades++;tally.tradeCoins+=BigInt(offer.l.unit_price);events.push(`${p} bought a tonic for ${offer.l.unit_price} from ${offer.l.seller} before descending`);}}}
    const w2=await world(p);const weapon=(w2.items as any[]).find(i=>i.item_type==='sword'||i.item_type==='club');const tonic=(w2.items as any[]).find(i=>i.item_type==='tonic');
    const r=await cmd(p,{type:'admit',edition_id:e.id,expected_version:e.version,expected_fee:e.fee,loadout_ids:[weapon,tonic].filter(Boolean).map((i:any)=>i.id),seed:'0'});
    if(!r.ok){events.push(`${p} was refused entry to ${e.terms.title}: ${r.result}`);continue;}
    tally.fees+=BigInt(e.fee);const outcome=await play(p,policy);tally.runs[outcome]++;events.push(`${p} (${policy}) paid ${e.fee} into ${e.terms.title} and ${outcome==='extracted'?'escaped':outcome}`);
    // Cash in finds: keep the best weapon, sell spare swords/armor/iron to the bank at half catalog value.
    {const after=await world(p);const items=after.items as any[];const keep=items.filter(i=>i.item_type==='sword')[0]??items.filter(i=>i.item_type==='club')[0];
     const spare=items.filter(i=>i!==keep&&['sword','armor','iron','club'].includes(i.item_type)).slice(0,3);const prices=spare.map(i=>String(Math.floor(catalog[i.item_type as keyof typeof catalog].value/2)));
     if(spare.length&&prices.reduce((n,x)=>n+Number(x),0)<=Number(after.bank)){const r=await cmd(p,{type:'bank_sell',item_ids:spare.map(i=>i.id),expected_unit_prices:prices});if(r.ok){tally.bankSales+=spare.length;events.push(`${p} sold ${spare.length} dungeon finds to the bank for ${prices.reduce((n,x)=>n+Number(x),0)}`);}}}
   }
   // Merchants: the mercenary buys the cheapest tonic on offer when it can resell to the bank or the NPC order at a profit.
   {const p='p2';const w=await world(p);const listed=w.listedItems as any[];const offers=(w.listings as any[]).filter(l=>l.status==='active'&&l.seller!==p&&!w.reservations?.[l.id]);
    const best=offers.map(l=>({l,item:listed.find(i=>i.location.listing===l.id&&l.remaining_ids.includes(i.id))})).filter(x=>x.item&&(x.item.item_type==='tonic'||x.item.item_type==='fineTonic')).sort((a,b)=>Number(a.l.unit_price)-Number(b.l.unit_price))[0];
    const resale=best&&Math.floor(catalog[best.item.item_type as keyof typeof catalog].value/2);
    if(best&&Number(best.l.unit_price)<=Number(w.credits)&&(Number(best.l.unit_price)<resale!||day%2===0)){
     const r=await cmd(p,{type:'buy',listing_id:best.l.id,item_ids:[best.item.id],expected_unit_price:best.l.unit_price});
     if(r.ok){tally.trades++;tally.tradeCoins+=BigInt(best.l.unit_price);events.push(`${p} bought a ${catalog[best.item.item_type as keyof typeof catalog].name.toLowerCase()} for ${best.l.unit_price} from ${best.l.seller}`);}
    }}
   // Bank sales: anyone holding spare tonics sells one to the bank for coins (half catalog value).
   for(const p of ['p2','buyer']){const w=await world(p);const t=(w.items as any[]).find(i=>i.item_type==='tonic');if(!t)continue;const price=String(Math.floor(catalog.tonic.value/2));
    if(BigInt(w.bank)>=BigInt(price)){const r=await cmd(p,{type:'bank_sell',item_ids:[t.id],expected_unit_prices:[price]});if(r.ok){tally.bankSales++;events.push(`${p} sold a tonic to the bank for ${price}`);}}}
   // Makers revise: cut the fee of an open dungeon nobody entered today; raise it when it was busy.
   for(const p of ['maker','p3']){const w=await world(p);for(const e of (w.editions as any[]).filter(e=>e.maker===p&&e.status==='open')){
    const entered=(await snapshot()).runs.filter((r:any)=>r.edition===e.id).length-prev.runs.filter((r:any)=>r.edition===e.id).length;
    const fee=Number(e.fee),next=entered===0?Math.max(0,fee-1):entered>=2?fee+1:fee;
    if(next!==fee){const r=await cmd(p,{type:'set_fee',edition_id:e.id,new_fee:String(next)});if(r.ok)events.push(`${p} ${next<fee?'cut':'raised'} the entry fee of ${e.terms.title} to ${next} (${entered} entries today)`);}
   }}
   const s=await snapshot();
   const drift=supply(s)-issuance(s)-baseline;
   const prices:Record<string,{min:number;max:number;count:number}>={};
   for(const l of s.listings.filter((l:any)=>l.status==='active'))for(const id of l.remaining_ids){const it=s.items.find((i:any)=>i.id===id);if(!it)continue;const p=prices[it.item_type]??={min:Infinity,max:0,count:0};p.min=Math.min(p.min,Number(l.unit_price));p.max=Math.max(p.max,Number(l.unit_price));p.count++;}
   const treasure=s.editions.reduce((a:any,e:any)=>({extracted:a.extracted+Number(e.extracted_value),consumed:a.consumed+Number(e.consumed_value),banked:a.banked+Number(e.banked_value)}),{extracted:0,consumed:0,banked:0});
   const absent=s.editions.filter((e:any)=>!e.closed&&s.runs.filter((r:any)=>r.edition===e.id).length===prev.runs.filter((r:any)=>r.edition===e.id).length).map((e:any)=>e.terms.title);
   const report:DayReport={day,coinsInPurses:Object.values(s.credits).reduce((n:number,v:any)=>n+Number(v),0),bank:Number(s.bank),issuance:Number(issuance(s)),conservationDrift:Number(drift),
    entryFees:Number(tally.fees),wages:Number(tally.wages),playerTrades:tally.trades,tradeCoins:Number(tally.tradeCoins),bankSales:tally.bankSales,batchesBrewed:tally.crafted,runs:tally.runs,
    treasureValue:treasure,listings:Object.fromEntries(Object.entries(prices).map(([k,v])=>[k,{min:v.min,max:v.max,count:v.count}])),unsoldItems:Object.values(prices).reduce((n,v)=>n+v.count,0),
    bankStock:s.items.filter((i:any)=>i.location.kind==='bank').length,absentDemand:absent,events};
   history.days.push(report);writeFileSync(historyPath,JSON.stringify(history,null,1));
   console.log(`Day ${day}: purses ${report.coinsInPurses} · bank ${report.bank} · fees ${report.entryFees} · wages ${report.wages} · trades ${report.playerTrades} · brewed ${report.batchesBrewed} · runs ${JSON.stringify(report.runs)} · unsold ${report.unsoldItems} · drift ${report.conservationDrift}${drift!==0n?' ← CONSERVATION FAILURE':''}`);
   if(drift!==0n)throw Error('Conservation check failed on day '+day);
   prev=s;
  }
  history.finishedAt=new Date().toISOString();writeFileSync(historyPath,JSON.stringify(history,null,1));
  console.log(`SIMULATION finished: ${days} days in ${Math.round((Date.now()-started)/1000)}s. History: ${historyPath}`);
 }finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}

 async function recovery(p:string,events:string[]){
  const w=await api(p,'world');const bank=(w.bankItems as any[]);const inputs=[...bank.filter(i=>i.item_type==='herb').slice(0,2),...bank.filter(i=>i.item_type==='flask').slice(0,2)].map(i=>i.id);
  if(inputs.length<4)return false;const ok=await craftSteps(p,inputs,true);if(ok)events.push(`${p} took a recovery job at the Kettle`);return ok;
 }
 async function brew(p:string,inputs:string[],events:string[]){const ok=await craftSteps(p,inputs,false);if(ok)events.push(`${p} brewed a batch of tonics`);return ok;}
 async function craftSteps(p:string,inputs:string[],recovery:boolean){
  let v=await api(p,'craft/begin',{id:randomUUID(),inputIds:inputs,recovery});
  for(let i=0;i<20&&v.status==='pending';i++){await new Promise(r=>setTimeout(r,500));v=(await api(p,'world')).craft;}
  if(v?.status!=='active')return false;
  for(let step=0;step<3;step++){v=await api(p,'craft/start',{batch:v.id,id:randomUUID(),seq:v.seq,step});await new Promise(r=>setTimeout(r,150+Math.floor(rand()*300)));v=await api(p,'craft/input',{batch:v.id,id:randomUUID(),seq:v.seq,step});}
  for(let i=0;i<30&&v.status!=='finished';i++){await new Promise(r=>setTimeout(r,500));v=(await api(p,'world')).craft;}
  return v?.status==='finished';
 }
 async function play(p:string,policy:Policy):Promise<'extracted'|'died'|'abandoned'>{
  const run=(await api(p,'world')).runs.find((r:any)=>!r.terminal);if(!run)return 'abandoned';
  let floorTurns=0,room=0;
  for(let i=0;i<400;i++){
   const saved=db.get<SavedRun>('run',run.id);if(!saved||saved.state.status!=='active')break;
   if(saved.state.roomIndex!==room){room=saved.state.roomIndex;floorTurns=0;}else floorTurns++;
   let action=choose(saved.state,policy,floorTurns);
   try{await api(p,`runs/${run.id}/action`,{id:randomUUID(),seq:saved.seq,action});}catch{try{await api(p,`runs/${run.id}/action`,{id:randomUUID(),seq:saved.seq,action:{type:'wait'}});}catch{break;}}
  }
  let saved=db.get<SavedRun>('run',run.id);
  if(saved?.state.status==='active'){await api(p,`runs/${run.id}/abandon`,{});}
  for(let i=0;i<30;i++){const w=await api(p,'world');const r=w.runs.find((r:any)=>r.id===run.id);if(r?.settlement?.status==='Applied')break;await new Promise(r=>setTimeout(r,500));}
  saved=db.get<SavedRun>('run',run.id);const t=saved?.terminal;return t==='extracted'?'extracted':t==='died'?'died':'abandoned';
 }

 if(!args['exit-when-done']){
  writeFileSync('.state/sandbox.json',JSON.stringify(local),{mode:0o600,flag:'wx'});
  console.log('Sandbox stays up with the simulated town. Start `npm run server` and `npm run dev`, then open the harbor notice board → Town history. Ctrl-C stops it.');
  await new Promise<void>(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
  unlinkSync('.state/sandbox.json');
 }
}finally{const child=(sandbox as unknown as {childProcess:ChildProcess}).childProcess;const timer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},5000);try{await sandbox.tearDown();}finally{clearTimeout(timer);}}
