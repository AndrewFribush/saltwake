import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {CharacterSprite} from './CharacterSprite';
import {playerLabel} from './presence-names';
import {clockSign,folkLine,townsfolk,type DistrictDigest,type Townsperson} from '../../../packages/game/src/town-life';
import type {DistrictId} from '../../../packages/game/src/town-districts';
import type {Shopfront} from '../../../packages/shared/src/types';
import type {BoardEntry} from '../../../packages/game/src/town-board';
/** Town life: the in-town square banner, district notice posts, clock signage and cosmetic townsfolk. */
export type Highlight={kind:'dungeon'|'haul'|'commission'|'building';text:string;who?:string;district?:string};
// One shared poll of /api/town-square for the banner, the posts and the harbor board.
let highlights:Highlight[]=[];const listeners=new Set<()=>void>();let timer:ReturnType<typeof setInterval>|undefined;
const load=()=>fetch('/api/town-square').then(r=>r.ok?r.json():{highlights:[]}).then(v=>{highlights=v.highlights??[];listeners.forEach(f=>f());}).catch(()=>{});
export function useTownSquare(){
 return useSyncExternalStore(f=>{listeners.add(f);if(!timer){void load();timer=setInterval(load,15000);}return()=>{listeners.delete(f);if(!listeners.size&&timer){clearInterval(timer);timer=undefined;}};},()=>highlights);
}
export function useNow(ms:number){const [now,setNow]=useState(()=>Date.now());useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),ms);return()=>clearInterval(t);},[ms]);return now;}
const icon:Record<Highlight['kind'],string>={dungeon:'▼',haul:'✦',commission:'✎',building:'⌂'};
/** A one-line banner over the town map: what happened lately, local news first. */
export function TownBanner({district,districtName}:{district:DistrictId;districtName:string}){
 const all=useTownSquare();const now=useNow(7000);
 const local=all.filter(h=>h.district===district),rest=all.filter(h=>h.district!==district);const lines=[...local,...rest];
 if(!lines.length)return null;const h=lines[Math.floor(now/7000)%lines.length];
 return <p className={`town-banner square-${h.kind}`} role="status" aria-live="off"><span aria-hidden="true">{icon[h.kind]}</span> {h.district===district?<b>Here in {districtName}: </b>:null}{h.text}{h.who?` · ${playerLabel(h.who)}`:''}{lines.length>1&&<span className="banner-count"> ({lines.indexOf(h)+1}/{lines.length})</span>}</p>;
}
/** The viewer's clock as a small sign, plus the class the map uses for its light. */
export function useClock(){const now=useNow(60000);return clockSign(new Date(now));}
/** Ambient townsfolk on the map. Scenery only: no presence, no trades, no rewards, and they do not block anyone. */
export function TownsfolkLayer({district,shops,cell,onTalk}:{district:DistrictId;shops:readonly Shopfront[];cell:number;onTalk:(t:Townsperson)=>void}){
 const now=useNow(1400);const folk=townsfolk(district,shops,now);
 return <g className="townsfolk-layer">{folk.map(f=><g key={f.id} className="townsfolk" style={{transform:`translate(${f.x*cell+cell/2}px, ${f.y*cell+cell/2}px)`,cursor:'pointer'}} onClick={e=>{e.stopPropagation();onTalk(f);}} role="button" aria-label={`${f.name} the ${f.role} (townsfolk, not a player)`}>
  <rect x={-16} y={-18} width={32} height={36} fill="transparent"/><g style={{filter:"saturate(.35) brightness(.9)"}}><CharacterSprite x={-18} y={-20} width={36} height={38} facing={f.facing} at={f} look={f.look}/></g>
  <text className="townsfolk-name" y={-20} textAnchor="middle">{f.name}</text>
 </g>)}</g>;
}
export const talkLine=(t:Townsperson,digest:DistrictDigest)=>`${t.name} the ${t.role}: “${folkLine(t,digest,new Date())}” (Townsfolk are scenery: they never trade, pay or give anything.)`;
/** A district's own notice post: buildings standing here, their latest confirmed activity and local square news. */
export function DistrictPost({digest,district,onClose,onMark,marked,directions}:{digest:DistrictDigest;district:DistrictId;onClose:()=>void;onMark:(e:BoardEntry)=>void;marked?:string;directions:(e:BoardEntry)=>string}){
 const local=useTownSquare().filter(h=>h.district===district);const sign=useClock();
 return <div className="player-trade town-board district-post" role="region" aria-label={`${digest.name} notice post`} onClick={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose();}}>
  <div className="town-board-head"><h3>{digest.name} notice post</h3><button autoFocus onClick={onClose}>Step away</button></div>
  <p className="trade-note">{sign.text}</p>
  <h4>Built in {digest.name}</h4>
  {digest.buildings.length?<ul className="post-buildings">{digest.buildings.map(e=><li key={e.shopId}><b>{e.title}</b> · {playerLabel(e.owner)} · {e.kind==='dungeon'?(e.dungeon?`dungeon entrance, entry ${e.dungeon.fee} coins, ${e.dungeon.attempts} settled ${e.dungeon.attempts===1?'run':'runs'}`:'dungeon entrance (dungeon no longer listed)'):e.goods?.count?`shop, ${e.goods.count} on the shelves`:'shop, shelves empty'} · {e.open?'open':'closed'} <button className="link-button" disabled={marked===e.shopId} onClick={()=>onMark(e)}>{marked===e.shopId?'marked':'mark on map'}</button><br/><small>{directions(e)}</small></li>)}</ul>:<p>Nobody has built in {digest.name} yet. Use <b>Build here</b> to claim a plot; you can hold three.</p>}
  <h4>Lately</h4>
  {digest.activity.length||local.length?<ul className="post-activity">{local.map(h=><li key={h.kind}>{h.text}{h.who?` · ${playerLabel(h.who)}`:''}</li>)}{digest.activity.map((a,i)=><li key={i}>{a}</li>)}</ul>:<p>No confirmed activity here yet.</p>}
  <p className="trade-note">From confirmed public records only. The full list of player buildings is on the harbor notice board in Harbor Square.</p>
 </div>;
}
