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
import {Store} from '../apps/server/src/db';import {Outbox} from '../apps/server/src/outbox';import {NearChain} from '../apps/server/src/chain';import {Runs,type SavedRun} from '../apps/server/src/runs';import {httpServer} from '../apps/server/src/http';import {CostJournal} from '../apps/server/src/cost-ledger';import {withArchive} from '../apps/server/src/history-archive';import {DemoSessions} from '../apps/server/src/auth';
import {apiClient,seedDemoTown,presetPublication} from './demo-town';
import {creatorFunding} from '../packages/shared/src/creator-rewards';
import {choose,type Policy} from './depth-sim';
import type {DayReport,TownHistory} from '../packages/shared/src/town-history';

const {values:args}=parseArgs({options:{days:{type:'string',default:'7'},seed:{type:'string',default:'1'},'exit-when-done':{type:'boolean',default:false},players:{type:'string',default:'0'},scenario:{type:'string',default:'normal'},levers:{type:'string',default:''}}});
const days=Math.max(1,Math.min(30,Number(args.days)||7));let rng=Number(args.seed)||1;
const rand=()=>{rng=(rng*1103515245+12345)%2147483648;return rng/2147483648;};
// Economy levers under test (docs/systems/ECONOMY-TUNING.md): --levers refresh,smallbatch
// Default: all tuned player strategies on (each backed by an in-game prompt); `--levers none` reproduces the baseline.
const LEVERS=new Set(String(args.levers||'refresh,shelfsource,bankrestock,resale,fastfee,smallbatch,commission,prices,herbloot').split(',').filter(l=>l&&l!=='none'));
// --players N adds N simulation profiles (makers m-*, artisans a-*, delvers d-*) via the contract's init_simulation seed.
const extra=Math.max(0,Math.min(48,Number(args.players)||0));const scenario=String(args.scenario||'normal');
const nMakers=extra?Math.max(1,Math.round(extra*0.2)):0,nArtisans=extra?Math.max(1,Math.round(extra*0.3)):0,nDelvers=extra?Math.max(1,extra-nMakers-nArtisans):0;
const ids=(prefix:string,n:number)=>Array.from({length:n},(_,i)=>`${prefix}-${i}`);
const ROLES={makers:['maker','p3',...ids('m',nMakers)],artisans:['worker2','p4',...ids('a',nArtisans)],delvers:scenario==='collapse'&&nDelvers?ids('d',nDelvers):['buyer','p5','p2',...ids('d',nDelvers)],newcomers:['worker','worker2'],merchants:['p2']};
const POLICIES:Policy[]=['cautious','greedy','reckless'];
const PROFILES=[...new Set(['buyer','maker','p2','p3','p4','p5','worker','worker2',...Object.values(ROLES).flat()])];

const genesis=GenesisAccount.createDefault();const sandbox=await Sandbox.start({});
const started=Date.now();
try{
 const provider=new JsonRpcProvider({url:sandbox.rpcUrl});const root=new Account(genesis.accountId,provider,genesis.privateKey as KeyPairString);
 await root.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
 await root.callFunction({contractId:genesis.accountId,methodName:extra?'init_simulation':'init_demo_extended',args:extra?{makers:nMakers,artisans:nArtisans,delvers:nDelvers,delver_coins:scenario==='collapse'?'0':'10'}:{},gas:300_000_000_000_000n,waitUntil:'FINAL'});
 const now=await provider.callFunction<string>({contractId:genesis.accountId,method:'clock_ms',args:{},blockQuery:{finality:'final'}});
 for(const {id,command} of starterTownCommands(Number(now))){const r=await root.callFunction<any>({contractId:genesis.accountId,methodName:'execute',args:{op_id:id,command},gas:100_000_000_000_000n,waitUntil:'FINAL'});if(r.status!=='Applied')throw Error('Starter town failed: '+r.result);}
 const local={epoch:randomUUID(),profiles:PROFILES,rpcUrl:sandbox.rpcUrl,accountId:genesis.accountId,privateKey:genesis.privateKey};
 mkdirSync('.state/'+local.epoch,{recursive:true,mode:0o700});
 const db=new Store('.state/'+local.epoch+'/server.sqlite');
 const chain=new NearChain(provider,KeyPairSigner.fromSecretKey(local.privateKey as KeyPairString),local.accountId,local.accountId);
 const snapshot=()=>provider.callFunction<any>({contractId:local.accountId,method:'snapshot',args:{},blockQuery:{finality:'final'}});
 // The outbox mirrors the contract's whole receipt window; history views see pruned terminal records via the server archive.
 const receiptWindow=await provider.callFunction<any>({contractId:local.accountId,method:'capacity',args:{},blockQuery:{finality:'final'}});
 const cap=receiptWindow.receipts.recent_capacity+receiptWindow.receipts.tombstone_capacity;
 const served=()=>snapshot().then((s:any)=>withArchive(db,s));
 const box=new Outbox(db,chain,new CostJournal(db,served),{capacity:cap});
 const {server}=httpServer(box,new Runs(db,box),served,new DemoSessions({profiles:PROFILES,secureCookies:false}));
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const api=apiClient('http://127.0.0.1:'+(server.address() as AddressInfo).port);
 const history:TownHistory={label:'SIMULATION',days:[],startedAt:new Date().toISOString(),note:'Bot players acting through the real server and contract on an isolated local sandbox. Each day is one round of bot turns; chain time does not jump. Not organic activity.'};
 const historyPath='.state/'+local.epoch+'/town-history.json';
 try{
  await seedDemoTown(api,()=>{});
  // Extra makers each open a small generated dungeon funded with their own swords/tonics (random reward pool).
  for(const [k,p] of ROLES.makers.filter(m=>m.startsWith('m-')).entries()){
   const w=await api(p,'world');const pub=presetPublication(1000+k,'small',`Vault of ${p}`,Date.now(),true);
   const goods=(w.items as any[]).filter(i=>i.item_type==='tonic'||i.item_type==='sword').map(i=>i.id);
   const f=creatorFunding(pub.placements,goods,goods,w.items,w.profile);
   const r=await api(p,'command',{id:'sim-open-'+p,action:f.randomSocketCount?{type:'publish_random',terms:pub.terms,fee:'2',fixed_funding:f.fixed_funding,random_tables:f.random_tables}:{type:'publish',terms:{...pub.terms,no_reward:true},fee:'2',funding:[]}});
   if(r.status!=='Applied')console.log(`(${p} could not open its dungeon: ${r.result})`);
  }
  let opSeq=0;const cmd=async(profile:string,action:any)=>{const r=await api(profile,'command',{id:`sim-${++opSeq}`,action});return {ok:r.status==='Applied',result:r.result as string};};
  const world=(p:string)=>api(p,'world');
  // Coins anywhere: purses, bank, entry fees in escrow, the bank's reserved wage budget and wages reserved for active jobs, and the seeded NPC order budget.
  const supply=(s:any)=>Object.values(s.credits).reduce((n:bigint,v:any)=>n+BigInt(v),0n)+BigInt(s.bank)+s.runs.filter((r:any)=>r.status==='active').reduce((n:bigint,r:any)=>n+BigInt(r.fee),0n)
   +BigInt(s.recovery?.budget??0)+s.batches.filter((b:any)=>b.recovery&&b.status==='active').reduce((n:bigint,b:any)=>n+BigInt(b.wage_reserved),0n)+BigInt(s.npc_order?.budget??0)+(s.commissions??[]).reduce((n:bigint,c:any)=>n+BigInt(c.escrow),0n);
  const issuance=(s:any)=>BigInt(s.coin_issuance?.coins_issued??0);
  const start=await snapshot();const baseline=supply(start)-issuance(start);
  let prev=start;
  // Price discovery: artisans' asks and makers' commission bids move with yesterday's fills, within their cash.
  const ask=new Map<string,number>(),bid=new Map<string,number>();const priceObs:Record<string,number[]>={};
  const observe=(type:string,price:number)=>{(priceObs[type]??=[]).push(price);};
  for(let day=1;day<=days;day++){
   const events:string[]=[];const tally={issued:0,fees:0n,wages:0n,trades:0,tradeCoins:0n,bankSales:0,crafted:0,runs:{extracted:0,died:0,abandoned:0}};
   // Newcomers: one recovery job each while the bank's wage budget lasts.
   for(const p of ROLES.newcomers){
    const w=await world(p);if(!w.recoveryOffer?.eligible)continue;
    const job=await recovery(p,events);if(job){tally.wages+=BigInt(w.recoveryOffer.wage??'2');}
   }
   // Artisans: buy two herbs and two flasks from the bank when affordable, brew, and put tonics on sale.
   for(const p of ROLES.artisans){
    let w=await world(p);const has=(t:string)=>w.items.filter((i:any)=>i.item_type===t).map((i:any)=>i.id);
    if(has('herb').length<2||has('flask').length<2){
     const bank=w.bankItems as any[];const need=[...bank.filter(i=>i.item_type==='herb').slice(0,2-Math.min(2,has('herb').length)),...bank.filter(i=>i.item_type==='flask').slice(0,2-Math.min(2,has('flask').length))];
     if(LEVERS.has('shelfsource')){const short=(t:string)=>Math.max(0,2-has(t).length-need.filter(i=>i.item_type===t).length);
      for(const t of ['herb','flask'])for(let k=short(t);k>0;k--){const w4=await world(p);const listed=w4.listedItems as any[];const o=(w4.listings as any[]).filter(l=>l.status==='active'&&l.seller!==p&&!w4.reservations?.[l.id]).flatMap(l=>listed.filter(i=>i.location.listing===l.id&&l.remaining_ids.includes(i.id)&&i.item_type===t).map(i=>({l,i}))).sort((a,b)=>Number(a.l.unit_price)-Number(b.l.unit_price))[0];
       if(!o||BigInt(o.l.unit_price)>BigInt(w4.credits))break;const r=await cmd(p,{type:'buy',listing_id:o.l.id,item_ids:[o.i.id],expected_unit_price:o.l.unit_price});if(r.ok){tally.trades++;tally.tradeCoins+=BigInt(o.l.unit_price);events.push(`${p} bought a ${t} for ${o.l.unit_price} from ${o.l.seller}`);}}
      w=await world(p);}
     const cost=need.reduce((n,i)=>n+catalog[i.item_type as keyof typeof catalog].value,0);
     if(need.length&&cost<=Number(w.credits)){const r=await cmd(p,{type:'bank_buy',item_ids:need.map(i=>i.id),expected_unit_prices:need.map(i=>String(catalog[i.item_type as keyof typeof catalog].value))});if(r.ok)events.push(`${p} bought ${need.length} ingredients from the bank for ${cost}`);}
     w=await world(p);
    }
    if(LEVERS.has('smallbatch')&&(has('herb').length<1||has('flask').length<1)&&Number(w.credits)>=4){const bank=w.bankItems as any[];const one=[bank.find(i=>i.item_type==='herb'),bank.find(i=>i.item_type==='flask')].filter(Boolean);
     if(one.length===2){const r=await cmd(p,{type:'bank_buy',item_ids:one.map((i:any)=>i.id),expected_unit_prices:['2','2']});if(r.ok)events.push(`${p} bought 1 herb and 1 flask from the bank for 4`);w=await world(p);}}
    if(has('herb').length>=2&&has('flask').length>=2&&await brew(p,[...has('herb').slice(0,2),...has('flask').slice(0,2)],events))tally.crafted++;
    else if(LEVERS.has('smallbatch')&&has('herb').length>=1&&has('flask').length>=1&&await brew(p,[has('herb')[0],has('flask')[0]],events)){tally.crafted++;events.push(`${p} brewed a small batch (1 tonic)`);}
    if(LEVERS.has('commission'))await fillCommissions(p,events,tally);
    w=await world(p);const tonics=w.items.filter((i:any)=>i.item_type==='tonic'||i.item_type==='fineTonic');
    // Ask: raise after a sale since yesterday, cut (and relist) stock that sat unsold for a day; never below cost (4).
    {const now=await snapshot();const mine=(l:any)=>l.seller===p&&l.status==='active';let soldAny=false;
     for(const l of prev.listings.filter((l:any)=>l.seller===p)){const cur=now.listings.find((x:any)=>x.id===l.id);if(cur&&cur.remaining_ids.length<l.remaining_ids.length)soldAny=true;}
     const key=p+':tonic';let a=ask.get(key)??5;if(soldAny)a=Math.min(9,a+1);
     const stale=now.listings.filter((l:any)=>mine(l)&&prev.listings.some((x:any)=>x.id===l.id&&x.remaining_ids.length===l.remaining_ids.length)&&l.remaining_ids.some((id:string)=>{const it=now.items.find((i:any)=>i.id===id);return it&&(it.item_type==='tonic'||it.item_type==='fineTonic');}));
     if(stale.length&&!soldAny)a=Math.max(4,a-1);// never below ingredient cost (8 coins of inputs make 2 tonics)
     ask.set(key,a);
     if(LEVERS.has('prices'))for(const l of stale)if(Number(l.unit_price)>a){const r=await cmd(p,{type:'cancel_listing',listing_id:l.id});if(r.ok)events.push(`${p} took back ${l.remaining_ids.length} unsold goods priced ${l.unit_price} to reprice at ${a}`);}}
    w=await world(p);const tonics2=w.items.filter((i:any)=>i.item_type==='tonic'||i.item_type==='fineTonic');tonics.splice(0,tonics.length,...tonics2);
    if(tonics.length){const shop=(w.shops??[]).find((s:any)=>s.owner===p);const price=String(LEVERS.has('prices')?ask.get(p+':tonic')??5:4+Math.floor(rand()*3));
     const r=await cmd(p,shop?{type:'stock_shop',shop_id:shop.id,item_ids:tonics.map((i:any)=>i.id),unit_price:price}:{type:'list',item_ids:tonics.map((i:any)=>i.id),unit_price:price});
     if(r.ok)events.push(`${p} put ${tonics.length} tonics on sale at ${price}${shop?` in ${shop.title}`:' at the market'}`);}
   }
   // Delvers: pay into an open dungeon they can afford, pack a weapon if owned, and play it out.
   for(const [p,policy] of ROLES.delvers.map((d,i)=>[d,POLICIES[i%3]] as [string,Policy])){
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
    if(LEVERS.has('commission'))await fillCommissions(p,events,tally);
    // Cash in finds: keep the best weapon, sell spare swords/armor/iron to the bank at half catalog value.
    {const after=await world(p);const items=after.items as any[];const keep=items.filter(i=>i.item_type==='sword')[0]??items.filter(i=>i.item_type==='club')[0];
     const spare=items.filter(i=>i!==keep&&['sword','armor','iron','club',...(LEVERS.has('herbloot')?['herb','flask']:[])].includes(i.item_type)).slice(0,3);const prices=spare.map(i=>String(Math.floor(catalog[i.item_type as keyof typeof catalog].value/2)));
     if(LEVERS.has('resale')&&spare.length){const price=(t:string)=>String(Math.max(1,Math.round(catalog[t as keyof typeof catalog].value*0.8)));
      for(const i of spare){const r=await cmd(p,{type:'list',item_ids:[i.id],unit_price:price(i.item_type)});if(r.ok)events.push(`${p} offered a found ${catalog[i.item_type as keyof typeof catalog].name.toLowerCase()} at ${price(i.item_type)}`);}}
     else if(spare.length&&prices.reduce((n,x)=>n+Number(x),0)<=Number(after.bank)){const r=await cmd(p,{type:'bank_sell',item_ids:spare.map(i=>i.id),expected_unit_prices:prices});if(r.ok){tally.bankSales+=spare.length;events.push(`${p} sold ${spare.length} dungeon finds to the bank for ${prices.reduce((n,x)=>n+Number(x),0)}`);}}}
   }
   // Merchants: the mercenary buys the cheapest tonic on offer when it can resell to the bank or the NPC order at a profit.
   for(const p of ROLES.merchants){const w=await world(p);const listed=w.listedItems as any[];const offers=(w.listings as any[]).filter(l=>l.status==='active'&&l.seller!==p&&!w.reservations?.[l.id]);
    const best=offers.map(l=>({l,item:listed.find(i=>i.location.listing===l.id&&l.remaining_ids.includes(i.id))})).filter(x=>x.item&&(x.item.item_type==='tonic'||x.item.item_type==='fineTonic')).sort((a,b)=>Number(a.l.unit_price)-Number(b.l.unit_price))[0];
    const resale=best&&Math.floor(catalog[best.item.item_type as keyof typeof catalog].value/2);
    if(best&&Number(best.l.unit_price)<=Number(w.credits)&&(Number(best.l.unit_price)<resale!||day%2===0)){
     const r=await cmd(p,{type:'buy',listing_id:best.l.id,item_ids:[best.item.id],expected_unit_price:best.l.unit_price});
     if(r.ok){tally.trades++;tally.tradeCoins+=BigInt(best.l.unit_price);events.push(`${p} bought a ${catalog[best.item.item_type as keyof typeof catalog].name.toLowerCase()} for ${best.l.unit_price} from ${best.l.seller}`);}
    }}
   // Bank sales: anyone holding spare tonics sells one to the bank for coins (half catalog value).
   for(const p of ROLES.delvers){const w=await world(p);const t=(w.items as any[]).find(i=>i.item_type==='tonic');if(!t)continue;const price=String(Math.floor(catalog.tonic.value/2));
    if(BigInt(w.bank)>=BigInt(price)){const r=await cmd(p,{type:'bank_sell',item_ids:[t.id],expected_unit_prices:[price]});if(r.ok){tally.bankSales++;events.push(`${p} sold a tonic to the bank for ${price}`);}}}
   // Makers reinvest (lever 1): a treasure dungeon with nothing left below is refreshed with tonics bought from players' shelves.
   if(LEVERS.has('refresh'))for(const p of ROLES.makers){const w=await world(p);const snap=await snapshot();
    for(const e of (w.editions as any[]).filter(e=>e.maker===p&&!e.closed&&e.terms.sockets.some((x:any)=>x.reward)) ){const types=new Set(e.terms.sockets.map((x:any)=>x.reward).filter(Boolean));
     // Restock when no complete reward copy is left (the edition reports no open places), buying exactly what one copy lacks.
     if(e.status==='open'&&e.bundles>0)continue;
     const need=new Map<string,number>();for(const x of e.terms.sockets)if(x.reward)need.set(x.reward,(need.get(x.reward)??0)+1);
     for(const i of snap.items)if(i.location.kind==='edition_fixed'&&i.location.edition===e.id)need.set(i.item_type,(need.get(i.item_type)??0)-1);
     const missing=[...need].filter(([,n])=>n>0);if(!missing.length)continue;
     const bought:string[]=[];const funding:string[]=[];
     for(const [type,n] of missing){
      const mine=((await world(p)).items as any[]).filter(i=>i.item_type===type&&!funding.includes(i.id)).slice(0,n).map(i=>i.id);funding.push(...mine);
      let left=n-mine.length;const w2=await world(p);const listed=w2.listedItems as any[];
      const offers=(w2.listings as any[]).filter(l=>l.status==='active'&&l.seller!==p&&!w2.reservations?.[l.id]).flatMap(l=>listed.filter(i=>i.location.listing===l.id&&l.remaining_ids.includes(i.id)&&i.item_type===type).map(i=>({l,i}))).sort((a,b)=>Number(a.l.unit_price)-Number(b.l.unit_price));
      for(const o of offers){if(left<=0||BigInt(o.l.unit_price)>BigInt((await world(p)).credits))break;const r=await cmd(p,{type:'buy',listing_id:o.l.id,item_ids:[o.i.id],expected_unit_price:o.l.unit_price});if(r.ok){bought.push(o.i.id);funding.push(o.i.id);left--;tally.trades++;tally.tradeCoins+=BigInt(o.l.unit_price);}}
      if(left>0&&LEVERS.has('bankrestock')&&!LEVERS.has('commission')){const w3=await world(p);const stock=(w3.bankItems as any[]).filter(i=>i.item_type===type).slice(0,left);const cost=stock.length*catalog[type as keyof typeof catalog].value;
       if(stock.length&&cost<=Number(w3.credits)){const r=await cmd(p,{type:'bank_buy',item_ids:stock.map(i=>i.id),expected_unit_prices:stock.map(()=>String(catalog[type as keyof typeof catalog].value))});if(r.ok){funding.push(...stock.map(i=>i.id));left-=stock.length;events.push(`${p} bought ${stock.length} ${type} from the bank for ${cost} to restock`);}}}
      if(left>0&&LEVERS.has('commission')){const w5=await world(p);const already=((w5.commissions??[]) as any[]).some(c=>c.buyer===p&&c.status==='open'&&c.item_type===type);const price=String(catalog[type as keyof typeof catalog].value);
       if(!already&&BigInt(price)*BigInt(left)<=BigInt(w5.credits)){const r=await cmd(p,{type:'post_commission',item_type:type,unit_price:price,quantity:left});if(r.ok)events.push(`${p} posted a commission: ${left} ${type} at ${price} each for ${e.terms.title}`);}}
      if(left>0&&!LEVERS.has('commission'))events.push(`${p} wants ${left} more ${type} to restock ${e.terms.title}; none on offer`);
     }
     const own=funding;
     if(own.length){const r=await cmd(p,{type:'refresh',edition_id:e.id,fixed_funding:own,random_funding:[]});if(!r.ok)events.push(`${p} could not restock ${e.terms.title}: ${r.result}`);if(r.ok)events.push(`${p} restocked ${e.terms.title} with ${own.length} goods${bought.length?` (bought ${bought.length} from players' shelves)`:''}`);}
    }}
   // Makers with idle coins commission tonics from artisans for future restocks (coins go to players, not the bank).
   if(LEVERS.has('commission'))for(const p of ROLES.makers){const w=await world(p);const open=((w.commissions??[]) as any[]).some(c=>c.buyer===p&&c.status==='open');
    let b=bid.get(p)??(LEVERS.has('prices')?5:6);
    if(LEVERS.has('prices')){const mineOpen=((w.commissions??[]) as any[]).filter(c=>c.buyer===p&&c.status==='open'&&c.item_type==='tonic');
     const filledToday=((w.commissions??[]) as any[]).some(c=>c.buyer===p&&c.status==='filled'&&!(prev.commissions??[]).some((x:any)=>x.id===c.id&&x.status==='filled'));
     if(filledToday)b=Math.max(3,b-1);
     for(const c of mineOpen)if(c.filled===0&&(prev.commissions??[]).some((x:any)=>x.id===c.id)){b=Math.min(9,b+1);const r=await cmd(p,{type:'cancel_commission',commission_id:c.id});if(r.ok)events.push(`${p} withdrew an unfilled commission at ${c.unit_price} to bid ${b}`);}
     bid.set(p,b);}
    const stillOpen=(((await world(p)).commissions??[]) as any[]).some(c=>c.buyer===p&&c.status==='open');
    if(!stillOpen&&Number((await world(p)).credits)>=Math.max(20,b*2)){const r=await cmd(p,{type:'post_commission',item_type:'tonic',unit_price:String(b),quantity:2});if(r.ok)events.push(`${p} posted a commission for 2 tonics at ${b} each`);}}
   // OPERATOR RESTOCK (lever restock, OFF by default; central issuance policy for comparison only): when the bank holds
   // fewer than 2 herbs or flasks, the operator adds 4 of each to the bank's stock (goods, never coins).
   if(LEVERS.has('restock')){const snap=await snapshot();for(const t of ['herb','flask']){const n=snap.items.filter((i:any)=>i.location.kind==='bank'&&i.item_type===t).length;
    if(n<2){await root.callFunction({contractId:local.accountId,methodName:'operator_restock',args:{item_type:t,count:4},gas:100_000_000_000_000n,waitUntil:'FINAL'});tally.issued+=4;events.push(`OPERATOR ISSUANCE: 4 ${t}s added to the bank's stock`);}}}
   // Herbs and flasks as dungeon treasure (lever herbloot, no issuance): makers holding ingredients refill an emptied
   // random reward pool with them, so delvers bring them back out to sell to artisans.
   if(LEVERS.has('herbloot'))for(const p of ROLES.makers){const w=await world(p);const snap=await snapshot();
    for(const e of (w.editions as any[]).filter(e=>e.maker===p&&!e.closed&&(e.randomTables??[]).length)){
     const below=snap.items.filter((i:any)=>i.location.kind==='edition_random'&&i.location.edition===e.id).length;if(below>0)continue;
     const table=e.randomTables[0];const goods=(w.items as any[]).filter(i=>i.item_type==='herb'||i.item_type==='flask').slice(0,Math.max(table.socket_ids.length,2));
     if(goods.length<table.socket_ids.length)continue;
     const r=await cmd(p,{type:'refresh',edition_id:e.id,fixed_funding:[],random_funding:[{table_id:table.table_id,item_ids:goods.map(i=>i.id)}]});
     events.push(r.ok?`${p} refilled ${e.terms.title} with ${goods.length} herbs/flasks as treasure`:`${p} could not refill ${e.terms.title}: ${r.result}`);
    }}
   // Makers revise: cut the fee of an open dungeon nobody entered today; raise it when it was busy.
   for(const p of ROLES.makers){const w=await world(p);for(const e of (w.editions as any[]).filter(e=>e.maker===p&&e.status==='open')){
    // Settled runs are pruned on chain beyond a fixed history (CAPACITY.md): count runs that are new since yesterday.
    const entered=(await snapshot()).runs.filter((r:any)=>r.edition===e.id&&!prev.runs.some((x:any)=>x.id===r.id)).length;
    const broke=events.some(x=>/could not afford/.test(x));const cash=(await snapshot()).credits;const poorest=Math.min(...ROLES.delvers.map(d=>Number(cash[d]??0)));
    const fee=Number(e.fee),next=LEVERS.has('fastfee')?(entered===0&&(broke||fee>poorest)?Math.min(Math.floor(fee/2),poorest):entered>=3?fee+1:fee):entered===0?Math.max(0,fee-1):entered>=2?fee+1:fee;
    if(next!==fee){const r=await cmd(p,{type:'set_fee',edition_id:e.id,new_fee:String(next)});if(r.ok)events.push(`${p} ${next<fee?'cut':'raised'} the entry fee of ${e.terms.title} to ${next} (${entered} entries today)`);}
   }}
   const s=await snapshot();
   const drift=supply(s)-issuance(s)-baseline;
   const prices:Record<string,{min:number;max:number;count:number}>={};
   for(const l of s.listings.filter((l:any)=>l.status==='active'))for(const id of l.remaining_ids){const it=s.items.find((i:any)=>i.id===id);if(!it)continue;const p=prices[it.item_type]??={min:Infinity,max:0,count:0};p.min=Math.min(p.min,Number(l.unit_price));p.max=Math.max(p.max,Number(l.unit_price));p.count++;}
   const treasure=s.editions.reduce((a:any,e:any)=>({extracted:a.extracted+Number(e.extracted_value),consumed:a.consumed+Number(e.consumed_value),banked:a.banked+Number(e.banked_value)}),{extracted:0,consumed:0,banked:0});
   const absent=s.editions.filter((e:any)=>!e.closed&&!s.runs.some((r:any)=>r.edition===e.id&&!prev.runs.some((x:any)=>x.id===r.id))).map((e:any)=>e.terms.title);
   // Prices actually paid today: listing sales (remaining shrank since yesterday) and commission deliveries.
   const paid:Record<string,number[]>={};const typeOf=(id:string)=>s.items.find((i:any)=>i.id===id)?.item_type;
   for(const l of s.listings){const before=prev.listings.find((x:any)=>x.id===l.id);const was=before?before.remaining_ids:l.item_ids;for(const id of was)if(!l.remaining_ids.includes(id)){const t=typeOf(id);if(t)(paid[t]??=[]).push(Number(l.unit_price));}}
   for(const c of s.commissions??[]){const before=(prev.commissions??[]).find((x:any)=>x.id===c.id);for(let k=before?.filled??0;k<c.filled;k++)(paid[c.item_type]??=[]).push(Number(c.unit_price));}
   const bids:Record<string,number>={};for(const c of (s.commissions??[]).filter((c:any)=>c.status==='open'))bids[c.item_type]=Math.max(bids[c.item_type]??0,Number(c.unit_price));
   const role=(list:string[])=>list.reduce((n,p)=>n+Number(s.credits[p]??0),0);
   const report:DayReport={day,itemsIssued:tally.issued,coinsByRole:{makers:role(ROLES.makers),artisans:role(ROLES.artisans),delvers:role(ROLES.delvers)},pricesPaid:paid,bids,coinsInPurses:Object.values(s.credits).reduce((n:number,v:any)=>n+Number(v),0),bank:Number(s.bank),issuance:Number(issuance(s)),conservationDrift:Number(drift),
    entryFees:Number(tally.fees),wages:Number(tally.wages),playerTrades:tally.trades,tradeCoins:Number(tally.tradeCoins),bankSales:tally.bankSales,batchesBrewed:tally.crafted,runs:tally.runs,
    treasureValue:treasure,listings:Object.fromEntries(Object.entries(prices).map(([k,v])=>[k,{min:v.min,max:v.max,count:v.count}])),unsoldItems:Object.values(prices).reduce((n,v)=>n+v.count,0),
    bankStock:s.items.filter((i:any)=>i.location.kind==='bank').length,absentDemand:absent,events};
   history.days.push(report);writeFileSync(historyPath,JSON.stringify(history,null,1));
   console.log(`Day ${day}: purses ${report.coinsInPurses} · bank ${report.bank} · fees ${report.entryFees} · wages ${report.wages} · trades ${report.playerTrades} · brewed ${report.batchesBrewed} · runs ${JSON.stringify(report.runs)} · unsold ${report.unsoldItems} · drift ${report.conservationDrift}${drift!==0n?' ← CONSERVATION FAILURE':''}`);
   if(drift!==0n)throw Error('Conservation check failed on day '+day);
   prev=s;
  }
  const end=await snapshot();const D=history.days;const late=D.slice(-3);
  const summary={days:D.length,runsTotal:D.reduce((n,d)=>n+d.runs.extracted+d.runs.died+d.runs.abandoned,0),runsPerDayLast3:+(late.reduce((n,d)=>n+d.runs.extracted+d.runs.died+d.runs.abandoned,0)/late.length).toFixed(2),
   entryFeesTotal:D.reduce((n,d)=>n+d.entryFees,0),tradesTotal:D.reduce((n,d)=>n+d.playerTrades,0),batchesBrewed:D.reduce((n,d)=>n+d.batchesBrewed,0),bankSales:D.reduce((n,d)=>n+d.bankSales,0),
   treasureOut:D.at(-1)!.treasureValue.extracted,daysWithEmptyDungeon:D.filter(d=>d.absentDemand.length>0).length,delverCoinsEnd:ROLES.delvers.reduce((n,p)=>n+Number(end.credits[p]??0),0),
   makerCoinsEnd:ROLES.makers.reduce((n,p)=>n+Number(end.credits[p]??0),0),artisanCoinsEnd:ROLES.artisans.reduce((n,p)=>n+Number(end.credits[p]??0),0),unsoldEnd:D.at(-1)!.unsoldItems,bankEnd:D.at(-1)!.bank,
   delversBrokeDays:D.filter(d=>d.events.some(e=>/could not afford/.test(e))).length,batchesAfterDay5:D.filter(d=>d.day>5).reduce((n,d)=>n+d.batchesBrewed,0),itemsIssued:D.reduce((n,d)=>n+(d.itemsIssued??0),0)};
  (history as any).summary=summary;console.log('SUMMARY '+JSON.stringify(summary));
  // Bounded storage (docs/systems/CAPACITY.md): live records and the receipt window after the whole run.
  console.log('CAPACITY '+JSON.stringify(await provider.callFunction<any>({contractId:local.accountId,method:'capacity',args:{},blockQuery:{finality:'final'}})));
  history.finishedAt=new Date().toISOString();writeFileSync(historyPath,JSON.stringify(history,null,1));
  console.log(`SIMULATION finished: ${days} days in ${Math.round((Date.now()-started)/1000)}s. History: ${historyPath}`);
 }finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}

 async function fillCommissions(p:string,events:string[],tally:any){
  const w=await api(p,'world');for(const c of ((w.commissions??[]) as any[]).filter(c=>c.status==='open'&&c.buyer!==p)){
   const have=(w.items as any[]).filter(i=>i.item_type===c.item_type).slice(0,c.quantity-c.filled);if(!have.length)continue;
   const r=await api(p,'command',{id:randomUUID().slice(0,30),action:{type:'fill_commission',commission_id:c.id,item_ids:have.map(i=>i.id),expected_unit_price:c.unit_price}});
   if(r.status==='Applied'){tally.trades++;tally.tradeCoins+=BigInt(c.unit_price)*BigInt(have.length);events.push(`${p} delivered ${have.length} ${c.item_type} to ${c.buyer}'s commission for ${Number(c.unit_price)*have.length}`);}
  }
 }
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
