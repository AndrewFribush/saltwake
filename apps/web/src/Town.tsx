import React,{useEffect,useRef,useState} from 'react';
import {nearbyPlace,places,townPath,townSize,townStart,townWalkable,type PlaceId,type TownPoint} from '../../../packages/game/src/town';
import './tiles.css';
const cell=40;
export function Town({onEnter,disabled=false,openings,stock,children}:{onEnter:(place:PlaceId)=>void;disabled?:boolean;openings:number;stock:number;children?:React.ReactNode}){
 const [position,setPosition]=useState(townStart);const [route,setRoute]=useState<TownPoint[]>([]);const [destination,setDestination]=useState<PlaceId>();const [message,setMessage]=useState('The tide is out. The catacombs are open to anyone with the coin and the nerve.');
 const field=useRef<HTMLDivElement>(null);const near=nearbyPlace(position);
 useEffect(()=>{if(!disabled)field.current?.focus({preventScroll:true});},[disabled]);
 useEffect(()=>{if(disabled||!route.length)return;const timer=setTimeout(()=>{setPosition(route[0]);setRoute(route.slice(1));},85);return()=>clearTimeout(timer);},[route,disabled]);
 useEffect(()=>{if(!route.length&&destination&&!disabled){const p=places.find(b=>b.id===destination)!;if(position.x===p.door.x&&position.y===p.door.y){setDestination(undefined);setMessage(p.purpose);onEnter(p.id);}}},[route,destination,position,disabled,onEnter]);
 const travel=(id:PlaceId)=>{if(disabled)return;const p=places.find(b=>b.id===id)!;setMessage(`Walking to ${p.name}…`);setDestination(id);setRoute(townPath(position,p.door));field.current?.focus({preventScroll:true});};
 const x=position.x*cell+20,y=position.y*cell+20;
 return <section className="town-world" aria-label="Walkable harbor town">
  <div className="town-heading"><div><h1>Saltwake</h1><p>A town built on what comes back from below.</p></div><span className="town-weather">Low tide / Lanterns lit</span></div>
  <div className="town-field" ref={field} tabIndex={disabled?-1:0} role="group" aria-label="Town movement. Arrow keys or WASD to walk. Enter to visit a nearby building." onKeyDown={e=>{
   if(e.target!==e.currentTarget||disabled||e.altKey||e.ctrlKey||e.metaKey)return;const d:Record<string,[number,number]>={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};const delta=d[e.key];
   if(delta){e.preventDefault();setRoute([]);setDestination(undefined);const next={x:position.x+delta[0],y:position.y+delta[1]};if(townWalkable(next))setPosition(next);}
   if(e.key==='Enter'&&near){e.preventDefault();onEnter(near.id);}
  }}>
   <svg className="harbor-map" viewBox={`0 0 ${townSize.width*cell} ${townSize.height*cell}`} role="img" aria-label="Saltwake harbor: inn and market in the north, alchemist southwest, guild southeast, catacombs northeast." onClick={e=>{
    if(disabled)return;const r=e.currentTarget.getBoundingClientRect();const p={x:Math.floor((e.clientX-r.left)/r.width*townSize.width),y:Math.floor((e.clientY-r.top)/r.height*townSize.height)};
    const building=places.find(b=>p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height);if(building){travel(building.id);return;}
    setDestination(undefined);setRoute(townPath(position,p));field.current?.focus({preventScroll:true});
   }}>
    <defs><pattern id="water" width="50" height="36" patternUnits="userSpaceOnUse"><path d="M3 22q10-6 22 0M28 5q8-4 16 0" stroke="#60858b" strokeWidth="2" opacity=".28" fill="none"/></pattern><pattern id="cobbles" width="27" height="19" patternUnits="userSpaceOnUse"><path d="M0 0h27v19H0zM13 0v9M0 9h27" fill="#887c64" stroke="#6d6755" strokeWidth="1"/></pattern><pattern id="grass" width="30" height="30" patternUnits="userSpaceOnUse"><path d="m5 9 2-4 2 4m13 13 2-5 2 5" stroke="#66805a" strokeWidth="1" opacity=".35"/></pattern></defs>
    {Array.from({length:townSize.width*townSize.height},(_,i)=>{const tx=i%townSize.width,ty=Math.floor(i/townSize.width);const road=tx>=3&&(ty===5||ty===8||ty===13||tx===8||tx===13||tx===20);return <g key={i}><rect x={tx*cell} y={ty*cell} width={cell} height={cell} fill={tx<3?'#214954':road?(i%2?'#887c64':'#81755e'):(i%2?'#3a5039':'#344a35')} stroke="#172c2740" strokeWidth="1"/>{tx<3&&<path d={`M${tx*cell+7} ${ty*cell+23}q12-6 25 0`} stroke="#68939b" opacity=".35" fill="none"/>}</g>;})}
    {places.map(b=>{const bx=b.x*cell,by=b.y*cell,w=b.width*cell,h=b.height*cell;return <g key={b.id} transform={`translate(${bx} ${by})`}>
     <rect x="8" y="12" width={w} height={h} rx="4" fill="#14291f" opacity=".5"/><rect y="22" width={w} height={h-22} fill={b.id==='gate'?'#6a716a':'#b69d71'} stroke="#3b372b" strokeWidth="5"/>
     {b.id==='gate'?<><path d={`M0 24V-10h30V8h30v-18h30V8h30v-18h40v34`} fill="#80877c" stroke="#444b43" strokeWidth="5"/><path d={`M${w/2-26} ${h}V66a26 26 0 0 1 52 0v54`} fill="#101c1d"/><path d={`M${w/2-15} 60v60m15-68v68m15-60v60`} stroke="#6a6552" strokeWidth="4"/></>:<><path d={`M-10 45 20-8H${w-20}L${w+10} 45Z`} fill={b.id==='workshop'?'#426366':b.id==='market'?'#756044':'#794635'} stroke="#3b3027" strokeWidth="5"/>{[12,25,37].map(ry=><path key={ry} d={`M${12-ry/3} ${ry}H${w-12+ry/3}`} stroke="#b48059" opacity=".4"/>)}<rect x={w/2-15} y={h-44} width="30" height="44" fill="#40362b" stroke="#75634b" strokeWidth="3"/>{[22,w-48].map(wx=><g key={wx}><rect x={wx} y="60" width="27" height="26" fill="#e1b55a" stroke="#564431" strokeWidth="5"/><path d={`M${wx+13} 61v24M${wx} 73h27`} stroke="#685239" strokeWidth="3"/></g>)}</>}
     {b.id==='market'&&<g>{Array.from({length:8},(_,i)=><path key={i} d={`M${i*25} 88h25l4 21h-29z`} fill={i%2?'#d2bc8e':'#777945'}/>)}<rect x="4" y="112" width={w-8} height="18" fill="#735036"/></g>}
     {b.id==='workshop'&&<><rect x="110" y="-22" width="21" height="49" fill="#656961" stroke="#373c35" strokeWidth="4"/><path d="M120-26q-12-20 3-29" stroke="#c4c2b0" strokeWidth="10" fill="none" opacity=".35"/></>}
    </g>;})}
    <g className="tile-town-grid" stroke="#10292055" strokeWidth="1">{Array.from({length:townSize.width+1},(_,i)=><path key={'v'+i} d={`M${i*cell} 0v${townSize.height*cell}`}/>)}{Array.from({length:townSize.height+1},(_,i)=><path key={'h'+i} d={`M0 ${i*cell}h${townSize.width*cell}`}/>)}</g>
    {route.filter((_,i)=>i%2===0).map(p=><circle key={`${p.x}-${p.y}`} cx={p.x*cell+20} cy={p.y*cell+20} r="3" fill="#e3cb8e" opacity=".65"/>)}
    <g className="town-avatar" transform={`translate(${x} ${y})`}><ellipse cy="14" rx="13" ry="6" fill="#17271d" opacity=".7"/><path d="M-7-4-12 14Q0 20 12 14L7-4" fill="#c4aa66" stroke="#382d22" strokeWidth="2"/><path d="M-7 14-5 20m12-6-2 6" stroke="#292b29" strokeWidth="4"/><circle cy="-9" r="7" fill="#d4ad7b"/><path d="M-8-10q8-15 16 0" fill="#5e4334"/><path d="m10 4 10 8" stroke="#d5d4b6" strokeWidth="3"/></g>
   </svg>
   {places.map(p=><button key={p.id} className={`place-sign ${p.id}`} disabled={disabled} style={{left:`${(p.x+p.width/2)/townSize.width*100}%`,top:`${(p.y+p.height+.1)/townSize.height*100}%`}} onClick={()=>travel(p.id)} aria-label={`Visit ${p.name}`}><strong>{p.name}</strong><span>{p.id==='gate'?`${openings} funded openings`:p.id==='market'?`${stock} goods for sale`:p.id==='workshop'?'Craft & earn':p.id==='guild'?'Fund an expedition':'Satchel & journal'}</span></button>)}
   {children}
  </div>
  <div className="town-prompt"><div><strong>{route.length?'On your way…':near?near.name:'The harbor square'}</strong><p role="status">{message}</p></div>{near&&!route.length&&<button disabled={disabled} onClick={()=>onEnter(near.id)}>Enter [↵]</button>}</div>
  <p className="world-help">Click a building to walk there. Arrow keys / WASD to walk. Enter to visit. Choose your work at the market, kettle, or guild.</p>
 </section>;
}
