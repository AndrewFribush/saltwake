import type {EconomySnapshot,Command} from '../../../packages/shared/src/types';
import type {CostState,CostDisposal,CostLot,CostReport,EditionCostReport} from '../../../packages/shared/src/cost-ledger';
import type {StoredOperation,Store} from './db';
import {commandHash} from '../../../packages/shared/src/protocol';

export function economicOwners(w:EconomySnapshot):Record<string,string>{
 const result:Record<string,string>={};
 for(const i of w.items){const l=i.location;
  if(l.kind==='owned'||l.kind==='loadout')result[i.id]=l.profile;
  else if(l.kind==='listed'){const listing=w.listings.find(x=>x.id===l.listing);if(listing)result[i.id]=listing.seller;}
  else if(l.kind==='crafting'){const b=w.batches.find(x=>x.id===l.batch);if(b&&!b.recovery)result[i.id]=b.actor;}
 }
 return result;
}
const equal=(a:Record<string,string>,b:Record<string,string>)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([id,owner])=>b[id]===owner);
export function unknownCosts(w:EconomySnapshot,gaps=0):CostState{const owners=economicOwners(w);return {owners,lots:Object.fromEntries(Object.entries(owners).map(([id,owner])=>[id,{owner,cost:null,source:'Unobserved acquisition'}])),gaps};}
export function advanceCosts(previous:CostState,before:EconomySnapshot,after:EconomySnapshot,op:StoredOperation):{state:CostState;disposals:CostDisposal[]}{
 const r=op.receipt;if(op.status!=='Applied'||r?.status!=='Applied'||r.op_id!==op.id||r.payload_hash!==op.hash||commandHash(op.command)!==op.hash)throw Error('Matching applied receipt required');
 let state=structuredClone(previous);const observed=economicOwners(before);
 if(!equal(state.owners,observed))state=unknownCosts(before,state.gaps+1);
 const owners={...state.owners},lots={...state.lots},disposals:CostDisposal[]=[];
 const {actor,action:a}=op.command;
 const remove=(id:string,reason:CostDisposal['reason'],proceeds:string|null=null)=>{const owner=owners[id];if(owner)disposals.push({...((reason==='funding'&&(a.type==='publish'||a.type==='publish_random'||a.type==='refresh'))?{editionId:a.type==='refresh'?a.edition_id:r.result}:{}),itemId:id,owner,cost:lots[id]?.owner===owner?lots[id].cost:null,reason,proceeds});delete lots[id];delete owners[id];};
 const acquire=(id:string,cost:string|null,source:string)=>{owners[id]=actor;lots[id]={owner:actor,cost,source};};
 switch(a.type){
  case 'buy':for(const id of a.item_ids){remove(id,'sale',a.expected_unit_price);acquire(id,a.expected_unit_price,op.id);}break;
  case 'bank_buy':a.item_ids.forEach((id,i)=>acquire(id,a.expected_unit_prices[i],op.id));break;
  case 'bank_sell':a.item_ids.forEach((id,i)=>remove(id,'sale',a.expected_unit_prices[i]));break;
  case 'fill_npc_order':a.item_ids.forEach(id=>remove(id,'sale',a.expected_unit_price));break;
  case 'publish':a.funding.forEach(id=>remove(id,'funding'));break;
  case 'publish_random':[...a.fixed_funding,...a.random_tables.flatMap(t=>t.item_ids)].forEach(id=>remove(id,'funding'));break;
  case 'refresh':[...a.fixed_funding,...a.random_funding.flatMap(t=>t.item_ids)].forEach(id=>remove(id,'funding'));break;
  case 'finish_craft':{
   const batch=after.batches.find(b=>b.id===a.batch_id);if(!batch)break;
   const inputs=batch.input_ids.map(id=>lots[id]);const known=inputs.every(l=>l?.owner===actor&&l.cost!==null);const total=known?inputs.reduce((n,l)=>n+BigInt(l.cost!),0n):0n;
   for(const id of batch.input_ids){delete lots[id];delete owners[id];}
   // Sorted output IDs receive any remainder first; integer costs sum exactly.
   const outputs=[...batch.output_ids].sort();outputs.forEach((id,i)=>acquire(id,known?(total/BigInt(outputs.length)+(BigInt(i)<total%BigInt(outputs.length)?1n:0n)).toString():null,`Craft ${batch.id}; equal allocation, remainder by output ID`));break;
  }
  case 'settle':case 'void':{
   const d=a.disposition;d.town_consumed.forEach(id=>remove(id,'consumed'));d.town_forfeited.forEach(id=>remove(id,'forfeited'));
   // Entry fees stay run-level cash expenses. Extraction basis is unknown, not zero.
   const player=after.runs.find(x=>x.id===a.run_id)?.player;
   for(const id of d.dungeon_extracted){if(player){owners[id]=player;lots[id]={owner:player,cost:null,source:`Extracted ${a.run_id}; entry fee not allocated`};}}
   break;
  }
 }
 const actual=economicOwners(after);
 if(!equal(owners,actual))return {state:unknownCosts(after,state.gaps+1),disposals:[]};
 return {state:{owners:actual,lots,gaps:state.gaps},disposals};
}
type Capture={before:EconomySnapshot;state:CostState;revision:number};
type JournalEntry={operation:string;state:CostState;disposals:CostDisposal[]};
// Applied operations are durable continuity markers even when both observations
// failed before a capture could be saved. Equal current owners cannot prove that
// no sale/repurchase occurred in that interval.
function unobservedApplied(db:Store,except?:string):boolean{
 return db.operations().some(op=>op.status==='Applied'&&op.id!==except&&!db.get('cost-journal',op.id));
}
/** Local single-writer observation journal. Not a reconstruction of historic chain order. */
export class CostJournal{
 constructor(private db:Store,private snapshot:()=>Promise<EconomySnapshot>){}
 async before(op:StoredOperation,signal?:AbortSignal){
  if(this.db.get<Capture>('cost-before',op.id))return;
  const before=await this.snapshot();if(signal?.aborted)return;let state=this.db.get<CostState>('cost-state','current')??unknownCosts(before);
  if(unobservedApplied(this.db))state=unknownCosts(before,state.gaps+1);
  this.db.put('cost-before',op.id,{before,state,revision:this.db.all('cost-journal').length});
 }
 async after(op:StoredOperation,signal?:AbortSignal){
  if(op.status!=='Applied'||this.db.get('cost-journal',op.id))return;
  const after=await this.snapshot();if(signal?.aborted)return;const capture=this.db.get<Capture>('cost-before',op.id);
  const result=capture&&capture.revision===this.db.all('cost-journal').length&&!unobservedApplied(this.db,op.id)?advanceCosts(capture.state,capture.before,after,op):{state:unknownCosts(after,(this.db.get<CostState>('cost-state','current')?.gaps??0)+1),disposals:[]};
  this.db.transaction(()=>{this.db.put('cost-journal',op.id,{operation:op.id,...result});this.db.put('cost-state','current',result.state);});
 }
}
/** The current per-item acquisition-cost state, or all-unknown when any applied operation went unobserved. */
export function currentCostState(db:Store,world:EconomySnapshot):CostState{let state=db.get<CostState>('cost-state','current')??unknownCosts(world);if(unobservedApplied(db)||!equal(state.owners,economicOwners(world)))state=unknownCosts(world,state.gaps+1);return state;}
export function costDisposals(db:Store):CostDisposal[]{return db.all<JournalEntry>('cost-journal').flatMap(e=>e.disposals);}
export function costReport(db:Store,world:EconomySnapshot,profile:string):CostReport{
 let state=db.get<CostState>('cost-state','current')??unknownCosts(world);if(unobservedApplied(db)||!equal(state.owners,economicOwners(world)))state=unknownCosts(world,state.gaps+1);
 const events=db.all<JournalEntry>('cost-journal'),disposals=events.flatMap(e=>e.disposals).filter(d=>d.owner===profile),sales=disposals.filter(d=>d.reason==='sale'),funding=disposals.filter(d=>d.reason==='funding');
 const owned=world.items.filter(i=>i.location.kind==='owned'&&i.location.profile===profile).map(i=>state.lots[i.id]);
 const sum=(xs:(string|null|undefined)[])=>xs.reduce<bigint>((n,s)=>n+(s===null||s===undefined?0n:BigInt(s)),0n).toString();
 const saleProceeds=sum(sales.map(s=>s.proceeds)),matchedSaleCost=sum(sales.map(s=>s.cost)),unknownSaleItems=sales.filter(s=>s.cost===null||s.proceeds===null).length;
 return {knownOwnedCost:sum(owned.map(l=>l?.cost)),unknownOwnedItems:owned.filter(l=>!l||l.cost===null).length,fundingCost:sum(funding.map(d=>d.cost)),unknownFundedItems:funding.filter(d=>d.cost===null).length+Math.max(0,world.editions.filter(e=>e.maker===profile).reduce((n,e)=>n+(e.funded_ids?.length??0)+(e.refresh_ids?.length??0),0)-funding.length),saleProceeds,matchedSaleCost,unknownSaleItems,recordedSaleContribution:unknownSaleItems?null:(BigInt(saleProceeds)-BigInt(matchedSaleCost)).toString(),gaps:state.gaps,trackedOperations:events.length};
}

export function editionCostReport(db:Store,world:EconomySnapshot,id:string):EditionCostReport{
 const edition=world.editions.find(e=>e.id===id);if(!edition)throw Error('Unknown edition');
 const funding=db.all<JournalEntry>('cost-journal').flatMap(e=>e.disposals).filter(d=>d.reason==='funding'&&d.editionId===id&&d.owner===edition.maker);
 const known=funding.reduce((n,d)=>n+(d.cost===null?0n:BigInt(d.cost)),0n);
 const unknown=funding.filter(d=>d.cost===null).length+Math.max(0,edition.funded_ids.length+edition.refresh_ids.length-funding.length);
 const runs=world.runs.filter(r=>r.edition===id),sum=(pending:boolean)=>runs.filter(r=>pending?r.status==='active':r.status!=='active'&&r.status!=='void').reduce((n,r)=>n+BigInt(r.fee),0n);
 const settled=sum(false),placement=BigInt(edition.placement_paid);
 return {settledFees:settled.toString(),pendingFees:sum(true).toString(),placementCost:placement.toString(),knownTreasureCost:known.toString(),unknownTreasureItems:unknown,contribution:unknown?null:(settled-placement-known).toString()};
}
