import type {Shopfront} from '../../../packages/shared/src/types';
import {CharacterSprite} from './CharacterSprite';
import React,{useEffect,useRef,useState} from 'react';
import {townSize,townStart,type PlaceId,type TownPoint} from '../../../packages/game/src/town';
import {districts,districtPlaces,districtPath,districtStep,neighbor,type DistrictId} from '../../../packages/game/src/town-districts';
import './tiles.css';
import {townTerrain} from './town-terrain';
import {TownPatterns} from './art/Places';
import {districtArrival,doorstepLine,ownerHue,suggestPlot} from '../../../packages/game/src/town-discovery';
import {markDone} from './FirstSteps';
import {landRules} from '../../../packages/shared/src/land';
import {atNoticeBoard,boardEntries,directionsTo,noticeBoard,type BoardEntry} from '../../../packages/game/src/town-board';
import {TownBoard} from './TownBoard';
import {PresenceAvatars,TownChat,useTownPresence,useRoomPresence,setRoomCrowd,playerLabel,type Facing} from './TownPresence';
import {PlayerTrade,type TradeContext} from './PlayerTrade';
const cell=40;
// Players arriving together would otherwise stand on the same tile; spread them over the central road by profile.
const spawnSpots=[townStart,{x:13,y:9},{x:12,y:10},{x:13,y:10},{x:12,y:7},{x:13,y:7},{x:12,y:11},{x:13,y:11}];
// A reload puts you back where you stood (this tab only).
function readSpot(profile?:string):{district:DistrictId;x:number;y:number}|null{if(!profile)return null;try{const v=JSON.parse(sessionStorage.getItem('saltwake.town-spot.'+profile)??'null');return v&&districts.some(d=>d.id===v.district)&&Number.isInteger(v.x)&&Number.isInteger(v.y)&&v.x>=0&&v.x<townSize.width&&v.y>=0&&v.y<townSize.height?v:null;}catch{return null;}}
function spawnPoint(profile?:string){if(!profile)return townStart;let h=0;for(const c of profile)h=(h*31+c.charCodeAt(0))>>>0;return spawnSpots[h%spawnSpots.length];}
export function Town({onEnter,disabled=false,openings,stock,children,shops=[],onEnterShop,onBuild,trade}:{trade?:TradeContext;onEnter:(place:PlaceId)=>void;disabled?:boolean;openings:number;stock:number;children?:React.ReactNode;shops?:Shopfront[];onEnterShop?:(id:string)=>void;onBuild?:(district:DistrictId)=>void}){
 const saved=readSpot(trade?.world?.profile);const [district,setDistrict]=useState<DistrictId>(saved?.district??'center');const places=districtPlaces(district,shops);const districtInfo=districts.find(d=>d.id===district)!;
 const [position,setPosition]=useState(()=>saved?{x:saved.x,y:saved.y}:spawnPoint(trade?.world?.profile));
 useEffect(()=>{const p=trade?.world?.profile;if(!p)return;try{sessionStorage.setItem('saltwake.town-spot.'+p,JSON.stringify({district,x:position.x,y:position.y}));}catch{}},[district,position.x,position.y,trade?.world?.profile]);const [route,setRoute]=useState<TownPoint[]>([]);const [message,setMessage]=useState('The tide is out. The catacombs are open to anyone with the coin and the nerve.');
 const [boardOpen,setBoardOpen]=useState(false);
 const me=trade?.world?.profile as string|undefined;const [tourSeen,setTourSeen]=useState(()=>{try{return !!me&&localStorage.getItem(`saltwake.done.${me}.plot-tour`)==='1';}catch{return false;}});
 const plotTour=!!onBuild&&!!me&&!tourSeen&&!shops.some(s=>s.owner===me)?suggestPlot(district,shops,position):undefined;const [waypoint,setWaypoint]=useState<BoardEntry>();
 const [facing,setFacing]=useState<Facing>('down');const room=useRoomPresence();const presence=useTownPresence(disabled?room.here:{district,x:position.x,y:position.y,facing});
 useEffect(()=>{if(disabled&&room.here)setRoomCrowd({others:presence.others,chat:presence.chat,say:presence.say,you:presence.you});},[disabled,room.here,presence.others,presence.chat,presence.you]);const [tradeWith,setTradeWith]=useState<string>();const partner=presence.others.find(o=>o.id===tradeWith);
 const field=useRef<HTMLDivElement>(null);const near=places.find(b=>Math.abs(b.door.x-position.x)+Math.abs(b.door.y-position.y)<=1);
 useEffect(()=>{if(!disabled)field.current?.focus({preventScroll:true});},[disabled]);
 const step=(next:TownPoint,remaining:TownPoint[]=[])=>{setFacing(next.x<position.x?'left':next.x>position.x?'right':next.y<position.y?'up':'down');const result=districtStep(district,position,next,shops);setPosition(result.position);setDistrict(result.district);setBoardOpen(!remaining.length&&atNoticeBoard(result.district,result.position));if(result.enter&&waypoint&&result.enter===waypoint.shopId)setWaypoint(undefined);setRoute(result.enter||result.blocked||result.district!==district?[]:remaining);if(result.blocked)setMessage(result.blocked);else if(result.district!==district)setMessage(districtArrival(result.district,shops,playerLabel));else if(result.enter){const place=places.find(p=>p.id===result.enter)!;setMessage(`Outside ${place.name}. Walk into its doorway to enter.`);if(place.shopId)onEnterShop?.(place.shopId);else onEnter(result.enter as PlaceId);}};
 useEffect(()=>{if(disabled||!route.length)return;const timer=setTimeout(()=>step(route[0],route.slice(1)),85);return()=>clearTimeout(timer);},[route,disabled,position,district]);
 const travel=(id:string)=>{if(disabled)return;const p=places.find(b=>b.id===id)!;setMessage(`Walking to ${p.name}…`);setRoute(districtPath(district,position,p.door,shops));field.current?.focus({preventScroll:true});};
 const towardEdge=(point:TownPoint,dx:number,dy:number)=>{if(disabled)return;if(position.x===point.x&&position.y===point.y)step({x:point.x+dx,y:point.y+dy});else setRoute(districtPath(district,position,point,shops));field.current?.focus({preventScroll:true});};
 const x=position.x*cell+20,y=position.y*cell+20;
 return <section data-district={district} className="town-world" aria-label="Walkable harbor town">

  <div className="town-heading"><div><h1>{districtInfo.name}</h1><p>Saltwake · A town built on what comes back from below.</p></div><button disabled={disabled||!onBuild} onClick={()=>onBuild?.(district)}>Build here</button></div>
  <div className="town-field" ref={field} tabIndex={disabled?-1:0} role="group" aria-label="Town movement. Arrow keys or WASD to walk. Walk into doors to enter buildings; cross map edges to change districts." onKeyDown={e=>{
   if(e.target!==e.currentTarget||disabled||e.altKey||e.ctrlKey||e.metaKey)return;const d:Record<string,[number,number]>={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};const delta=d[e.key];
   if(delta){e.preventDefault();setRoute([]);const next={x:position.x+delta[0],y:position.y+delta[1]};step(next);}
  }}>
   <svg className="harbor-map" viewBox={`0 0 ${townSize.width*cell} ${townSize.height*cell}`} role="img" aria-label={`Saltwake: ${districtInfo.name}. Walk to an open edge to visit the next district.`} onClick={e=>{
    if(disabled)return;const r=e.currentTarget.getBoundingClientRect();const p={x:Math.floor((e.clientX-r.left)/r.width*townSize.width),y:Math.floor((e.clientY-r.top)/r.height*townSize.height)};
    const other=trade&&presence.others.find(o=>o.x===p.x&&o.y===p.y);if(other){setTradeWith(other.id);return;}
    const building=places.find(b=>p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height);if(building){travel(building.id);return;}
    if(p.x===position.x&&p.y===position.y&&(p.x===0||p.x===23||p.y===0||p.y===15)){towardEdge(p,p.x===0?-1:p.x===23?1:0,p.x===0||p.x===23?0:p.y===0?-1:1);}else setRoute(districtPath(district,position,p,shops));field.current?.focus({preventScroll:true});
   }}>
    <defs><pattern id="water" width="50" height="36" patternUnits="userSpaceOnUse"><path d="M3 22q10-6 22 0M28 5q8-4 16 0" stroke="#60858b" strokeWidth="2" opacity=".28" fill="none"/></pattern><pattern id="cobbles" width="27" height="19" patternUnits="userSpaceOnUse"><path d="M0 0h27v19H0zM13 0v9M0 9h27" fill="#887c64" stroke="#6d6755" strokeWidth="1"/></pattern><pattern id="grass" width="30" height="30" patternUnits="userSpaceOnUse"><path d="m5 9 2-4 2 4m13 13 2-5 2 5" stroke="#66805a" strokeWidth="1" opacity=".35"/></pattern></defs>
    <TownPatterns cell={cell}/>
    {Array.from({length:townSize.width*townSize.height},(_,i)=>{const tx=i%townSize.width,ty=Math.floor(i/townSize.width);const ground=townTerrain(district,tx,ty),boundaryWall=ground==='wall',water=ground==='water',road=ground==='road';return <g key={i}><rect x={tx*cell} y={ty*cell} width={cell} height={cell} fill={boundaryWall?'#293a35':water?'#214954':road?(i%2?'#887c64':'#81755e'):(i%2?'#3a5039':'#344a35')} stroke="#172c2740" strokeWidth="1"/>{water&&<path d={`M${tx*cell+7} ${ty*cell+23}q12-6 25 0`} stroke="#68939b" opacity=".35" fill="none"/>}</g>;})}
    {places.map(b=>{const bx=b.x*cell,by=b.y*cell,w=b.width*cell,h=b.height*cell,dx=(b.door.x-b.x)*cell,dy=(b.door.y-b.y)*cell;return <g key={b.id} className={b.shopId?(b.edition?'player-bldg dungeon-bldg':'player-bldg'):undefined} transform={`translate(${bx} ${by})`}>
     <rect x="8" y="12" width={w} height={h} rx="4" fill="#14291f" opacity=".5"/><rect y="22" width={w} height={h-22} fill={b.id==='gate'?'#6a716a':'#b69d71'} stroke="#3b372b" strokeWidth="5"/>
     {b.id==='gate'?<><path d={`M0 24V-10h30V8h30v-18h30V8h30v-18h40v34`} fill="#80877c" stroke="#444b43" strokeWidth="5"/></>:<><path d={`M-10 45 20-8H${w-20}L${w+10} 45Z`} fill={b.edition?'#363a4f':b.id==='workshop'?'#426366':b.id==='market'?'#756044':'#794635'} stroke="#3b3027" strokeWidth="5"/>{[12,25,37].map(ry=><path key={ry} d={`M${12-ry/3} ${ry}H${w-12+ry/3}`} stroke="#b48059" opacity=".4"/>)}{[22,w-48].map(wx=><g key={wx}><rect x={wx} y="60" width="27" height="26" fill="#e1b55a" stroke="#564431" strokeWidth="5"/><path d={`M${wx+13} 61v24M${wx} 73h27`} stroke="#685239" strokeWidth="3"/></g>)}</>}
     {b.shopId&&<g className="owner-banner" aria-hidden="true"><path d={`M${w-14} 20V-26`} stroke="#3b3027" strokeWidth="3"/><path d={`M${w-13} -26h20l-6 7 6 7h-20z`} fill={`hsl(${ownerHue(b.keeper)} 55% 52%)`} stroke="#2a241d" strokeWidth="2"/></g>}
     {b.edition&&<g className="dungeon-hall-mark" aria-hidden="true"><rect x={w/2-14} y="-30" width="28" height="24" rx="3" fill="#22253a" stroke="#9a8fd0" strokeWidth="3"/><path d={`M${w/2-8} -12h6v-5h5v-5h5`} stroke="#d8cff7" strokeWidth="3" fill="none"/></g>}
     {b.id==='market'&&<g>{Array.from({length:8},(_,i)=><path key={i} d={`M${i*25} 88h25l4 21h-29z`} fill={i%2?'#d2bc8e':'#777945'}/>)}<rect x="4" y="112" width={w-8} height="18" fill="#735036"/></g>}
     {b.id==='workshop'&&<><rect x="110" y="-22" width="21" height="49" fill="#656961" stroke="#373c35" strokeWidth="4"/><path d="M120-26q-12-20 3-29" stroke="#c4c2b0" strokeWidth="10" fill="none" opacity=".35"/></>}
     <g className="building-door" aria-label={`Door to ${b.name}`} transform={`translate(${dx} ${dy})`}>
      <rect width={cell} height={cell} fill={b.id==='gate'?'#747b70':'#b69d71'}/>
      <path d="M5 40V14a15 12 0 0 1 30 0v26" fill="#1c2420" stroke={b.id==='gate'?'#a4ab94':'#725334'} strokeWidth="5"/>
      {b.id==='gate'?<path d="M12 12v26m8-29v29m8-26v26" stroke="#8f9279" strokeWidth="3"/>:<><path d="M9 39V15a11 9 0 0 1 22 0v24Z" fill="#695035"/><path d="M15 11v27m10-27v27" stroke="#3d3024"/><circle cx="27" cy="25" r="2" fill="#e0c17b"/></>}
      <path d="M2 39h36" stroke="#ccb987" strokeWidth="3"/>
     </g>
    </g>;})}
    <g className="tile-town-grid" stroke="#10292055" strokeWidth="1">{Array.from({length:townSize.width+1},(_,i)=><path key={'v'+i} d={`M${i*cell} 0v${townSize.height*cell}`}/>)}{Array.from({length:townSize.height+1},(_,i)=><path key={'h'+i} d={`M0 ${i*cell}h${townSize.width*cell}`}/>)}</g>
    {route.filter((_,i)=>i%2===0).map(p=><circle key={`${p.x}-${p.y}`} cx={p.x*cell+20} cy={p.y*cell+20} r="3" fill="#e3cb8e" opacity=".65"/>)}
    {district===noticeBoard.district&&<g className="notice-board" aria-hidden="true" transform={`translate(${noticeBoard.x*cell} ${noticeBoard.y*cell})`}><path d="M12 38V22M28 38V22" stroke="#4a3624" strokeWidth="4"/><rect x="3" y="4" width="34" height="20" rx="2" fill="#a67c4e" stroke="#4a3624" strokeWidth="3"/><path d="M8 10h11M8 15h17M22 9h9v9h-9z" stroke="#f1e2bf" strokeWidth="2" fill="none"/></g>}
    {waypoint&&waypoint.district===district&&<g className="waypoint-pin" aria-hidden="true" transform={`translate(${waypoint.door.x*cell+20} ${waypoint.door.y*cell+4})`}><path d="M0 0c-9-12-9-22 0-24 9 2 9 12 0 24z" fill="#e3cb8e" stroke="#2a241d" strokeWidth="2"/><circle cy="-15" r="4" fill="#2a241d"/></g>}
    {plotTour&&<g className="plot-tour" aria-hidden="true"><rect x={plotTour.x*cell+2} y={plotTour.y*cell+2} width={3*cell-4} height={2*cell-4} rx="4" fill="#e3cb8e22" stroke="#e3cb8e" strokeWidth="3" strokeDasharray="8 6"/><text x={plotTour.x*cell+1.5*cell} y={plotTour.y*cell+cell+5} textAnchor="middle" fill="#f3e6c4" fontSize="13">free plot</text></g>}
    <PresenceAvatars players={presence.others} cell={cell}/>
    <g key={district} className="town-avatar" style={{transform:`translate(${x}px, ${y}px)`}}><CharacterSprite x={-22} y={-25} width={44} height={46} facing={facing} at={position}/></g>
   </svg>
   {places.map(p=><button key={p.id} className={`place-sign ${p.id} ${p.shopId?'player-building':''} ${p.shopId&&p.keeper===trade?.world?.profile?'mine':''}`} disabled={disabled} style={{left:`${(p.x+p.width/2)/townSize.width*100}%`,top:`${(p.y-.65)/townSize.height*100}%`}} onClick={()=>travel(p.id)} aria-label={`Visit ${p.name}`}><strong>{p.name}</strong><span>{p.shopId?`${playerLabel(p.keeper)} · ${p.purpose}`:p.id==='gate'?`${openings} open ${openings===1?"place":"places"}`:p.id==='market'?`${stock} goods for sale`:p.id==='workshop'?'Craft & earn':p.id==='guild'?'Build a dungeon':'Satchel & journal'}</span></button>)}
   {district===noticeBoard.district&&<button className="place-sign notice-board-sign" disabled={disabled} style={{left:`${(noticeBoard.x+.5)/townSize.width*100}%`,top:`${(noticeBoard.y-.55)/townSize.height*100}%`}} onClick={()=>{if(atNoticeBoard(district,position))setBoardOpen(true);else setRoute(districtPath(district,position,noticeBoard,shops));field.current?.focus({preventScroll:true});}} aria-label="Walk to the harbor notice board"><strong>Notice board</strong><span>Player dungeons & shops</span></button>}
   <div className="district-compass" aria-label="Neighboring districts">{[{dx:0,dy:-1,label:'↑',point:{x:12,y:0}},{dx:1,dy:0,label:'→',point:{x:23,y:8}},{dx:0,dy:1,label:'↓',point:{x:12,y:15}},{dx:-1,dy:0,label:'←',point:{x:0,y:8}}].map(({dx,dy,label,point})=>{const n=neighbor(district,dx,dy);return n&&<button key={label} className={`edge-${dy<0?'n':dy>0?'s':dx<0?'w':'e'}`} disabled={disabled} onClick={()=>towardEdge(point,dx,dy)}>{label} {n.name}</button>;})}</div>
   <TownChat presence={presence} districtName={districtInfo.name} field={field} disabled={disabled} onPlayer={trade?setTradeWith:undefined}/>
   {trade&&tradeWith&&!disabled&&<PlayerTrade partner={tradeWith} distance={partner?Math.abs(partner.x-position.x)+Math.abs(partner.y-position.y):null} trade={trade} announce={presence.say} onApproach={()=>{if(partner)setRoute(districtPath(district,position,{x:partner.x,y:partner.y},shops));field.current?.focus({preventScroll:true});}} onClose={()=>{setTradeWith(undefined);field.current?.focus({preventScroll:true});}}/>}
   {plotTour&&!disabled&&!boardOpen&&<div className="plot-tour-hint" role="note"><b>Claim a plot.</b> Land in Saltwake is built by players. The dashed patch is free: press <b>Build here</b> above the map to put a shop or the entrance to your own dungeon there. You can hold {landRules.maxPlotsPerOwner} plots. <button onClick={()=>{if(me)markDone(me,'plot-tour');setTourSeen(true);field.current?.focus({preventScroll:true});}}>Got it</button></div>}
   {boardOpen&&!disabled&&<TownBoard browsing={Object.fromEntries(Object.entries(presence.rooms).map(([k,v])=>[k,v.filter(id=>id!==presence.you)]))} demo={trade?.world?.authMode==='demo'} entries={boardEntries(shops,trade?.world?.editions??[],trade?.world?.listings??[])} directions={e=>directionsTo(district,e)} marked={waypoint?.shopId} onMark={setWaypoint} onClose={()=>{setBoardOpen(false);field.current?.focus({preventScroll:true});}}/>}
   {children}
  </div>
  <div className="town-prompt"><div><strong>{route.length?'On your way…':near?near.name:districtInfo.name}</strong><p role="status">{message}</p>{!route.length&&near&&doorstepLine(near,playerLabel)&&<p className="doorstep">{doorstepLine(near,playerLabel)}</p>}{waypoint&&<p className="doorstep">Marked: {waypoint.title}. {directionsTo(district,waypoint)} <button className="link-button" onClick={()=>setWaypoint(undefined)}>Clear</button></p>}</div></div>
  <p className="world-help">Walk into a building’s doorway to enter. Arrow keys / WASD to walk, or click a tile or building. Cross an open edge to continue through town. The west dock crossing runs along the middle road.</p>
 </section>;
}
