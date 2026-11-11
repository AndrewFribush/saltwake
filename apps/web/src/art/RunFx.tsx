/** Presentation-only actor layer for the dungeon board: smooth movement, facing, lunges,
 * hit flashes, damage numbers, death puffs, blast particles and a sparing screen shake.
 * It reads RunState snapshots and never changes game state. */
import React,{useEffect,useRef,useState} from 'react';
import type {RunState,Enemy} from '../../../../packages/game/src/state';
import {doorOpen,signalValue} from '../../../../packages/shared/src/mechanisms';
import {emit} from './Sound';
import {heroFrame,Sprite,useMoving,walkFrame,type Facing} from './Sprite';
import {lookUrl,useMyLook} from './Looks';
import {tintedSprite,type SpriteName} from './sprites';

export const enemySprite=(e:Enemy):SpriteName=>e.minion?'rat':e.kind==='charger'?'boar':e.kind==='archer'?'sentry':e.kind==='bomber'?'crab':e.kind==='brute'?'brute':e.kind==='nest'?'nest':'rat';

type Pt={x:number;y:number};
type Floater={id:number;x:number;y:number;text:string;tone:'hurt'|'heal'|'hit'|'loot'};
type Slam={id:number;x:number;y:number;shut:boolean};
type Ghost={id:number;x:number;y:number;sprite:SpriteName;flip:boolean;minion:boolean};
type Snap={room:number;turn:number;hp:number;pos:Pt;enemies:Map<string,Enemy>;bag:number;doors:Map<string,boolean>};
let seq=0;
const bagCount=(s:RunState)=>Object.values(s.items).filter(i=>i.location.kind!=='floor').length+Object.values(s.supplies??{}).reduce((n,v)=>n+(v??0),0);
const snap=(s:RunState):Snap=>({room:s.roomIndex,turn:s.turn,hp:s.player.hp,pos:{x:s.player.x,y:s.player.y},enemies:new Map(s.enemies.map(e=>[e.id,{...e}])),bag:bagCount(s),doors:new Map((s.devices??[]).filter(d=>d.kind==='door').map(d=>[d.id,doorOpen(d,s.signals??{})]))});
const adj=(a:Pt,b:Pt)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;
const dirTo=(a:Pt,b:Pt):Facing=>{const dx=b.x-a.x,dy=b.y-a.y;return Math.abs(dx)>=Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');};
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

export type RunFx={slams:Slam[];enemyMoved:Set<string>;floaters:Floater[];ghosts:Ghost[];shake:number;playerFacing:Facing;playerLunge:Pt|null;playerHit:boolean;enemyLunge:Map<string,Pt>;enemyHit:Set<string>;enemyFlip:Map<string,boolean>;maxHp:Map<string,number>};

/** Diff consecutive states into short-lived visual events. */
export function useRunFx(s:RunState):RunFx{
 const prev=useRef<Snap|null>(null),facing=useRef<Facing>('down'),flips=useRef(new Map<string,boolean>()),maxHp=useRef(new Map<string,number>());
 const [slams,setSlams]=useState<Slam[]>([]),[floaters,setFloaters]=useState<Floater[]>([]),[ghosts,setGhosts]=useState<Ghost[]>([]),[shake,setShake]=useState(0);
 const [events,setEvents]=useState<{turn:number;playerLunge:Pt|null;playerHit:boolean;enemyLunge:Map<string,Pt>;enemyHit:Set<string>;enemyMoved:Set<string>}>({turn:-1,playerLunge:null,playerHit:false,enemyLunge:new Map(),enemyHit:new Set(),enemyMoved:new Set()});
 for(const e of s.enemies)if(!maxHp.current.has(e.id)||maxHp.current.get(e.id)!<e.hp)maxHp.current.set(e.id,e.hp);
 useEffect(()=>{
  const p=prev.current,now=snap(s);prev.current=now;
  if(!p||p.room!==now.room||now.turn<p.turn){if(p&&p.room!==now.room){setGhosts([]);setFloaters([]);}return;}
  if(now.turn===p.turn&&now.hp===p.hp)return;
  const add:Floater[]=[],dead:Ghost[]=[],enemyHit=new Set<string>(),enemyMoved=new Set<string>(),enemyLunge=new Map<string,Pt>();let playerLunge:Pt|null=null;
  const moved=now.pos.x!==p.pos.x||now.pos.y!==p.pos.y;
  if(moved)facing.current=dirTo(p.pos,now.pos);
  for(const [id,old] of p.enemies){
   const cur=now.enemies.get(id);
   const lost=old.hp-(cur?.hp??0);
   if(lost>0){add.push({id:++seq,x:old.x,y:old.y,text:`−${Math.min(lost,old.hp)}`,tone:'hit'});enemyHit.add(id);
    if(!moved&&adj(now.pos,old)&&!playerLunge){playerLunge={x:old.x-now.pos.x,y:old.y-now.pos.y};facing.current=dirTo(now.pos,old);}}
   if(!cur||cur.hp<=0)dead.push({id:++seq,x:old.x,y:old.y,sprite:enemySprite(old),flip:flips.current.get(id)??old.x>now.pos.x,minion:!!old.minion});
   if(cur){if(cur.x!==old.x)flips.current.set(id,cur.x<old.x);if(cur.x!==old.x||cur.y!==old.y)enemyMoved.add(id);}
  }
  const hurt=p.hp-now.hp;
  if(hurt>0){add.push({id:++seq,x:now.pos.x,y:now.pos.y,text:`−${hurt}`,tone:'hurt'});
   for(const e of s.enemies){const old=p.enemies.get(e.id);if(old&&old.x===e.x&&old.y===e.y&&adj(e,now.pos)&&!e.stunned){enemyLunge.set(e.id,{x:now.pos.x-e.x,y:now.pos.y-e.y});break;}}
   if((hurt>=3||(s.blasts?.length??0)>0)&&!reduced())setShake(n=>n+1);}
  else if(hurt<0)add.push({id:++seq,x:now.pos.x,y:now.pos.y,text:`+${-hurt}`,tone:'heal'});
  const doorFx:Slam[]=[];for(const d of s.devices??[])if(d.kind==='door'&&p.doors.has(d.id)&&p.doors.get(d.id)!==now.doors.get(d.id))doorFx.push({id:++seq,x:d.x,y:d.y,shut:!now.doors.get(d.id)});
  if(doorFx.length){setSlams(v=>[...v,...doorFx]);const ids=new Set(doorFx.map(a=>a.id));setTimeout(()=>setSlams(v=>v.filter(x=>!ids.has(x.id))),700);if(doorFx.some(d=>d.shut)&&!reduced())setShake(n=>n+1);}
  if(now.bag>p.bag)add.push({id:++seq,x:now.pos.x,y:now.pos.y,text:'✦',tone:'loot'});
  if((s.blasts?.length??0)>2&&hurt<=0&&!reduced())setShake(n=>n+1);
  if(enemyHit.size)emit('hit');if(dead.length)emit('death');if(hurt>0)emit('hurt');if((s.blasts?.length??0)>0)emit('blast');
  if(doorFx.some(d=>d.shut))emit('slam');else if(doorFx.length)emit('door');
  if(s.tide){const left=s.tide.turns-(s.tideTurns??0);if(left===3||left<=0)emit('tide');}
  setEvents({turn:now.turn,playerLunge,playerHit:hurt>0,enemyLunge,enemyHit,enemyMoved});
  if(add.length){setFloaters(f=>[...f.slice(-8),...add]);const ids=new Set(add.map(a=>a.id));setTimeout(()=>setFloaters(f=>f.filter(x=>!ids.has(x.id))),950);}
  if(dead.length){setGhosts(g=>[...g,...dead]);const ids=new Set(dead.map(a=>a.id));setTimeout(()=>setGhosts(g=>g.filter(x=>!ids.has(x.id))),650);}
 },[s]);
 const fresh=events.turn===s.turn;
 return {slams,enemyMoved:fresh?events.enemyMoved:new Set(),floaters,ghosts,shake,playerFacing:facing.current,playerLunge:fresh?events.playerLunge:null,playerHit:fresh&&events.playerHit,enemyLunge:fresh?events.enemyLunge:new Map(),enemyHit:fresh?events.enemyHit:new Set(),enemyFlip:flips.current,maxHp:maxHp.current};
}

const at=(p:Pt,v:{x:number;y:number;columns:number;rows:number}):React.CSSProperties=>({left:`${(p.x-v.x)/v.columns*100}%`,top:`${(p.y-v.y)/v.rows*100}%`,width:`${100/v.columns}%`,height:`${100/v.rows}%`});

function Pips({hp,max}:{hp:number;max:number}){
 if(max>8)return <span className="hp-bar"><i style={{width:`${Math.max(0,hp)/max*100}%`}}/></span>;
 return <span className="hp-pips">{Array.from({length:max},(_,i)=><i key={i} className={i<hp?'on':''}/>)}</span>;
}

export function ActorLayer({s,fx,visible,viewport,danger,ended,dangerSet=new Set()}:{s:RunState;fx:RunFx;visible:Set<string>;viewport:{x:number;y:number;columns:number;rows:number};danger:boolean;ended:boolean;dangerSet?:Set<string>}){
 const enemies=s.enemies.filter(e=>e.hp>0&&visible.has(`${e.x},${e.y}`));
 const [hero,heroFlip]=heroFrame(fx.playerFacing);
 const walking=useMoving(s.player.x,s.player.y);const look=useMyLook();
 const lungeStyle=(l:Pt|null|undefined)=>l?{'--lx':`${l.x*38}%`,'--ly':`${l.y*38}%`} as React.CSSProperties:undefined;
 return <><ArenaLayer s={s}/><OffscreenLayer s={s} visible={visible} viewport={viewport} danger={dangerSet}/><WireLayer s={s} viewport={viewport}/><EntryCeremony key={`entry-${s.roomIndex}`} roomIndex={s.roomIndex} turn={s.turn} title="The doors open"/><div className={`actor-layer ${s.status==='active'&&s.player.hp<=3?'low-hp':''}`} aria-hidden="true" key={`${viewport.x},${viewport.y},${s.roomIndex}`}>
  {(s.blasts??[]).filter(b=>b.x>=viewport.x&&b.y>=viewport.y).map((b,i)=><span key={`b${s.turn}-${b.x},${b.y}`} className="fx-blast" style={{...at(b,viewport),animationDelay:`${(i%5)*25}ms`}}>{Array.from({length:6},(_,k)=><i key={k} style={{'--a':`${k*60+(i*23)%60}deg`} as React.CSSProperties}/>)}</span>)}
  {fx.ghosts.map(g=><span key={g.id} className={`actor ghost ${g.minion?'minion':''}`} style={at(g,viewport)}><Sprite name={g.sprite} flip={g.flip} className="actor-sprite"/><span className="fx-puff"><i/><i/><i/><i/></span></span>)}
  {enemies.map(e=>{const flip=fx.enemyFlip.get(e.id)??(e.x>s.player.x),max=fx.maxHp.get(e.id)??e.hp,lunge=fx.enemyLunge.get(e.id),hit=fx.enemyHit.has(e.id);
   const unaware=!!s.roguelike&&e.alerted===false;
   return <span key={e.id} className={`actor enemy-actor k-${enemySprite(e)} ${e.minion?'minion':''} ${e.primed?'primed':''} ${e.aim?'aiming':''} ${e.stunned?'stunned':''} ${e.recovering?'recovering':''} ${unaware?'unaware':''}`} style={at(e,viewport)}>
    <span key={`${e.id}-${s.turn}`} className={`actor-body ${lunge?'lunge':''} ${hit?'hit':''} ${fx.enemyMoved.has(e.id)?'hop':''}`} style={lungeStyle(lunge)}><Sprite name={enemySprite(e)} flip={flip} className="actor-sprite"/></span>
    {unaware&&<span className="actor-bubble">z</span>}
    <Pips hp={e.hp} max={max}/>
   </span>;})}
  <span className={`actor hero-actor ${walking?'walking':''} ${s.status==='died'?'fallen':''} ${danger?'in-danger':''}`} style={at(s.player,viewport)}>
   <span key={`p-${s.turn}`} className={`actor-body ${fx.playerLunge?'lunge':''} ${fx.playerHit?'hit':''}`} style={lungeStyle(fx.playerLunge)}><span aria-hidden="true" className="px-sprite actor-sprite frame-a" style={{backgroundImage:lookUrl(hero,heroFlip,look)}}/><span aria-hidden="true" className="px-sprite actor-sprite frame-b" style={{backgroundImage:lookUrl(walkFrame(hero),heroFlip,look)}}/></span>
   {danger&&!ended&&<span className="danger-badge">!</span>}
  </span>
  {!!s.keys?.length&&<span className="key-ring" title={`Keys: ${s.keys.join(', ')}`}>{s.keys.map((k,i)=><span key={i} className="px-sprite key-chip" style={{backgroundImage:tintedSprite('key',k)}}/>)}</span>}
  {fx.slams.map(d=><span key={d.id} className={`fx-door ${d.shut?'shut':'open'}`} style={at(d,viewport)}><i/><i/><i/><i/><i/></span>)}
  {fx.floaters.map(f=><span key={f.id} className={`fx-float tone-${f.tone}`} style={at(f,viewport)}>{f.text}</span>)}
 </div></>;
}

/** Dungeon entry: great doors swing apart at the start of a run; later floors fade in with a floor banner. */
export function EntryCeremony({roomIndex,turn,title}:{roomIndex:number;turn:number;title:string}){
 const [show,setShow]=useState(()=>turn===0||roomIndex>0);
 useEffect(()=>{emit(roomIndex===0&&turn===0?'open':'door');if(reduced()){setShow(false);return;}const t=setTimeout(()=>setShow(false),roomIndex===0?1400:1000);return()=>clearTimeout(t);},[]);
 if(!show)return null;
 return <div className={`entry-ceremony ${roomIndex===0&&turn===0?'doors':'descend'}`} aria-hidden="true">
  {roomIndex===0&&turn===0&&<><span className="entry-door left"/><span className="entry-door right"/></>}
  <span className="entry-title">{roomIndex===0&&turn===0?title:`Floor ${roomIndex+1}`}</span>
 </div>;
}

/** Faint wire from each seen switch or pressure plate to the gates (and nothing else) on its channel. */
export function WireLayer({s,viewport}:{s:RunState;viewport:{x:number;y:number;columns:number;rows:number}}){
 const seen=(p:{x:number;y:number})=>!s.roguelike||!!s.explored?.includes(`${s.roomIndex}:${p.x},${p.y}`);
 const inputs=[...(s.devices??[]).filter(d=>d.kind==='switch').map(d=>({x:d.x,y:d.y,channel:d.channel})),...(s.features??[]).filter(f=>f.kind==='plate'&&!f.spent).map(f=>({x:f.x,y:f.y,channel:(f as any).channel as string}))].filter(seen);
 const gates=(s.devices??[]).filter(d=>d.kind==='door').filter(seen);
 const lines=inputs.flatMap(a=>gates.filter(g=>g.channel===a.channel).map(g=>({a,g,on:signalValue(s.signals,a.channel),open:doorOpen(g,s.signals??{})})));
 if(!lines.length)return null;
 const cx=(x:number)=>x-viewport.x+.5,cy=(y:number)=>y-viewport.y+.5;
 return <svg className="wire-layer" aria-hidden="true" viewBox={`0 0 ${viewport.columns} ${viewport.rows}`} preserveAspectRatio="none">
  {lines.map((l,i)=><g key={i} className={`wire ${l.on?'on':''}`}><path className="wire-bg" d={`M${cx(l.a.x)} ${cy(l.a.y)} L${cx(l.g.x)} ${cy(l.a.y)} L${cx(l.g.x)} ${cy(l.g.y)}`}/><path d={`M${cx(l.a.x)} ${cy(l.a.y)} L${cx(l.g.x)} ${cy(l.a.y)} L${cx(l.g.x)} ${cy(l.g.y)}`}/><circle cx={cx(l.a.x)} cy={cy(l.a.y)} r=".09"/><circle cx={cx(l.g.x)} cy={cy(l.g.y)} r=".09"/></g>)}
 </svg>;
}

/** Sealed arena (every way out needs the room cleared): iron frame while foes remain, a short banner on arrival and when cleared. */
export function ArenaLayer({s}:{s:RunState}){
 const sealed=s.status==='active'&&!!s.exitRule?.require_clear&&(s.connections??[]).every(c=>c.require_clear);
 const foes=s.enemies.filter(e=>e.hp>0).length;
 const [banner,setBanner]=useState<string|null>(null);const was=useRef<{room:number;foes:number}|null>(null);
 useEffect(()=>{const w=was.current;was.current={room:s.roomIndex,foes};if(!sealed)return;
  let text:string|null=null;
  if(!w||w.room!==s.roomIndex){if(foes)text='Sealed arena · defeat every foe to leave';}
  else if(w.foes>0&&foes===0){text='Arena cleared · the way out opens';emit('open');}
  if(!text)return;setBanner(text);const t=setTimeout(()=>setBanner(null),2600);return()=>clearTimeout(t);},[s.roomIndex,foes,sealed]);
 if(!sealed)return null;
 return <div className={`arena-layer ${foes?'locked':'cleared'}`} aria-hidden="true">{banner&&<span key={banner} className="arena-banner">{banner}</span>}</div>;
}

/** Large floors: arrows on the board edge for seen enemies and danger outside the camera, and a small map of explored ground. */
export function OffscreenLayer({s,visible,viewport,danger}:{s:RunState;visible:Set<string>;viewport:{x:number;y:number;columns:number;rows:number};danger:Set<string>}){
 const W=s.room[0]?.length??0,H=s.room.length,big=W>viewport.columns||H>viewport.rows;if(!big)return null;
 const inView=(p:Pt)=>p.x>=viewport.x&&p.x<viewport.x+viewport.columns&&p.y>=viewport.y&&p.y<viewport.y+viewport.rows;
 const off=s.enemies.filter(e=>e.hp>0&&visible.has(`${e.x},${e.y}`)&&!inView(e));
 const hot=new Set(off.filter(e=>[...danger].some(k=>{const [x,y]=k.split(',').map(Number);return !inView({x,y})&&Math.abs(x-e.x)+Math.abs(y-e.y)<=6;})).map(e=>e.id));
 const pin=(p:Pt)=>{const cx=Math.min(Math.max(p.x-viewport.x+.5,.35),viewport.columns-.35)/viewport.columns*100,cy=Math.min(Math.max(p.y-viewport.y+.5,.35),viewport.rows-.35)/viewport.rows*100;
  const ang=Math.atan2(p.y-(s.player.y),p.x-(s.player.x))*180/Math.PI;return {left:`${cx}%`,top:`${cy}%`,'--ang':`${ang}deg`} as React.CSSProperties;};
 const explored=new Set((s.explored??[]).filter(k=>k.startsWith(`${s.roomIndex}:`)).map(k=>k.slice(k.indexOf(':')+1)));const all=!s.roguelike;
 const cells:React.ReactNode[]=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=`${x},${y}`;if(!all&&!explored.has(k))continue;cells.push(<rect key={k} x={x} y={y} width="1" height="1" className={s.room[y][x]==='#'?'w':'f'}/>);}
 return <>
  {off.map(e=><span key={e.id} className={`offscreen ${hot.has(e.id)?'hot':''}`} style={pin(e)} title="Enemy out of view"><i/></span>)}
  <svg className="minimap" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">{cells}<rect className="cam" x={viewport.x} y={viewport.y} width={viewport.columns} height={viewport.rows}/>{off.map(e=><rect key={e.id} className="foe" x={e.x} y={e.y} width="1" height="1"/>)}<rect className="you" x={s.player.x} y={s.player.y} width="1" height="1"/></svg>
 </>;
}
