import React,{useEffect,useState} from 'react';
import {Pages} from './GamePanels';
import {playerLabel} from './presence-names';
import type {TownHistory as History} from '../../../packages/shared/src/town-history';
/** Day-by-day report from `npm run simulate`, shown on the harbor notice board. Always labelled as simulation. */
export function TownHistory(){
 const [h,setH]=useState<History|null>(null);
 useEffect(()=>{let live=true;const load=()=>fetch('/api/town-history').then(r=>r.json()).then(v=>{if(live)setH(v);}).catch(()=>{});load();const t=setInterval(load,5000);return()=>{live=false;clearInterval(t);};},[]);
 if(!h?.days?.length)return <p className="trade-note">No simulated history for this world. Run <code>npm run simulate -- --days 7</code> to watch a week of bot trading, then reopen the board.</p>;
 const names=(s:string)=>s.replace(/\b(buyer|maker|p2|p3|p4|p5|worker2|worker)\b/g,m=>playerLabel(m));
 return <div className="town-history"><p className="demo-supply"><b>SIMULATION.</b> {h.note}</p>
  <Pages items={[...h.days].reverse()} label="Simulated days" render={d=><article key={d.day}><h4>Day {d.day}{d.conservationDrift===0?' · coins conserved':' · CONSERVATION FAILURE'}</h4>
   <p>Entry fees {d.entryFees} · wages {d.wages} · player trades {d.playerTrades} ({d.tradeCoins} coins) · bank sales {d.bankSales} · batches brewed {d.batchesBrewed}</p>
   <p>Runs: {d.runs.extracted} escaped, {d.runs.died} died{d.runs.abandoned?`, ${d.runs.abandoned} gave up`:''} · treasure out so far {d.treasureValue.extracted} value</p>
   <p>Purses {d.coinsInPurses} · bank {d.bank}{d.issuance?` · issued ${d.issuance}`:''} · unsold {d.unsoldItems} items · bank stock {d.bankStock}</p>
   <p>Prices: {Object.entries(d.listings).map(([t,v])=>`${t} ${v.min===v.max?v.min:`${v.min}–${v.max}`} (${v.count})`).join(' · ')||'nothing listed'}</p>
   {d.absentDemand.length>0&&<p>No entries today: {d.absentDemand.join(', ')}</p>}
   <details><summary>{d.events.length} events</summary><ul>{d.events.map((e,i)=><li key={i}>{names(e)}</li>)}</ul></details></article>}/></div>;
}
