import React,{useEffect,useRef,useState} from 'react';
import {CharacterSprite} from './CharacterSprite';
import type {DistrictId} from '../../../packages/game/src/town-districts';
import './town-presence.css';

/** Other players in your district, plus district chat. Social only: nothing here touches the economy. */
export type Facing='up'|'down'|'left'|'right';
export type PresencePlayer={id:string;district:DistrictId|null;x:number;y:number;facing:Facing};
export type ChatMessage={id:string;from:string;text:string;at:number};
export type Here={district:DistrictId;x:number;y:number;facing:Facing}|null;

const MOVE_EVERY_MS=80,HEARTBEAT_MS=5_000;
export {playerLabel} from './presence-names';
import {playerLabel} from './presence-names';
const hue=(id:string)=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return 60+h%240;};

async function post(path:string,body:unknown){
 const r=await fetch('/api/presence/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw Error((await r.json().catch(()=>({}))).error??'Presence request failed');
 return r.json();
}

export function useTownPresence(here:Here){
 const [you,setYou]=useState<string>();const [others,setOthers]=useState<Record<string,PresencePlayer>>({});const [chat,setChat]=useState<ChatMessage[]>([]);const [online,setOnline]=useState(false);
 const latest=useRef(here);latest.current=here;const lastSent=useRef(0);const pending=useRef<ReturnType<typeof setTimeout>>(undefined);const ready=useRef(false);
 const flush=()=>{pending.current=undefined;if(!ready.current)return;lastSent.current=Date.now();const h=latest.current;void post('move',h??{district:null,x:0,y:0,facing:'down'}).catch(()=>{});};
 const schedule=()=>{if(pending.current)return;const wait=Math.max(0,MOVE_EVERY_MS-(Date.now()-lastSent.current));pending.current=setTimeout(flush,wait);};
 useEffect(()=>{
  const source=new EventSource('/api/presence/stream');
  const on=(name:string,fn:(data:any)=>void)=>source.addEventListener(name,e=>fn(JSON.parse((e as MessageEvent).data)));
  // A (re)connect resets server state; resend where we stand right away.
  on('hello',d=>{setYou(d.you);setOnline(true);setOthers({});ready.current=true;clearTimeout(pending.current);flush();});
  on('snapshot',d=>{if(d.district!==latest.current?.district)return;setOthers(Object.fromEntries(d.players.map((p:PresencePlayer)=>[p.id,p])));setChat(d.chat);});
  const upsert=(d:{player:PresencePlayer})=>{if(d.player.district===latest.current?.district)setOthers(o=>({...o,[d.player.id]:d.player}));};
  on('join',upsert);on('move',upsert);
  on('leave',d=>setOthers(o=>{const {[d.id]:_,...rest}=o;return rest;}));
  on('chat',m=>setChat(c=>[...c,m].slice(-40)));
  source.onerror=()=>{setOnline(false);ready.current=false;};
  const beat=setInterval(()=>{if(ready.current)flush();},HEARTBEAT_MS);
  return()=>{source.close();clearInterval(beat);clearTimeout(pending.current);ready.current=false;};
 },[]);
 useEffect(()=>{schedule();},[here?.district,here?.x,here?.y,here?.facing,here===null]);
 // Leaving a district clears its crowd and chat immediately; the snapshot refills them.
 useEffect(()=>{setOthers({});setChat([]);},[here?.district,here===null]);
 const say=async(text:string)=>{await post('chat',{text});};
 return {you,others:Object.values(others),chat,online,say};
}

function OtherAvatar({player,cell}:{player:PresencePlayer;cell:number}){
 const prev=useRef(player);const jump=Math.abs(prev.current.x-player.x)+Math.abs(prev.current.y-player.y)>2;useEffect(()=>{prev.current=player;});
 const x=player.x*cell+cell/2,y=player.y*cell+cell/2;
 return <g className={`presence-avatar ${jump?'jump':''}`} style={{transform:`translate(${x}px, ${y}px)`}} data-player={player.id}>
  <g style={{filter:`hue-rotate(${hue(player.id)}deg) saturate(1.3)`}}><g style={{transform:player.facing==='left'?'scaleX(-1)':undefined}}><CharacterSprite x={-22} y={-22} width={44} height={46}/></g></g>
  <text className="presence-name" y={-26} textAnchor="middle">{playerLabel(player.id)}</text>
 </g>;
}

/** Renders inside the town SVG, beneath your own avatar. */
export function PresenceAvatars({players,cell}:{players:PresencePlayer[];cell:number}){
 return <g className="presence-layer" aria-hidden="true">{players.map(p=><OtherAvatar key={p.id} player={p} cell={cell}/>)}</g>;
}

/** Small district chat overlay. Typing here never moves the character; Escape returns to the map, Enter on the map opens chat. */
export function TownChat({presence,districtName,field,disabled,onPlayer}:{presence:ReturnType<typeof useTownPresence>;districtName:string;field:React.RefObject<HTMLDivElement|null>;disabled:boolean;onPlayer?:(id:string)=>void}){
 const [draft,setDraft]=useState('');const [error,setError]=useState('');const [open,setOpen]=useState(()=>typeof matchMedia!=='function'||matchMedia('(min-width: 700px)').matches);const input=useRef<HTMLInputElement>(null);const log=useRef<HTMLOListElement>(null);
 useEffect(()=>{const el=field.current;if(!el)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Enter'&&e.target===el&&!disabled){e.preventDefault();setOpen(true);setTimeout(()=>input.current?.focus(),0);}};el.addEventListener('keydown',onKey);return()=>el.removeEventListener('keydown',onKey);},[field,disabled]);
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight});},[presence.chat.length,open]);
 const send=async()=>{const text=draft.trim();if(!text)return;try{await presence.say(text);setDraft('');setError('');}catch(e){setError((e as Error).message);}};
 const count=presence.others.length;
 return <div className={`town-chat ${open?'open':''}`} onClick={e=>e.stopPropagation()}>
  <button className="town-chat-head" onClick={()=>setOpen(!open)} aria-expanded={open} title={presence.others.map(p=>playerLabel(p.id)).join(', ')||undefined}>
   <span className={`presence-dot ${presence.online?'on':''}`} aria-hidden="true"/>{presence.online?(count?`${count} other${count===1?'':'s'} in ${districtName}`:`Alone in ${districtName}`):'Reconnecting…'}
  </button>
  {open&&<>
   <ol className="town-chat-log" ref={log} aria-live="polite" aria-label={`${districtName} chat`}>
    {presence.chat.map(m=><li key={m.id} className={m.from===presence.you?'mine':''}>{onPlayer&&m.from!==presence.you&&presence.others.some(o=>o.id===m.from)?<button className="chat-name" onClick={()=>onPlayer(m.from)} title="Trade">{playerLabel(m.from)}</button>:<b>{playerLabel(m.from)}</b>} {m.text}</li>)}
    {!presence.chat.length&&<li className="empty">Press Enter to talk to anyone nearby. Click a player to trade.</li>}
   </ol>
   <form className="town-chat-send" onSubmit={e=>{e.preventDefault();void send();}}>
    <input ref={input} value={draft} maxLength={160} disabled={disabled||!presence.online} placeholder={`Say something in ${districtName}`} aria-label="Chat message" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();field.current?.focus({preventScroll:true});}}}/>
    <button type="submit" disabled={disabled||!presence.online||!draft.trim()}>Say</button>
   </form>
   {error&&<p className="town-chat-error" role="alert">{error}</p>}
  </>}
 </div>;
}
