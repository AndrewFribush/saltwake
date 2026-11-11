import type {EconomySnapshot} from '../../../packages/shared/src/types';
import type {BusinessLedger,LedgerCash} from '../../../packages/shared/src/business-ledger';
import type {Store} from './db';
import {businessAccount} from './business-account';
import {currentCostState,costDisposals,editionCostReport} from './cost-ledger';
import {shopRecord} from './shop-record';

const sum=(xs:(string|null|undefined)[])=>xs.reduce<bigint>((n,s)=>n+(s===null||s===undefined?0n:BigInt(s)),0n);
const labels:Record<LedgerCash['category'],string>={trade:'Player trades',bank:'Bank trades',npc:'Seeded NPC order (subsidized)',entry:'Dungeon entry fees paid',maker:'Entry fees earned',placement:'Dungeon placement fees',wage:'Recovery wages',buyin:'Bought with NEAR (labelled issuance)'};

/** A player's business ledger, assembled only from confirmed receipts (businessAccount), the cost journal
 * (acquisition cost per good, or unknown) and authoritative edition, run, shop and batch records. Owner-only. */
export function businessLedger(world:EconomySnapshot,db:Store,profile:string):BusinessLedger{
 const account=businessAccount(world,db.operations(),profile);
 const groups=new Map<string,LedgerCash>();
 const add=(category:LedgerCash['category'],direction:'in'|'out',amount:string)=>{const key=category+direction;const g=groups.get(key)??{category,direction,amount:'0',count:0,label:labels[category]};g.amount=(BigInt(g.amount)+BigInt(amount)).toString();g.count++;groups.set(key,g);};
 for(const e of account.entries)if(!e.pending)add(e.category,e.direction,e.amount);
 // Wages: a finished recovery batch paid its reserved wage to the worker (authoritative batch record).
 for(const b of world.batches)if(b.actor===profile&&b.recovery&&b.status==='finished'&&/^\d+$/.test(b.wage_reserved))add('wage','in',b.wage_reserved);
 const bought=world.buy_ins?.[profile];if(bought&&/^\d+$/.test(bought)&&bought!=='0'){const g:LedgerCash={category:'buyin',direction:'in',amount:bought,count:1,label:labels.buyin};groups.set('buyinin',g);}
 const cash=[...groups.values()].sort((a,b)=>a.direction.localeCompare(b.direction)||Number(BigInt(b.amount)-BigInt(a.amount)));
 const state=currentCostState(db,world),disposals=costDisposals(db).filter(d=>d.owner===profile);
 const goods=world.items.filter(i=>i.location.kind==='owned'&&i.location.profile===profile).map(i=>{const lot=state.lots[i.id];return {itemId:i.id,itemType:i.item_type,cost:lot?.cost??null,source:lot?.source??'Unobserved acquisition'};});
 const editions=world.editions.filter(e=>e.maker===profile).map(e=>{const c=editionCostReport(db,world,e.id);const runs=world.runs.filter(r=>r.edition===e.id);
  return {id:e.id,title:e.terms.title,open:!e.closed,placement:c.placementCost,settledFees:c.settledFees,pendingFees:c.pendingFees,knownTreasureCost:c.knownTreasureCost,unknownTreasureItems:c.unknownTreasureItems,contribution:c.contribution,
   settledRuns:runs.filter(r=>r.status!=='active'&&r.status!=='void').length,activeRuns:runs.filter(r=>r.status==='active').length,
   fundedGoodsRemaining:world.items.filter(i=>(i.location.kind==='edition_fixed'||i.location.kind==='edition_random')&&i.location.edition===e.id).length};});
 const open=editions.filter(e=>e.open);
 const shops=(world.shops??[]).filter(s=>s.owner===profile).map(s=>{const r=shopRecord(world,db.operations(),s.id);const listed=new Set(world.listings.filter(l=>s.listing_ids.includes(l.id)).flatMap(l=>l.item_ids));
  const sold=new Set(r.sales.flatMap(x=>x.itemIds));const sales=disposals.filter(d=>d.reason==='sale'&&listed.has(d.itemId)&&sold.has(d.itemId));
  const unknown=r.recordedItems-sales.filter(d=>d.cost!==null).length;const matched=sum(sales.map(d=>d.cost));
  return {id:s.id,title:s.title,open:s.open,revenue:r.recordedRevenue,itemsSold:r.recordedItems,matchedCost:matched.toString(),unknownCostItems:Math.max(0,unknown),contribution:unknown>0||r.coverage!=='complete'?null:(BigInt(r.recordedRevenue)-matched).toString(),coverage:r.coverage,stockItems:r.stockItems};});
 const recordedIn=cash.filter(c=>c.direction==='in').reduce((n,c)=>n+BigInt(c.amount),0n),recordedOut=cash.filter(c=>c.direction==='out').reduce((n,c)=>n+BigInt(c.amount),0n);
 const activeRuns=world.runs.filter(r=>r.status==='active');
 return {cash,recordedIn:recordedIn.toString(),recordedOut:recordedOut.toString(),goods,knownGoodsCost:sum(goods.map(g=>g.cost)).toString(),unknownCostGoods:goods.filter(g=>g.cost===null).length,
  committedFunding:{editions:open.length,goods:open.reduce((n,e)=>n+e.fundedGoodsRemaining,0),knownCost:sum(open.map(e=>e.knownTreasureCost)).toString(),unknownCostItems:open.reduce((n,e)=>n+e.unknownTreasureItems,0)},
  pending:{makerFees:account.pendingIncome,recoveryWages:sum(world.batches.filter(b=>b.actor===profile&&b.recovery&&b.status==='active').map(b=>b.wage_reserved)).toString(),reservedRunFees:sum(activeRuns.filter(r=>r.player===profile).map(r=>r.fee)).toString()},
  editions,shops,reconciliation:(()=>{const purse=BigInt(world.credits[profile]??'0'),reserved=sum(activeRuns.filter(r=>r.player===profile).map(r=>r.fee)),net=recordedIn-recordedOut;
   // Active entry fees are already counted as paid out; the purse no longer holds them either.
   return {purse:purse.toString(),recordedNet:net.toString(),unexplained:(purse-net).toString(),startsAtZero:profile.startsWith('wallet:')};})(),notes:[
   'Game coins are synthetic test credits. Nothing here is real money or real profit.',
   'Cash rows come only from confirmed receipts and contract records kept by this server, plus NEAR buy-ins recorded on the contract. Wallet players start with 0 coins, so their purse should equal the recorded net; demo characters began with a starting allocation, shown as unexplained.',
   'A good’s cost is known only when its purchase was observed; otherwise it is shown as unknown and any total that depends on it is left blank, never estimated from catalog values.',
   ...account.limitations.slice(2),
  ]};
}
