/** Presentation-only actor layer for the dungeon board: smooth movement, facing, lunges,
 * hit flashes, damage numbers, death puffs, blast particles and a sparing screen shake.
 * It reads RunState snapshots and never changes game state. */
import React,{useEffect,useRef,useState} from 'react';
import type {RunState,Enemy} from '../../../../packages/game/src/state';
import {heroFrame,Sprite,useMoving,walkFrame,type Facing} from './Sprite';
import {tintedSprite,type SpriteName} from './sprites';

export const enemySprite=(e:Enemy):SpriteName=>e.minion?'rat':e.kind==='charger'?'boar':e.kind==='archer'?'sentry':e.kind==='bomber'?'crab':e.kind==='brute'?'brute':e.kind==='nest'?'nest':'rat';

type Pt={x:number;y:number};
type Floater={id:number;x:number;y:number;text:string;tone:'hurt'|'heal'|'hit'|'loot'};
type Ghost={id:number;x:number;y:number;sprite:SpriteName;flip:boolean;minion:boolean};
type Snap={room:number;turn:number;hp:number;pos:Pt;enemies:Map<string,Enemy>;bag:number};
let seq=0;
const bagCount=(s:RunState)=>Object.values(s.items).filter(i=>i.location.kind!=='floor').length+Object.values(s.supplies??{}).reduce((n,v)=>n+(v??0),0);
const snap=(s:RunState):Snap=>({room:s.roomIndex,turn:s.turn,hp:s.player.hp,pos:{x:s.player.x,y:s.player.y},enemies:new Map(s.enemies.map(e=>[e.id,{...e}])),bag:bagCount(s)});
const adj=(a:Pt,b:Pt)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;
const dirTo=(a:Pt,b:Pt):Facing=>{const dx=b.x-a.x,dy=b.y-a.y;return Math.abs(dx)>=Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');};
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

export type RunFx={enemyMoved:Set<string>;floaters:Floater[];ghosts:Ghost[];shake:number;playerFacing:Facing;playerLunge:Pt|null;playerHit:boolean;enemyLunge:Map<string,Pt>;enemyHit:Set<string>;enemyFlip:Map<string,boolean>;maxHp:Map<string,number>};

/** Diff consecutive states into short-lived visual events. */
export function useRunFx(s:RunState):RunFx{
 const prev=useRef<Snap|null>(null),facing=useRef<Facing>('down'),flips=useRef(new Map<string,boolean>()),maxHp=useRef(new Map<string,number>());
 const [floaters,setFloaters]=useState<Floater[]>([]),[ghosts,setGhosts]=useState<Ghost[]>([]),[shake,setShake]=useState(0);
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
  if(now.bag>p.bag)add.push({id:++seq,x:now.pos.x,y:now.pos.y,text:'✦',tone:'loot'});
  if((s.blasts?.length??0)>2&&hurt<=0&&!reduced())setShake(n=>n+1);
  setEvents({turn:now.turn,playerLunge,playerHit:hurt>0,enemyLunge,enemyHit,enemyMoved});
  if(add.length){setFloaters(f=>[...f.slice(-8),...add]);const ids=new Set(add.map(a=>a.id));setTimeout(()=>setFloaters(f=>f.filter(x=>!ids.has(x.id))),950);}
  if(dead.length){setGhosts(g=>[...g,...dead]);const ids=new Set(dead.map(a=>a.id));setTimeout(()=>setGhosts(g=>g.filter(x=>!ids.has(x.id))),650);}
 },[s]);
 const fresh=events.turn===s.turn;
 return {enemyMoved:fresh?events.enemyMoved:new Set(),floaters,ghosts,shake,playerFacing:facing.current,playerLunge:fresh?events.playerLunge:null,playerHit:fresh&&events.playerHit,enemyLunge:fresh?events.enemyLunge:new Map(),enemyHit:fresh?events.enemyHit:new Set(),enemyFlip:flips.current,maxHp:maxHp.current};
}

const at=(p:Pt,v:{x:number;y:number;columns:number;rows:number}):React.CSSProperties=>({left:`${(p.x-v.x)/v.columns*100}%`,top:`${(p.y-v.y)/v.rows*100}%`,width:`${100/v.columns}%`,height:`${100/v.rows}%`});

function Pips({hp,max}:{hp:number;max:number}){
 if(max>8)return <span className="hp-bar"><i style={{width:`${Math.max(0,hp)/max*100}%`}}/></span>;
 return <span className="hp-pips">{Array.from({length:max},(_,i)=><i key={i} className={i<hp?'on':''}/>)}</span>;
}

export function ActorLayer({s,fx,visible,viewport,danger,ended}:{s:RunState;fx:RunFx;visible:Set<string>;viewport:{x:number;y:number;columns:number;rows:number};danger:boolean;ended:boolean}){
 const enemies=s.enemies.filter(e=>e.hp>0&&visible.has(`${e.x},${e.y}`));
 const [hero,heroFlip]=heroFrame(fx.playerFacing);
 const walking=useMoving(s.player.x,s.player.y);
 const lungeStyle=(l:Pt|null|undefined)=>l?{'--lx':`${l.x*38}%`,'--ly':`${l.y*38}%`} as React.CSSProperties:undefined;
 return <><EntryCeremony key={`entry-${s.roomIndex}`} roomIndex={s.roomIndex} turn={s.turn} title="The doors open"/><div className={`actor-layer ${s.status==='active'&&s.player.hp<=3?'low-hp':''}`} aria-hidden="true" key={`${viewport.x},${viewport.y},${s.roomIndex}`}>
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
   <span key={`p-${s.turn}`} className={`actor-body ${fx.playerLunge?'lunge':''} ${fx.playerHit?'hit':''}`} style={lungeStyle(fx.playerLunge)}><Sprite name={hero} flip={heroFlip} className="actor-sprite frame-a"/><Sprite name={walkFrame(hero)} flip={heroFlip} className="actor-sprite frame-b"/></span>
   {danger&&!ended&&<span className="danger-badge">!</span>}
  </span>
  {!!s.keys?.length&&<span className="key-ring" title={`Keys: ${s.keys.join(', ')}`}>{s.keys.map((k,i)=><span key={i} className="px-sprite key-chip" style={{backgroundImage:tintedSprite('key',k)}}/>)}</span>}
  {fx.floaters.map(f=><span key={f.id} className={`fx-float tone-${f.tone}`} style={at(f,viewport)}>{f.text}</span>)}
 </div></>;
}

/** Dungeon entry: great doors swing apart at the start of a run; later floors fade in with a floor banner. */
export function EntryCeremony({roomIndex,turn,title}:{roomIndex:number;turn:number;title:string}){
 const [show,setShow]=useState(()=>turn===0||roomIndex>0);
 useEffect(()=>{if(reduced()){setShow(false);return;}const t=setTimeout(()=>setShow(false),roomIndex===0?1400:1000);return()=>clearTimeout(t);},[]);
 if(!show)return null;
 return <div className={`entry-ceremony ${roomIndex===0&&turn===0?'doors':'descend'}`} aria-hidden="true">
  {roomIndex===0&&turn===0&&<><span className="entry-door left"/><span className="entry-door right"/></>}
  <span className="entry-title">{roomIndex===0&&turn===0?title:`Floor ${roomIndex+1}`}</span>
 </div>;
}
