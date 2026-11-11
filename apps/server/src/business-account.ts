import type {EconomySnapshot} from '../../../packages/shared/src/types';
import type {BusinessAccount,CashEntry} from '../../../packages/shared/src/business-account';
import type {StoredOperation} from './db';
import {commandHash} from '../../../packages/shared/src/protocol';

/** Operation insertion order is not chain ordering. Sum independent cash movements;
 * use authoritative runs/editions for fees, never count settle/admit receipts again.
 * No reconstruction of item basis from an incomplete or unordered receipt history.
 */
export function businessAccount(world:EconomySnapshot,operations:readonly StoredOperation[],profile:string):BusinessAccount{
 const entries:CashEntry[]=[],seen=new Set<string>();
 const add=(id:string,category:CashEntry['category'],direction:CashEntry['direction'],amount:string,detail:string,pending=false)=>{if(!/^\d+$/.test(amount))return;entries.push({id,category,direction,amount,detail,...(pending?{pending:true}:{})});};
 for(const op of operations){
  const receipt=op.receipt,a=op.command.action,actor=op.command.actor;
  if(seen.has(op.id)||op.status!=='Applied'||receipt?.status!=='Applied'||receipt.op_id!==op.id||receipt.payload_hash!==op.hash||commandHash(op.command)!==op.hash)continue;
  seen.add(op.id);
  if(a.type==='buy'){
   const l=world.listings.find(l=>l.id===a.listing_id);
   if(!l||receipt.result!==l.id||l.seller===actor||a.expected_unit_price!==l.unit_price||!/^\d+$/.test(l.unit_price)||!a.item_ids.length||new Set(a.item_ids).size!==a.item_ids.length||a.item_ids.some(id=>!l.item_ids.includes(id)))continue;
   const amount=(BigInt(l.unit_price)*BigInt(a.item_ids.length)).toString();
   if(actor===profile)add(op.id,'trade','out',amount,`Bought ${a.item_ids.length} goods from ${l.seller}`);
   if(l.seller===profile)add(op.id,'trade','in',amount,`Sold ${a.item_ids.length} goods to ${actor}`);
  }else if((a.type==='bank_buy'||a.type==='bank_sell')&&actor===profile){
   if(receipt.result!==a.type||!a.item_ids.length||a.item_ids.length!==a.expected_unit_prices.length||new Set(a.item_ids).size!==a.item_ids.length||a.expected_unit_prices.some(p=>!/^\d+$/.test(p)))continue;
   add(op.id,'bank',a.type==='bank_buy'?'out':'in',a.expected_unit_prices.reduce((n,p)=>n+BigInt(p),0n).toString(),`${a.type==='bank_buy'?'Bought':'Sold'} ${a.item_ids.length} bank goods`);
  }else if(a.type==='fill_npc_order'&&actor===profile&&receipt.result===a.order_id&&/^\d+$/.test(a.expected_unit_price)&&a.item_ids.length&&new Set(a.item_ids).size===a.item_ids.length){
   add(op.id,'npc','in',(BigInt(a.expected_unit_price)*BigInt(a.item_ids.length)).toString(),'Seeded NPC order (subsidized demand)');
  }
 }
 for(const e of world.editions.filter(e=>e.maker===profile))add(`placement:${e.id}`,'placement','out',e.placement_paid,`Placement fee · ${e.id}`);
 for(const r of world.runs){
  if(r.status==='void')continue; // Net-zero refunded entry; never maker income.
  if(r.player===profile)add(`entry:${r.id}`,'entry','out',r.fee,`${r.status==='active'?'Reserved':'Settled'} entry · ${r.id}`);
  if(world.editions.some(e=>e.id===r.edition&&e.maker===profile))add(`maker:${r.id}`,'maker','in',r.fee,`Admission income · ${r.id}`,r.status==='active');
 }
 const sum=(direction:'in'|'out',pending=false)=>entries.filter(e=>e.direction===direction&&!!e.pending===pending).reduce((n,e)=>n+BigInt(e.amount),0n);
 const incoming=sum('in'),outgoing=sum('out');
 return {entries,recordedIn:incoming.toString(),recordedOut:outgoing.toString(),recordedNet:(incoming-outgoing).toString(),pendingIncome:sum('in',true).toString(),limitations:[
  'Partial cash history: trades require retained matching receipts. Initial allocations, recovery wages and any unrecorded movements are excluded. Recorded net does not reconcile the purse.',
  'This is cash flow, not profit. Owned and committed treasure costs are not reconstructed from catalog values or an unordered receipt history. Funding already-owned goods is not a second cash purchase.',
  'Active entry fees have left the purse; active maker fees remain pending. Voided runs have zero net fees. Bank trades and seeded NPC demand are identified separately.'
 ]};
}
