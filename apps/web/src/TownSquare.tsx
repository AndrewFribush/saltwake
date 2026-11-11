import React,{useEffect,useState} from 'react';
import {playerLabel} from './presence-names';
type Highlight={kind:'dungeon'|'haul'|'commission'|'building';text:string;who?:string};
const icon:Record<Highlight['kind'],string>={dungeon:'▼',haul:'✦',commission:'✎',building:'⌂'};
/** Town-square highlights from confirmed public records (newest dungeon, biggest haul today, a filled commission,
 * newest building). Read-only. */
export function TownSquare(){
 const [h,setH]=useState<Highlight[]>([]);
 useEffect(()=>{let live=true;const load=()=>fetch('/api/town-square').then(r=>r.ok?r.json():{highlights:[]}).then(v=>{if(live)setH(v.highlights??[]);}).catch(()=>{});load();const t=setInterval(load,10000);return()=>{live=false;clearInterval(t);};},[]);
 if(!h.length)return null;
 return <ul className="town-square" aria-label="Town square highlights">{h.map(x=><li key={x.kind} className={`square-${x.kind}`}><span aria-hidden="true">{icon[x.kind]}</span> {x.text}{x.who?` · ${playerLabel(x.who)}`:''}</li>)}</ul>;
}
