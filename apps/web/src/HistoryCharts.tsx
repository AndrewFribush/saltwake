import React from 'react';
import type {DayReport} from '../../../packages/shared/src/town-history';
type Series={label:string;values:(number|null)[];cls:string};
/** Minimal inline SVG line chart (one per metric group). Colours come from CSS classes so the art lane can skin it. */
export function LineChart({title,series,days}:{title:string;series:Series[];days:number[]}){
 const w=300,h=110,pad={l:28,r:6,t:8,b:18};const all=series.flatMap(s=>s.values).filter((v):v is number=>v!==null);const max=Math.max(1,...all),min=Math.min(0,...all);
 const x=(i:number)=>pad.l+(days.length<=1?0:i*(w-pad.l-pad.r)/(days.length-1)),y=(v:number)=>pad.t+(h-pad.t-pad.b)*(1-(v-min)/(max-min||1));
 return <figure className="history-chart"><figcaption>{title}</figcaption>
  <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${title}: ${series.map(s=>`${s.label} ${[...s.values].reverse().find(v=>v!==null)??'–'}`).join(', ')} (latest values, day ${days.at(-1)})`}>
   <line className="axis" x1={pad.l} y1={h-pad.b} x2={w-pad.r} y2={h-pad.b}/><line className="axis" x1={pad.l} y1={pad.t} x2={pad.l} y2={h-pad.b}/>
   <text className="tick" x={pad.l-3} y={pad.t+4} textAnchor="end">{max}</text><text className="tick" x={pad.l-3} y={h-pad.b} textAnchor="end">{min}</text>
   <text className="tick" x={pad.l} y={h-4}>day {days[0]}</text><text className="tick" x={w-pad.r} y={h-4} textAnchor="end">day {days.at(-1)}</text>
   {series.map(s=>{const pts=s.values.map((v,i)=>v===null?null:`${x(i)},${y(v)}`).filter(Boolean).join(' ');return <polyline key={s.label} className={`line ${s.cls}`} points={pts} fill="none"/>;})}
  </svg>
  <ul className="chart-legend">{series.map(s=>{const last=[...s.values].reverse().find(v=>v!==null);return <li key={s.label} className={s.cls}>{s.label}: {last??'–'}</li>;})}</ul>
 </figure>;
}
export function HistoryCharts({days}:{days:DayReport[]}){
 const d=days.map(x=>x.day);const avg=(xs?:number[])=>xs&&xs.length?Math.round(10*xs.reduce((a,b)=>a+b,0)/xs.length)/10:null;
 const types=[...new Set(days.flatMap(x=>Object.keys(x.pricesPaid??{})))].slice(0,4);
 return <div className="history-charts">
  {days.some(x=>x.coinsByRole)&&<LineChart title="Coins by role" days={d} series={[{label:'Makers',cls:'s1',values:days.map(x=>x.coinsByRole?.makers??null)},{label:'Artisans',cls:'s2',values:days.map(x=>x.coinsByRole?.artisans??null)},{label:'Delvers',cls:'s3',values:days.map(x=>x.coinsByRole?.delvers??null)}]}/>}
  <LineChart title="Activity per day" days={d} series={[{label:'Runs',cls:'s1',values:days.map(x=>x.runs.extracted+x.runs.died+x.runs.abandoned)},{label:'Trades',cls:'s2',values:days.map(x=>x.playerTrades)},{label:'Unsold items',cls:'s3',values:days.map(x=>x.unsoldItems)}]}/>
  {types.length>0&&<LineChart title="Average price paid" days={d} series={types.map((t,i)=>({label:t,cls:`s${i+1}`,values:days.map(x=>avg(x.pricesPaid?.[t]))}))}/>}
 </div>;
}
