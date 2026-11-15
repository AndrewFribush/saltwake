/** Town building and prop art. Each building kind has its own drawing inside the same footprint it always had,
 * so click targets and the walkable grid do not change. Pixel-ish SVG: dark outlines, parchment and teal palette. */
import React from 'react';
import type {TownBuilding} from '../../../../packages/game/src/town-districts';
import type {DistrictId} from '../../../../packages/game/src/town-districts';
import {ownerHue} from '../../../../packages/game/src/town-discovery';
import {townHash} from './town-ground';

const O='#2a2118',TIMBER='#5a3d26',PLASTER='#e8d6a8',PLASTER_LO='#d6c294',STONE='#8d897b',STONE_LO='#6c695e';

function Win({x,y,w=26,h=20,arch=false}:{x:number;y:number;w?:number;h?:number;arch?:boolean}){
 const top=arch?`M${x} ${y+h}V${y+w/2}a${w/2} ${w/2} 0 0 1 ${w} 0V${y+h}Z`:undefined;
 return <g className="tw-window">
  {arch?<path d={top} fill="#f6cb6a" stroke={O} strokeWidth="3"/>:<rect x={x} y={y} width={w} height={h} fill="#f6cb6a" stroke={O} strokeWidth="3"/>}
  <rect x={x+2} y={y+(arch?w/2:2)} width={w/2-3} height={4} fill="#fff1bf" opacity=".7"/>
  <path d={`M${x+w/2} ${y+1}v${h-2}M${x+1} ${y+h/2+(arch?3:0)}h${w-2}`} stroke="#6b4a2a" strokeWidth="2"/>
  <rect x={x-2} y={y+h} width={w+4} height="3" fill={TIMBER} stroke={O} strokeWidth="1.5"/>
 </g>;
}
/** A wall lantern: soft flickering glow, plus a faint light pool on the ground below. */
export function Lantern({x,y,pool=true,violet=false,seed=0}:{x:number;y:number;pool?:boolean;violet?:boolean;seed?:number}){
 return <g className="tw-lantern" aria-hidden="true">
  {pool&&<ellipse className="tw-pool" cx={x} cy={y+40} rx="30" ry="9" fill="url(#tw-pool)" style={{animationDelay:`${-(seed%17)/10}s`}}/>}
  <circle className="tw-glow" cx={x} cy={y} r="24" fill={violet?'url(#tw-glow-violet)':'url(#tw-glow)'} style={{animationDelay:`${-(seed%23)/10}s`}}/>
  <rect x={x-4} y={y-6} width="8" height="11" rx="1" fill={violet?'#cdbaff':'#ffd77a'} stroke={O} strokeWidth="2"/>
  <path d={`M${x-5} ${y-7}h10M${x} ${y-10}v3`} stroke={O} strokeWidth="2"/>
 </g>;
}
function Smoke({x,y,seed=0}:{x:number;y:number;seed?:number}){
 return <g className="tw-smoke" aria-hidden="true">{[0,1,2,3].map(i=><circle key={i} cx={x} cy={y} r={5+i} fill="url(#tw-smoke-fade)" style={{animationDelay:`${i*1.1+(seed%7)/10}s`}}/>)}</g>;
}
function Shadow({w,h}:{w:number;h:number}){return <rect x="6" y="14" width={w} height={h-10} rx="4" fill="#0b1a14" opacity=".38"/>;}
function Timbers({x,y,w,h,step=40}:{x:number;y:number;w:number;h:number;step?:number}){
 const posts:number[]=[];for(let px=x;px<=x+w;px+=step)posts.push(px);
 return <g>{posts.map(px=><rect key={px} x={px-2.5} y={y} width="5" height={h} fill={TIMBER}/>)}{posts.slice(0,-1).map((px,i)=><path key={'b'+px} d={i%2?`M${px+3} ${y+h-2}L${px+step-3} ${y+2}`:`M${px+3} ${y+2}L${px+step-3} ${y+h-2}`} stroke={TIMBER} strokeWidth="4"/>)}<rect x={x} y={y-3} width={w} height="6" fill={TIMBER} stroke={O} strokeWidth="1.5"/><rect x={x} y={y+h-3} width={w} height="6" fill={TIMBER} stroke={O} strokeWidth="1.5"/></g>;
}
function Roof({w,y0,y1,inset,fill,lines='#00000033',over=8}:{w:number;y0:number;y1:number;inset:number;fill:string;lines?:string;over?:number}){
 const rows:number[]=[];for(let ry=y0+8;ry<y1-2;ry+=8)rows.push(ry);
 const xAt=(ry:number)=>-over+(inset+over)*(1-(ry-y0)/(y1-y0));
 return <g><path d={`M${-over} ${y1}L${inset} ${y0}H${w-inset}L${w+over} ${y1}Z`} fill={fill} stroke={O} strokeWidth="3.5" strokeLinejoin="round"/>
  {rows.map((ry,i)=><g key={ry}><path d={`M${xAt(ry)+2} ${ry}H${w-xAt(ry)-2}`} stroke={lines} strokeWidth="2"/>{Array.from({length:Math.floor((w-2*xAt(ry))/12)},(_,j)=><path key={j} d={`M${xAt(ry)+8+j*12+(i%2)*6} ${ry-7}v6`} stroke={lines} strokeWidth="1"/>)}</g>)}
  <path d={`M${inset} ${y0}H${w-inset}`} stroke="#ffffff30" strokeWidth="2"/></g>;
}
function Stones({x,y,w,h,fill=STONE,line=STONE_LO,row=10}:{x:number;y:number;w:number;h:number;fill?:string;line?:string;row?:number}){
 const ls:React.ReactNode[]=[];for(let r=0;r*row<h;r++){ls.push(<path key={'r'+r} d={`M${x} ${y+r*row}h${w}`} stroke={line} strokeWidth="1.2"/>);for(let c=(r%2)*9;c<w;c+=18)ls.push(<path key={`c${r}-${c}`} d={`M${x+c} ${y+r*row}v${Math.min(row,h-r*row)}`} stroke={line} strokeWidth="1.2"/>);}
 return <g><rect x={x} y={y} width={w} height={h} fill={fill}/>{ls}<rect x={x} y={y} width={w} height={h} fill="none" stroke={O} strokeWidth="3"/></g>;
}
function Crate({x,y,s=18}:{x:number;y:number;s?:number}){return <g><rect x={x} y={y} width={s} height={s} fill="#9a6b3e" stroke={O} strokeWidth="2"/><path d={`M${x+2} ${y+2}L${x+s-2} ${y+s-2}M${x+s-2} ${y+2}L${x+2} ${y+s-2}`} stroke="#6b4626" strokeWidth="2"/><path d={`M${x+1} ${y+3}h${s-2}`} stroke="#c08a52" strokeWidth="1"/></g>;}
function Barrel({x,y}:{x:number;y:number}){return <g><rect x={x} y={y} width="16" height="20" rx="5" fill="#8a5a32" stroke={O} strokeWidth="2"/><path d={`M${x+1} ${y+5}h14M${x+1} ${y+15}h14`} stroke="#3e3a34" strokeWidth="2"/><path d={`M${x+5} ${y+2}v16`} stroke="#b07a48" strokeWidth="1.5"/></g>;}

/** Doorways. Each keeps the `building-door` group and aria-label the town has always exposed. */
function Door({b,kind,dx,dy,cell}:{b:TownBuilding;kind:string;dx:number;dy:number;cell:number}){
 const wood=<><path d="M9 39V16a11 9 0 0 1 22 0v23Z" fill="#6a4a2c"/><path d="M15 12v27m10-27v27" stroke="#3d2a1a" strokeWidth="1.5"/><circle cx="27" cy="27" r="2" fill="#e8c36e"/></>;
 return <g className="building-door" aria-label={`Door to ${b.name}`} transform={`translate(${dx} ${dy})`}>
  {kind==='gate'?<>
   <path d="M2 40V14a18 16 0 0 1 36 0v26Z" fill="#0d1210" stroke="#a3a691" strokeWidth="3"/>
   <g className="tw-portcullis">{[8,15,22,29].map(px=><path key={px} d={`M${px+1} 4v32l-2 4h4l-2-4`} stroke="#5d6058" strokeWidth="2.5" fill="#5d6058"/>)}<path d="M4 16h32M4 28h32" stroke="#5d6058" strokeWidth="2.5"/></g>
   <path d="M0 39h40" stroke="#4a4f48" strokeWidth="3"/>
  </>:kind==='guild'?<>
   <path d="M-8 40V12a28 18 0 0 1 56 0v28Z" fill="#1c2420" stroke="#c9c2a8" strokeWidth="4"/>
   <path d="M-3 40V14a23 14 0 0 1 46 0v26Z" fill="#6a4a2c"/><path d="M20 4v36" stroke="#2f2014" strokeWidth="2.5"/><path d="M4 18h12M24 18h12M4 30h12M24 30h12" stroke="#3d2a1a" strokeWidth="2"/><circle cx="16" cy="25" r="2" fill="#e8c36e"/><circle cx="24" cy="25" r="2" fill="#e8c36e"/>
   <path d="M-10 39h60" stroke="#cfc4a0" strokeWidth="3"/>
  </>:kind==='market'?<>
   <rect x="2" y="6" width="36" height="34" fill="#3a2a1c" stroke={O} strokeWidth="3"/>
   <rect x="5" y="9" width="30" height="31" fill="#f2c56a" opacity=".55"/><path d="M5 9h30v8q-8 4-15 0q-7 4-15 0z" fill="#3f7f7a" stroke={O} strokeWidth="1.5"/>
   <path d="M0 39h40" stroke="#ccb987" strokeWidth="3"/>
  </>:kind==='dungeon'?<>
   <path d="M5 40V14a15 12 0 0 1 30 0v26" fill="#0d0c16" stroke="#9a8fd0" strokeWidth="3"/>
   <path d="M10 26h20M8 32h24M6 38h28" stroke="#3a3560" strokeWidth="3"/>
  </>:<>
   <path d="M5 40V14a15 12 0 0 1 30 0v26" fill="#1c2420" stroke="#5a3d26" strokeWidth="4"/>{wood}
   <path d="M2 39h36" stroke="#ccb987" strokeWidth="3"/>
  </>}
 </g>;
}

function Inn({w}:{w:number}){
 return <g>
  <Stones x={4} y={72} w={w-8} h={48} fill={PLASTER_LO} line="#bba678" row={12}/>
  <rect x={4} y={108} width={w-8} height={12} fill={STONE} stroke={O} strokeWidth="2"/>
  <rect x={0} y={34} width={w} height={40} fill={PLASTER} stroke={O} strokeWidth="3"/>
  <Timbers x={0} y={34} w={w} h={40}/>
  <rect x={0} y={72} width={w} height="5" fill="#00000040"/>
  <rect x="116" y="-24" width="18" height="36" fill={STONE} stroke={O} strokeWidth="3"/><rect x="113" y="-28" width="24" height="6" fill={STONE_LO} stroke={O} strokeWidth="2.5"/>
  <Roof w={w} y0={-6} y1={38} inset={22} fill="#8a4a33"/>
  <path d={`M${w/2-14} 38V16h28v22`} fill="#8a4a33" stroke={O} strokeWidth="3"/><Win x={w/2-9} y={20} w={18} h={14}/>
  <Win x={12} y={44} w={26} h={20}/><Win x={w-38} y={44} w={26} h={20}/>
  <Win x={12} y={82} w={26} h={20}/><Win x={46} y={82} w={22} h={20}/><Win x={w-30} y={82} w={22} h={20}/>
  {/* Hanging lantern sign on an iron bracket. */}
  <g className="tw-hang"><path d="M2 46h-22M-6 46l12-10" stroke="#2b2622" strokeWidth="3" fill="none"/><path d="M-18 46v6M-6 46v6" stroke="#2b2622" strokeWidth="1.5"/>
   <rect x="-24" y="52" width="24" height="18" rx="2" fill="#5b3f26" stroke={O} strokeWidth="2.5"/><rect x="-15" y="55" width="6" height="9" rx="1" fill="#ffd77a" stroke={O} strokeWidth="1.5"/><path d="M-16 54h8" stroke={O} strokeWidth="1.5"/></g>
  <Smoke x={125} y={-30} seed={3}/>
  <Lantern x={w-36} y={88} seed={5}/>
 </g>;
}
function Market({w}:{w:number}){
 const stripes=Math.ceil(w/20);
 return <g>
  <rect x={6} y={30} width={w-12} height={62} fill={PLASTER_LO} stroke={O} strokeWidth="3"/>
  <rect x={10} y={62} width={w-20} height={30} fill="#3a2a1c"/>
  <Roof w={w} y0={-4} y1={40} inset={18} fill="#7a5a3c"/>
  {/* Striped awning with a scalloped edge. */}
  {Array.from({length:stripes},(_,i)=><path key={i} d={`M${i*20} 40h20v18q-10 8-20 0z`} fill={i%2?'#efe2bd':'#3f7f7a'} stroke={O} strokeWidth="1.5"/>)}
  <path d={`M0 40h${w}`} stroke={O} strokeWidth="3"/>
  {/* Counters with goods. */}
  <rect x={12} y={74} width={64} height={12} fill="#8a5f38" stroke={O} strokeWidth="2"/><rect x={w-76} y={74} width={64} height={12} fill="#8a5f38" stroke={O} strokeWidth="2"/>
  {[16,26,36].map(fx=><ellipse key={fx} cx={fx+4} cy={71} rx="6" ry="3" fill="#9fb3b8" stroke={O} strokeWidth="1.2"/>)}
  {[52,58,64,55,61].map((ax,i)=><circle key={i} cx={ax} cy={i<3?71:67} r="3" fill={i%2?'#d0583a':'#e0b04a'} stroke={O} strokeWidth="1"/>)}
  {[w-70,w-56,w-42].map(lx=><rect key={lx} x={lx} y={66} width="11" height="7" rx="3" fill="#d29a55" stroke={O} strokeWidth="1.2"/>)}
  {[w-26,w-20].map(gx=><circle key={gx} cx={gx} cy={70} r="3.5" fill="#7aa04a" stroke={O} strokeWidth="1"/>)}
  {[8,w/2-2,w-12].map(px=><rect key={px} x={px} y={50} width="4" height={44} fill={TIMBER} stroke={O} strokeWidth="1"/>)}
  <rect x={4} y={92} width={w-8} height="4" fill="#00000035"/>
  <Crate x={6} y={96}/><Barrel x={28} y={96}/><Crate x={48} y={102} s={14}/><path d="M54 98q4-6 9 0z" fill="#c9b48a" stroke={O} strokeWidth="1.2"/>
  <Barrel x={w-72} y={96}/><Crate x={w-52} y={98}/><Barrel x={w-30} y={96}/><Crate x={w-56} y={86} s={12}/>
 </g>;
}
function Workshop({w}:{w:number}){
 return <g>
  <Stones x={4} y={72} w={w-8} h={48}/>
  <rect x={0} y={36} width={w} height={38} fill={PLASTER} stroke={O} strokeWidth="3"/>
  <Timbers x={0} y={36} w={w} h={38} step={32}/>
  {/* Brick stack with a copper flue. */}
  <rect x="110" y="-24" width="20" height="40" fill="#7a4e40" stroke={O} strokeWidth="3"/>{[-16,-8,0,8].map(by=><path key={by} d={`M111 ${by}h18`} stroke="#5a382d" strokeWidth="1.2"/>)}
  <rect x="114" y="-40" width="12" height="18" fill="#c27a3e" stroke={O} strokeWidth="2.5"/><rect x="116" y="-38" width="3" height="14" fill="#f0b276"/><rect x="111" y="-43" width="18" height="5" fill="#d98d4a" stroke={O} strokeWidth="2"/><rect x="113" y="-30" width="14" height="3" fill="#8e5022"/>
  <Roof w={w} y0={-2} y1={40} inset={20} fill="#3e6664" lines="#22403f66"/>
  <Win x={14} y={45} w={24} h={18}/><Win x={w-38} y={45} w={24} h={18}/>
  <g className="tw-window tw-forge"><rect x="14" y="84" width="34" height="22" fill="#ff9a3c" stroke={O} strokeWidth="3"/><path d="M20 106v-8h4v8M30 106v-12h4v12M40 106v-6h3v6" fill="#6aa58a" stroke={O} strokeWidth="1"/></g>
  <Win x={w-32} y={84} w={22} h={20}/>
  {/* Hanging copper kettle sign. */}
  <g className="tw-hang"><path d={`M${w-2} 50h22M${w+6} 50l-10-10`} stroke="#2b2622" strokeWidth="3" fill="none"/><path d={`M${w+14} 50v6`} stroke="#2b2622" strokeWidth="1.5"/>
   <path d={`M${w+5} 70q0-12 9-12t9 12z`} fill="#c27a3e" stroke={O} strokeWidth="2"/><path d={`M${w+22} 64l7-5`} stroke="#c27a3e" strokeWidth="3"/><path d={`M${w+8} 58q6-7 12 0`} stroke={O} strokeWidth="2" fill="none"/><rect x={w+8} y={61} width="3" height="5" fill="#f0b276"/></g>
  <rect x="124" y="104" width="20" height="14" rx="3" fill="#b06a34" stroke={O} strokeWidth="2"/><path d="M126 108h16" stroke="#e39a5a" strokeWidth="1.5"/>
  <Smoke x={120} y={-46} seed={1}/>
  <Lantern x={w/2-8} y={90} pool={true} seed={9}/>
 </g>;
}
function Guild({w}:{w:number}){
 const banner=(bx:number)=><g key={bx} className="tw-banner"><rect x={bx-1} y="56" width="22" height="4" fill="#3b2a1b" stroke={O} strokeWidth="1.5"/><path d={`M${bx} 60h20v34l-10-7-10 7z`} fill="#8e2f2a" stroke={O} strokeWidth="2"/><path d={`M${bx+3} 62v26M${bx+17} 62v26`} stroke="#d9b866" strokeWidth="1.5"/><path d={`M${bx+6} 80l8-12M${bx+14} 80l-8-12`} stroke="#e8d6a8" strokeWidth="2"/></g>;
 return <g>
  <Stones x={0} y={54} w={w} h={66} fill="#9a968a" line="#77736a" row={11}/>
  <rect x={0} y={24} width={w} height={32} fill={PLASTER} stroke={O} strokeWidth="3"/>
  <Timbers x={0} y={24} w={w} h={32} step={32}/>
  <Roof w={w} y0={-10} y1={28} inset={16} fill="#4a5568" lines="#2a324066"/>
  <path d={`M${w/2-18} 28L${w/2} 4L${w/2+18} 28Z`} fill="#4a5568" stroke={O} strokeWidth="3"/>
  <Win x={14} y={31} w={22} h={16}/><Win x={w/2-10} y={31} w={20} h={16}/><Win x={w-36} y={31} w={22} h={16}/>
  {/* Shield above the wide door. */}
  <path d="M48 56h24v10q0 10-12 14q-12-4-12-14z" fill="#3f7f7a" stroke={O} strokeWidth="2.5"/><path d="M53 62l14 12M67 62l-14 12" stroke="#d9b866" strokeWidth="2.5"/>
  {banner(92)}{banner(126)}
  <Win x={100} y={96} w={14} h={18} arch/><Win x={132} y={96} w={14} h={18} arch/>
  <Lantern x={18} y={88} seed={13}/>
 </g>;
}
function Gate({w}:{w:number}){
 const moss=[[14,22,10],[60,18,8],[120,-6,9],[146,40,7],[8,70,6],[98,96,7]];
 return <g>
  <path d={`M0 120V22h10v-8h14v8h14v-8h14v8h14v-8h14v8h18V120Z`} fill="#4f5651" stroke={O} strokeWidth="3.5" strokeLinejoin="round"/>
  {Array.from({length:9},(_,r)=><path key={r} d={`M2 ${30+r*10}h96`} stroke="#3c423e" strokeWidth="1.3"/>)}
  {Array.from({length:9},(_,r)=>Array.from({length:6},(_,c)=><path key={`${r}-${c}`} d={`M${4+c*18+(r%2)*9} ${30+r*10}v10`} stroke="#3c423e" strokeWidth="1.3"/>))}
  {/* Tower. */}
  <path d={`M100 120V-6h8v-8h12v8h12v-8h12v8h8V120Z`} fill="#565d57" stroke={O} strokeWidth="3.5" strokeLinejoin="round"/>
  {Array.from({length:12},(_,r)=><path key={'t'+r} d={`M102 ${4+r*10}h50`} stroke="#3c423e" strokeWidth="1.3"/>)}
  <rect x="122" y="20" width="8" height="18" fill="#0d1210" stroke={O} strokeWidth="2"/><rect x="122" y="60" width="8" height="16" fill="#0d1210" stroke={O} strokeWidth="2"/>
  {/* Dark arch around the portcullis. */}
  <path d="M30 120V82a30 28 0 0 1 60 0V120" fill="#2f3532" stroke={O} strokeWidth="3"/>
  {[-60,-30,0,30,60].map(a=><path key={a} d="M60 52v8" stroke="#8a8f84" strokeWidth="5" transform={`rotate(${a} 60 82)`}/>)}
  <path d="M28 120V84M92 120V84" stroke="#7d8378" strokeWidth="4"/>
  {moss.map(([mx,my,r],i)=><g key={i}><ellipse cx={mx} cy={my} rx={r} ry={r*.55} fill="#56743f"/><ellipse cx={mx-r/3} cy={my-1} rx={r/2} ry={r*.3} fill="#7a9a52"/></g>)}
  <path d="M70 30l4 8-3 6 5 9" stroke="#2c312e" strokeWidth="1.5" fill="none"/>
  <path d="M100 30q-4 16 2 30q-6 14-1 28" stroke="#4e6e3a" strokeWidth="3" fill="none"/>
  {[[20,84],[100,84]].map(([tx,ty])=><g key={tx}><rect x={tx-2} y={ty} width="4" height="12" fill="#3b2a1b" stroke={O} strokeWidth="1"/><path d={`M${tx} ${ty-9}q-5 6 0 9q5-3 0-9z`} className="tw-flame" fill="#ffb648"/><Lantern x={tx} y={ty-4} pool={tx<60} seed={tx}/></g>)}
 </g>;
}
function PlayerShop({b,w}:{b:TownBuilding;w:number}){
 const hue=townHash(b.id,'awning')%360,awn=`hsl(${hue} 52% 46%)`;
 return <g>
  <rect x={6} y={24} width={w-12} height={56} fill={PLASTER_LO} stroke={O} strokeWidth="3"/>
  <Timbers x={6} y={24} w={w-12} h={56} step={36}/>
  <Roof w={w} y0={2} y1={28} inset={14} fill="#6e4a32" over={4}/>
  {Array.from({length:6},(_,i)=><path key={i} d={`M${i*20} 28h20v12q-10 7-20 0z`} fill={i%2?'#efe2bd':awn} stroke={O} strokeWidth="1.5"/>)}
  <path d={`M0 28h${w}`} stroke={O} strokeWidth="3"/>
  <Win x={w-34} y={48} w={22} h={16}/>
  <rect x={8} y={58} width={30} height={8} fill="#8a5f38" stroke={O} strokeWidth="2"/>{[12,20,28].map(gx=><circle key={gx} cx={gx} cy={55} r="3" fill={`hsl(${(hue+gx*7)%360} 55% 55%)`} stroke={O} strokeWidth="1"/>)}
  <Crate x={w-30} y={66} s={13}/>
  <Lantern x={w-38} y={50} pool={false} seed={hue}/>
 </g>;
}
function DungeonHall({w}:{w:number}){
 return <g>
  <Stones x={6} y={24} w={w-12} h={56} fill="#6f7270" line="#555856" row={10}/>
  <Roof w={w} y0={0} y1={28} inset={14} fill="#363a4f" over={4} lines="#1d203066"/>
  <path d="M14 70q6-10 14-4q4-8 10 0" stroke="#56743f" strokeWidth="4" fill="none"/>
  <Lantern x={w-24} y={48} violet pool={false} seed={7}/>
 </g>;
}

export function buildingKind(b:TownBuilding){return b.shopId?(b.edition?'dungeon':'shop'):b.id;}

/** The whole building: body art, doorway, owner banner and dungeon mark (for player buildings). */
export function TownBuildingArt({b,cell}:{b:TownBuilding;cell:number}){
 const w=b.width*cell,h=b.height*cell,dx=(b.door.x-b.x)*cell,dy=(b.door.y-b.y)*cell,kind=buildingKind(b);
 return <>
  <Shadow w={w} h={h}/>
  {kind==='inn'?<Inn w={w}/>:kind==='market'?<Market w={w}/>:kind==='workshop'?<Workshop w={w}/>:kind==='guild'?<Guild w={w}/>:kind==='gate'?<Gate w={w}/>:kind==='dungeon'?<DungeonHall w={w}/>:<PlayerShop b={b} w={w}/>}
  <Door b={b} kind={kind} dx={dx} dy={dy} cell={cell}/>
  <ellipse className="tw-pool tw-door-pool" cx={dx+cell/2} cy={dy+cell+6} rx="26" ry="7" fill="url(#tw-pool)"/>
  {b.shopId&&<g className="owner-banner" aria-hidden="true"><path d={`M${w-14} 20V-26`} stroke="#3b3027" strokeWidth="3"/><path d={`M${w-13} -26h20l-6 7 6 7h-20z`} fill={`hsl(${ownerHue(b.keeper)} 55% 52%)`} stroke="#2a241d" strokeWidth="2"/></g>}
  {b.edition&&<g className="dungeon-hall-mark" aria-hidden="true"><rect x={w/2-14} y="-30" width="28" height="24" rx="3" fill="#22253a" stroke="#9a8fd0" strokeWidth="3"/><path d={`M${w/2-8} -12h6v-5h5v-5h5`} stroke="#d8cff7" strokeWidth="3" fill="none"/></g>}
 </>;
}

/* ---------- Decorative, non-interactive props ---------- */
type PropKind='well'|'tree'|'lamp'|'pillar'|'rack'|'nets'|'barrels'|'bench'|'bush';
function Prop({kind,x,y,seed}:{kind:PropKind;x:number;y:number;seed:number}){
 const t=`translate(${x} ${y})`;
 switch(kind){
  case 'well':return <g transform={t}><ellipse cx="20" cy="34" rx="18" ry="6" fill="#0b1a14" opacity=".35"/><rect x="5" y="18" width="30" height="16" rx="3" fill={STONE} stroke={O} strokeWidth="2.5"/><path d="M6 25h28M14 18v7M26 25v8" stroke={STONE_LO} strokeWidth="1.5"/><ellipse cx="20" cy="18" rx="15" ry="5" fill="#1d3a40" stroke={O} strokeWidth="2.5"/><path d="M8 18V2M32 18V2" stroke={TIMBER} strokeWidth="3"/><path d="M4 4L20 -6L36 4Z" fill="#8a4a33" stroke={O} strokeWidth="2"/><path d="M8 7h24" stroke="#3b2a1b" strokeWidth="2"/><path d="M20 7v8" stroke="#c9b48a" strokeWidth="1"/><rect x="17" y="13" width="6" height="5" fill="#8a5a32" stroke={O} strokeWidth="1"/></g>;
  case 'tree':{const g=['#4f7a3e','#557f3c','#4a7340'][seed%3];return <g transform={t}><ellipse cx="20" cy="36" rx="17" ry="5" fill="#0b1a14" opacity=".4"/><rect x="16" y="20" width="8" height="16" fill="#5a3d26" stroke={O} strokeWidth="2"/><circle cx="20" cy="8" r="16" fill={g} stroke={O} strokeWidth="2.5"/><circle cx="10" cy="15" r="9" fill={g} stroke={O} strokeWidth="2.5"/><circle cx="30" cy="15" r="9" fill={g} stroke={O} strokeWidth="2.5"/><circle cx="20" cy="8" r="14" fill={g}/><circle cx="14" cy="3" r="5" fill="#6f9a52"/><circle cx="27" cy="10" r="3" fill="#6f9a52"/>{seed%2===0&&<><circle cx="12" cy="14" r="1.6" fill="#e05a3a"/><circle cx="26" cy="4" r="1.6" fill="#e05a3a"/></>}</g>;}
  case 'lamp':return <g transform={t}><ellipse cx="20" cy="36" rx="7" ry="2.5" fill="#0b1a14" opacity=".4"/><rect x="18" y="4" width="4" height="32" fill="#2f2e2a" stroke={O} strokeWidth="1"/><rect x="15" y="33" width="10" height="4" fill="#2f2e2a"/><Lantern x={20} y={2} pool={false} seed={seed}/><ellipse className="tw-pool" cx="20" cy="34" rx="30" ry="10" fill="url(#tw-pool)" style={{animationDelay:`${-(seed%13)/10}s`}}/></g>;
  case 'pillar':return <g transform={t}><ellipse cx="20" cy="36" rx="11" ry="3.5" fill="#0b1a14" opacity=".4"/><rect x="11" y="2" width="18" height="34" rx="2" fill="#8a5f38" stroke={O} strokeWidth="2.5"/><path d="M9 2h22l-4-6h-14z" fill="#3e6664" stroke={O} strokeWidth="2"/><rect x="13" y="7" width="9" height="11" fill="#efe3c4" stroke="#6b4a2a" strokeWidth="1" transform="rotate(-6 17 12)"/><rect x="18" y="17" width="9" height="10" fill="#e6d4a8" stroke="#6b4a2a" strokeWidth="1" transform="rotate(5 22 22)"/><rect x="14" y="27" width="8" height="6" fill="#f3e9cc" stroke="#6b4a2a" strokeWidth="1"/><circle cx="17" cy="8" r="1.2" fill="#b8281c"/></g>;
  case 'rack':return <g transform={t}><ellipse cx="20" cy="36" rx="18" ry="3" fill="#0b1a14" opacity=".35"/><path d="M4 36V8M36 36V8" stroke={TIMBER} strokeWidth="3"/><path d="M2 9h36" stroke="#3b2a1b" strokeWidth="3"/>{[8,15,22,29].map((fx,i)=><g key={fx}><path d={`M${fx+2} 10v3`} stroke="#c9b48a" strokeWidth="1"/><path d={`M${fx} 13h4l1 10-3 4-3-4z`} fill={i%2?'#a9b8b4':'#c6c0a6'} stroke={O} strokeWidth="1.2"/></g>)}</g>;
  case 'nets':return <g transform={t}><ellipse cx="20" cy="34" rx="18" ry="6" fill="#0b1a14" opacity=".3"/><path d="M3 32q4-14 17-14t17 14z" fill="#6b7b6a" stroke={O} strokeWidth="2"/><path d="M8 24l24 8M12 20l20 10M6 30l18-11M14 32l16-13" stroke="#9aa892" strokeWidth="1"/><circle cx="12" cy="30" r="3" fill="#d9b866" stroke={O} strokeWidth="1"/><circle cx="28" cy="27" r="3" fill="#d9b866" stroke={O} strokeWidth="1"/><path d="M34 31q6-2 4-8" stroke="#c9b48a" strokeWidth="1.5" fill="none"/></g>;
  case 'barrels':return <g transform={t}><ellipse cx="20" cy="36" rx="17" ry="4" fill="#0b1a14" opacity=".35"/><Barrel x={4} y={14}/><Barrel x={20} y={16}/><Crate x={12} y={0} s={14}/></g>;
  case 'bench':return <g transform={t}><ellipse cx="20" cy="32" rx="17" ry="3" fill="#0b1a14" opacity=".35"/><rect x="4" y="18" width="32" height="5" fill="#8a5f38" stroke={O} strokeWidth="2"/><rect x="4" y="10" width="32" height="4" fill="#8a5f38" stroke={O} strokeWidth="2"/><path d="M7 23v8M33 23v8M7 14v4M33 14v4" stroke="#3b2a1b" strokeWidth="3"/></g>;
  case 'bush':return <g transform={t}><ellipse cx="20" cy="34" rx="15" ry="4" fill="#0b1a14" opacity=".35"/><circle cx="14" cy="26" r="9" fill="#46703a" stroke={O} strokeWidth="2"/><circle cx="26" cy="26" r="9" fill="#46703a" stroke={O} strokeWidth="2"/><circle cx="20" cy="22" r="10" fill="#4f7a3e" stroke={O} strokeWidth="2"/><circle cx="17" cy="19" r="3" fill="#6f9a52"/>{seed%2?<><circle cx="24" cy="24" r="1.6" fill="#f3e3a0"/><circle cx="14" cy="27" r="1.6" fill="#f3e3a0"/></>:null}</g>;
 }
}
/** Hand-placed props for Harbor Square; other districts get a hashed selection from a shared candidate list. */
const centerProps:[PropKind,number,number][]=[
 ['rack',3,3],['nets',3,10],['barrels',4,12],['tree',4,0],['tree',9,0],['tree',17,0],['tree',22,6],['tree',3,14],['tree',22,14],['tree',16,15],
 ['well',10,6],['lamp',7,6],['lamp',14,6],['lamp',11,9],['lamp',19,7],['lamp',9,14],['lamp',14,12],['pillar',21,7],['bench',16,6],['bush',10,12],['bush',23,10],['bush',5,15],['tree',17,3],
];
const outerSpots:[number,number][]=[[2,2],[5,2],[16,2],[18,3],[22,2],[3,6],[6,7],[10,7],[15,6],[18,7],[22,7],[3,10],[5,11],[9,10],[15,10],[17,12],[22,11],[4,14],[10,14],[16,14],[22,14],[6,1],[18,10],[9,3]];
const outerKinds:PropKind[]=['tree','tree','lamp','bush','barrels','tree','bench','well','pillar','bush','tree','lamp'];
export function propsFor(district:DistrictId):{kind:PropKind;x:number;y:number}[]{
 if(district==='center')return centerProps.map(([kind,x,y])=>({kind,x,y}));
 return outerSpots.filter((_,i)=>townHash(district,i,'keep')%3!==0).map(([x,y],i)=>({kind:outerKinds[townHash(district,x,y)%outerKinds.length],x,y,i})).filter((p,i,a)=>p.kind!=='well'||a.findIndex(q=>q.kind==='well')===i);
}
/** Props on free ground. `free(x,y)` decides whether a tile may show one (not a road, building, plot or post). */
export function TownProps({district,cell,free}:{district:DistrictId;cell:number;free:(x:number,y:number)=>boolean}){
 return <g className="tw-props" aria-hidden="true" pointerEvents="none">{propsFor(district).filter(p=>free(p.x,p.y)).map(p=><Prop key={`${p.kind}-${p.x}-${p.y}`} kind={p.kind} x={p.x*cell} y={p.y*cell} seed={townHash(p.x,p.y,district)}/>)}</g>;
}
