/** Town ground art: cobbled streets with kerbs and worn centres, varied grass, a stone quay and pier.
 * Presentation only. Every variation comes from a coordinate-seeded hash so screenshots are stable. */
import React,{useMemo} from 'react';
import type {DistrictId} from '../../../../packages/game/src/town-districts';
import {townTerrain} from '../town-terrain';
import './town-art.css';

const W=24,H=16;
/** Deterministic 32-bit hash of a few integers (and an optional salt string). */
export function townHash(...parts:(number|string)[]):number{
 let h=0x9e3779b9;
 for(const p of parts){const s=typeof p==='number'?String(p|0):p;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),0x85ebca6b);h^=h>>>13;}h=Math.imul(h^0x27d4eb2f,0xc2b2ae35);h^=h>>>16;}
 return h>>>0;
}

type Ground=ReturnType<typeof townTerrain>;
const OUTLINE='#2a2118';

/** One 40px cobble tile: offset rows of rounded stones; `v` picks the arrangement and tints. */
function cobbleStones(v:number,cell:number){
 const tones=[['#958871','#8b7f68','#9e9179','#857a64'],['#8f836c','#998c74','#877b65','#a0937b'],['#93866e','#887c66','#9b8e76','#8e826b']][v];
 const out:React.ReactNode[]=[];const rows=4,rh=cell/rows;
 for(let r=0;r<rows;r++){
  const off=((r+v)%2)*7-(v===2?3:0);let x=-off;let k=0;
  while(x<cell){const w=9+(townHash(v,r,k)%5);const c=tones[townHash(r,k,v,'t')%4];
   out.push(<rect key={`${r}-${k}`} x={x+.8} y={r*rh+.8} width={w-1.6} height={rh-1.6} rx="2.2" fill={c}/>);
   out.push(<path key={`h${r}-${k}`} d={`M${x+2} ${r*rh+1.8}h${Math.max(2,w-5)}`} stroke="#b3a68a" strokeWidth="1" opacity=".55"/>);
   x+=w;k++;}
 }
 return out;
}

export function TownGroundDefs({cell}:{cell:number}){
 return <defs>
  {[0,1,2].map(v=><pattern key={v} id={`tw-cob-${v}`} width={cell} height={cell} patternUnits="userSpaceOnUse"><rect width={cell} height={cell} fill="#5e5646"/>{cobbleStones(v,cell)}</pattern>)}
  <pattern id="tw-grass-0" width={cell} height={cell} patternUnits="userSpaceOnUse"><rect width={cell} height={cell} fill="#3d5839"/><path d="M4 8h2v1H4zM22 4h2v1h-2zM31 19h2v1h-2zM12 27h2v1h-2zM27 34h2v1h-2zM6 36h2v1H6z" fill="#4f6d47"/><path d="M15 13h1v2h-1zM35 9h1v2h-1zM9 21h1v2H9zM21 30h1v2h-1z" fill="#34502f"/></pattern>
  <pattern id="tw-grass-1" width={cell} height={cell} patternUnits="userSpaceOnUse"><rect width={cell} height={cell} fill="#3c5738"/><path d="M8 5h2v1H8zM28 12h2v1h-2zM17 22h2v1h-2zM34 28h2v1h-2zM3 31h2v1H3zM20 37h2v1h-2z" fill="#4b6844"/><path d="M24 6h1v2h-1zM5 15h1v2H5zM30 22h1v2h-1zM13 33h1v2h-1z" fill="#31492d"/></pattern>
  <pattern id="tw-water" width={cell} height={cell} patternUnits="userSpaceOnUse"><rect width={cell} height={cell} fill="#21505a"/><path d="M3 10h9M22 7h8M13 21h10M30 26h8M2 33h8M19 36h7" stroke="#2f6670" strokeWidth="2"/><path d="M5 10h5M24 7h4M15 21h6M32 26h4" stroke="#3f7f88" strokeWidth="1"/></pattern>
  <pattern id="tw-planks" width={cell} height={cell} patternUnits="userSpaceOnUse"><rect width={cell} height={cell} fill="#7b5b3b"/>{[0,8,16,24,32].map((x,i)=><g key={x}><rect x={x} y="0" width="8" height={cell} fill={i%2?'#84633f':'#76563a'}/><path d={`M${x} 0v${cell}`} stroke="#4a3322" strokeWidth="1.5"/><circle cx={x+4} cy={6+(i*7)%12} r=".9" fill="#3a2818"/><circle cx={x+4} cy={30+(i*5)%8} r=".9" fill="#3a2818"/></g>)}</pattern>
  <radialGradient id="tw-glow"><stop offset="0" stopColor="#ffd98a" stopOpacity=".85"/><stop offset=".35" stopColor="#ffb54d" stopOpacity=".38"/><stop offset="1" stopColor="#ff9a2e" stopOpacity="0"/></radialGradient>
  <radialGradient id="tw-pool"><stop offset="0" stopColor="#ffd27a" stopOpacity=".42"/><stop offset=".6" stopColor="#ffb34d" stopOpacity=".14"/><stop offset="1" stopColor="#ffb34d" stopOpacity="0"/></radialGradient>
  <radialGradient id="tw-glow-violet"><stop offset="0" stopColor="#d8c8ff" stopOpacity=".8"/><stop offset=".4" stopColor="#9a7fe0" stopOpacity=".3"/><stop offset="1" stopColor="#6a4fc0" stopOpacity="0"/></radialGradient>
  <linearGradient id="tw-smoke-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9e4d6"/><stop offset="1" stopColor="#bdb6a6"/></linearGradient>
 </defs>;
}

/** Path for one grass tile with selected corners rounded (where two streets meet). */
function roundedTile(x:number,y:number,s:number,r:[number,number,number,number]){
 const [tl,tr,br,bl]=r;
 return `M${x+tl} ${y}H${x+s-tr}${tr?`A${tr} ${tr} 0 0 1 ${x+s} ${y+tr}`:''}V${y+s-br}${br?`A${br} ${br} 0 0 1 ${x+s-br} ${y+s}`:''}H${x+bl}${bl?`A${bl} ${bl} 0 0 1 ${x} ${y+s-bl}`:''}V${y+tl}${tl?`A${tl} ${tl} 0 0 1 ${x+tl} ${y}`:''}Z`;
}

function GrassDecor({x,y,h}:{x:number;y:number;h:number}){
 const roll=h%100,ox=x+6+(h>>>8)%22,oy=y+8+(h>>>13)%22;
 if(roll<14)return <g><path d={`M${ox} ${oy+5}l1-5 1 5M${ox+3} ${oy+5}l2-6 1 6M${ox+7} ${oy+5}l1-4 1 4`} stroke="#5f8150" strokeWidth="1.5" fill="none"/><path d={`M${ox+1} ${oy+5}h8`} stroke="#2f4a2b" strokeWidth="1"/></g>;
 if(roll<22){const c=['#f3e3a0','#e9a0a8','#f5f1e4','#c6b4f0'][(h>>>5)%4];return <g>{[[0,0],[6,3],[2,7],[9,-2]].slice(0,2+(h>>>3)%3).map(([dx,dy],i)=><g key={i}><rect x={ox+dx} y={oy+dy+2} width="1" height="3" fill="#3f6338"/><rect x={ox+dx-1} y={oy+dy} width="3" height="3" fill={c}/><rect x={ox+dx} y={oy+dy+1} width="1" height="1" fill="#d99a3a"/></g>)}</g>;}
 if(roll<27)return <ellipse cx={ox+6} cy={oy+5} rx={9+(h>>>4)%5} ry={5+(h>>>6)%3} fill="#5e5038" opacity=".55"/>;
 if(roll<33)return <g fill="#8a8574"><rect x={ox} y={oy} width="3" height="2"/><rect x={ox+6} y={oy+4} width="2" height="2"/><rect x={ox+3} y={oy+8} width="3" height="2" fill="#77725f"/></g>;
 if(roll<39)return <ellipse cx={ox+6} cy={oy+4} rx="10" ry="6" fill="#34502f" opacity=".7"/>;
 return null;
}

/** Ground for one district. Road layout comes from town-terrain.ts; this only decides how it looks. */
export function TownGround({district,cell}:{district:DistrictId;cell:number}){
 return useMemo(()=>{
  const at=(x:number,y:number):Ground=>townTerrain(district,Math.min(W-1,Math.max(0,x)),Math.min(H-1,Math.max(0,y)));
  const road=(x:number,y:number)=>at(x,y)==='road';
  const roads:React.ReactNode[]=[],waters:React.ReactNode[]=[],kerbs:React.ReactNode[]=[],grass:React.ReactNode[]=[],decor:React.ReactNode[]=[],walls:React.ReactNode[]=[],quay:React.ReactNode[]=[],top:React.ReactNode[]=[];
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){
   const g=at(tx,ty),x=tx*cell,y=ty*cell,h=townHash(tx,ty,district),k=`${tx}-${ty}`;
   if(g==='road'){
    const pier=at(tx,ty-1)==='water'&&at(tx,ty+1)==='water';
    if(pier){
     roads.push(<g key={k}><rect x={x} y={y-2} width={cell} height={cell+4} fill="url(#tw-planks)"/><path d={`M${x} ${y-1}h${cell}M${x} ${y+cell+1}h${cell}`} stroke={OUTLINE} strokeWidth="3"/>{tx%2===0&&<><rect x={x+3} y={y-6} width="6" height="8" fill="#4a3322" stroke={OUTLINE} strokeWidth="1.5"/><rect x={x+3} y={y+cell-2} width="6" height="8" fill="#4a3322" stroke={OUTLINE} strokeWidth="1.5"/></>}</g>);
     continue;
    }
    roads.push(<rect key={k} x={x} y={y} width={cell} height={cell} fill={`url(#tw-cob-${h%3})`} stroke="#5e5646" strokeWidth=".6"/>);
    // Worn centre: lighter where feet and carts run. A 2-wide street gets one shared band.
    const horiz=road(tx-1,ty)&&road(tx+1,ty),vert=road(tx,ty-1)&&road(tx,ty+1);
    const vertAt=(xx:number)=>road(xx,ty-1)&&road(xx,ty+1)&&road(xx,ty);
    if(horiz)roads.push(<rect key={k+'h'} x={x} y={y+13} width={cell} height={14} fill="#f6e6bd" opacity=".12"/>);
    if(vert){const l=vertAt(tx-1)?0:13,r=vertAt(tx+1)?cell:27;roads.push(<rect key={k+'v'} x={x+l} y={y} width={r-l} height={cell} fill="#f6e6bd" opacity=".12"/>);}
    const edge=at(tx-1,ty)==='grass'||at(tx+1,ty)==='grass'||at(tx,ty-1)==='grass'||at(tx,ty+1)==='grass';
    const roll=(h>>>7)%100;
    if(roll<5&&tx>0&&tx<W-1&&ty>0&&ty<H-1){const px=x+10+(h>>>11)%14,py=y+12+(h>>>15)%14;decor.push(<g key={k+'p'} className="tw-puddle"><ellipse cx={px} cy={py} rx={9+(h%4)} ry="4.5" fill="#34555b" opacity=".9"/><ellipse cx={px-2} cy={py-1} rx="5" ry="1.6" fill="none" stroke="#a9cdd0" strokeWidth="1" opacity=".6"/></g>);}
    else if(roll>=5&&roll<11&&edge){
     // Drain grate against the kerb.
     const side=at(tx,ty+1)==='grass'?'s':at(tx,ty-1)==='grass'?'n':at(tx-1,ty)==='grass'?'w':'e';
     const gx=side==='w'?x+4:side==='e'?x+cell-14:x+14,gy=side==='n'?y+4:side==='s'?y+cell-14:y+14;
     decor.push(<g key={k+'g'}><rect x={gx} y={gy} width="10" height="10" rx="1" fill="#2b2a24" stroke="#4d4a3e" strokeWidth="1.5"/><path d={`M${gx+3} ${gy+1.5}v7M${gx+5} ${gy+1.5}v7M${gx+7} ${gy+1.5}v7`} stroke="#6b675a" strokeWidth="1"/></g>);
    }
   }else if(g==='water'){
    waters.push(<rect key={k} x={x} y={y} width={cell} height={cell} fill="url(#tw-water)"/>);
    if(h%10<4)waters.push(<path key={k+'s'} className="tw-glint" style={{animationDelay:`${-(h%40)/10}s`}} d={`M${x+6+(h>>>4)%20} ${y+8+(h>>>9)%24}h${6+(h>>>3)%6}`} stroke="#bfe4e4" strokeWidth="2"/>);
    // Stone quay where the water meets the square, with mooring posts.
    if(at(tx+1,ty)!=='water'&&tx+1<W){
     quay.push(<g key={k+'q'}><rect x={x+27} y={y} width="3" height={cell} fill="#12343b" opacity=".7"/><rect x={x+30} y={y} width="10" height={cell} fill="#8d8878"/>{[0,1,2,3].map(i=><path key={i} d={`M${x+30} ${y+i*10+(ty%2)*5}h10`} stroke="#5d5a4e" strokeWidth="1"/>)}<path d={`M${x+31} ${y}v${cell}`} stroke="#b5ae98" strokeWidth="1.5"/><path d={`M${x+30} ${y}v${cell}`} stroke={OUTLINE} strokeWidth="1.5"/></g>);
     if(ty===3||ty===11)top.push(<g key={k+'m'}><path d={`M${x+34} ${y+18}q-14 10-22 4`} stroke="#c9b48a" strokeWidth="1.5" fill="none"/><rect x={x+31} y={y+14} width="7" height="9" rx="2" fill="#3a3a36" stroke={OUTLINE} strokeWidth="1.5"/><rect x={x+30} y={y+12} width="9" height="3" rx="1" fill="#55554e" stroke={OUTLINE} strokeWidth="1"/></g>);
     if(ty===11)top.push(<g key={k+'b'} className="tw-boat"><path d={`M${x-14} ${y+19}h34l-5 10h-25z`} fill="#7a4e30" stroke={OUTLINE} strokeWidth="2"/><path d={`M${x-12} ${y+22}h30`} stroke="#b07a48" strokeWidth="2"/><path d={`M${x-6} ${y+19}v-3M${x+10} ${y+19}v-3`} stroke="#5a3a24" strokeWidth="2"/></g>);
    }
   }else if(g==='wall'){
    walls.push(<rect key={k} x={x} y={y} width={cell} height={cell} fill="url(#sw-wall)"/>);
   }else{
    const r=(a:boolean,b:boolean)=>a&&b?13:0;
    const n=road(tx,ty-1),s=road(tx,ty+1),w=road(tx-1,ty),e=road(tx+1,ty);
    const d=roundedTile(x,y,cell,[r(n,w),r(n,e),r(s,e),r(s,w)]);
    const touches=n||s||w||e;
    if(touches)kerbs.push(<path key={k} d={d} className="tw-kerb"/>);
    grass.push(<path key={k} d={d} fill={`url(#tw-grass-${h%2})`} stroke={`url(#tw-grass-${h%2})`} strokeWidth="1.2"/>);
    decor.push(<GrassDecor key={k+'d'} x={x} y={y} h={h}/>);
   }
  }
  return <g className="tw-ground" aria-hidden="true">{roads}{waters}<g className="tw-kerbs">{kerbs}</g><g className="tw-kerbs-top">{kerbs.map(p=>React.cloneElement(p as React.ReactElement,{key:'t'+(p as React.ReactElement).key}))}</g>{grass}{decor}{walls}{quay}{top}</g>;
 },[district,cell]);
}
