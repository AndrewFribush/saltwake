import React,{useState} from 'react';
import {Pages} from './GamePanels';
import {itemName} from './TradeRows';
import type {BusinessLedger as Ledger} from '../../../packages/shared/src/business-ledger';
/** Owner-only business ledger (served only in the player's own world view). Unknowns stay unknown. */
export function BusinessLedger({ledger}:{ledger?:Ledger}){
 const [view,setView]=useState<'Cash'|'Goods'|'Dungeons'|'Shops'|'Notes'>('Cash');
 if(!ledger)return <p>Your ledger appears once the server has your records.</p>;
 const coins=(n:string|null)=>n===null?'unknown':`${n} ${n==='1'?'coin':'coins'}`;
 return <section className="business-ledger" aria-label="Business ledger">
  <label>Ledger <select aria-label="Ledger view" value={view} onChange={e=>setView(e.target.value as typeof view)}>{(['Cash','Goods','Dungeons','Shops','Notes'] as const).map(v=><option key={v}>{v}</option>)}</select></label>
  <p className="ledger-warning">Synthetic test coins: not real money or profit.</p>
  {view==='Cash'&&<><p>Recorded in <b>{coins(ledger.recordedIn)}</b> · out <b>{coins(ledger.recordedOut)}</b></p>
   <p>Purse {coins(ledger.reconciliation.purse)} = recorded net {ledger.reconciliation.recordedNet} {ledger.reconciliation.unexplained==='0'?'(reconciled)':`+ ${ledger.reconciliation.unexplained} unexplained${ledger.reconciliation.startsAtZero?'':' (starting allocation)'}`}</p>
   <p>Pending: entry fees owed to you {coins(ledger.pending.makerFees)} · wages {coins(ledger.pending.recoveryWages)} · your reserved run fees {coins(ledger.pending.reservedRunFees)}</p>
   <p>Committed funding: {ledger.committedFunding.goods} goods in {ledger.committedFunding.editions} open {ledger.committedFunding.editions===1?'dungeon':'dungeons'} · known cost {coins(ledger.committedFunding.knownCost)}{ledger.committedFunding.unknownCostItems?` · ${ledger.committedFunding.unknownCostItems} of unknown cost`:''}</p>
   <Pages items={ledger.cash} size={4} label="Cash by source" empty="No confirmed cash movements yet." render={c=><p key={c.category+c.direction} className={`ledger-row ${c.direction}`}>{c.direction==='in'?'+':'−'}{c.amount} · {c.label} <small>({c.count} {c.count===1?'record':'records'})</small></p>}/></>}
  {view==='Goods'&&<><p>{ledger.goods.length} goods held · known cost {coins(ledger.knownGoodsCost)}{ledger.unknownCostGoods?` · ${ledger.unknownCostGoods} of unknown cost`:''}</p>
   <Pages items={ledger.goods} size={5} label="Goods and acquisition cost" empty="You hold no goods." render={g=><p key={g.itemId} className="ledger-row">{itemName(g.itemType)} · {g.cost===null?'cost unknown':`cost ${g.cost}`} <small title={g.itemId}>{g.source}</small></p>}/></>}
  {view==='Dungeons'&&<Pages items={ledger.editions} label="Your dungeons" empty="You have not opened a dungeon." render={e=><article key={e.id}><h4>{e.title} · {e.open?'open':'closed'}</h4>
   <p>Fees earned {coins(e.settledFees)} from {e.settledRuns} settled {e.settledRuns===1?'run':'runs'}{e.activeRuns?` · ${coins(e.pendingFees)} pending from ${e.activeRuns} active`:''}</p>
   <p>Placement {coins(e.placement)} · treasure cost {coins(e.knownTreasureCost)}{e.unknownTreasureItems?` (+${e.unknownTreasureItems} of unknown cost)`:''} · {e.fundedGoodsRemaining} funded goods still below</p>
   <p><b>Contribution: {e.contribution===null?'unknown (a treasure cost is unknown)':coins(e.contribution)}</b>{e.settledRuns<5?` · small sample (${e.settledRuns})`:''}</p></article>}/>}
  {view==='Shops'&&<Pages items={ledger.shops} label="Your shops" empty="You have no shop." render={s=><article key={s.id}><h4>{s.title} · {s.open?'open':'closed'}</h4>
   <p>Sales {coins(s.revenue)} for {s.itemsSold} {s.itemsSold===1?'item':'items'} · {s.stockItems} on the shelves</p>
   <p>Matched cost {coins(s.matchedCost)}{s.unknownCostItems?` · ${s.unknownCostItems} sold of unknown cost`:''}{s.coverage==='partial'?' · partial sales history':''}</p>
   {s.itemsSold===0?<p>No confirmed sales yet.</p>:<p><b>Contribution: {s.contribution===null?'unknown':coins(s.contribution)}</b>{s.itemsSold<5?` · small sample (${s.itemsSold})`:''}</p>}</article>}/>}
  {view==='Notes'&&<ul>{ledger.notes.map(n=><li key={n}>{n}</li>)}</ul>}
 </section>;
}
