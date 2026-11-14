import React,{useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {myLook,useMyLook,asLook} from './art/Looks';
import {CharacterSprite} from './CharacterSprite';
import {useSafety,safety,hidden,filtered} from './chat-safety';
import {districts,type DistrictId} from '../../../packages/game/src/town-districts';
import './town-presence.css';

/** Other players in your district, plus district chat. Social only: nothing here touches the economy. */
export type Facing='up'|'down'|'left'|'right';
export type PresencePlayer={id:string;district:DistrictId|null;x:number;y:number;facing:Facing;room?:string;look?:number};
export type ChatMessage={id:string;from:string;text:string;at:number;district?:DistrictId};
export type Here={district:DistrictId;x:number;y:number;facing:Facing;room?:string}|null;
const spaceOf=(p:{district:DistrictId|null;room?:string}|null|undefined)=>p?.district?(p.room??p.district):null;
/** Shared rooms: a player building's interior publishes where you stand; the town's single presence stream carries it
 * and hands back who else is in that room. Social only, like the rest of presence. */
type RoomState={here:Here;others:PresencePlayer[];chat:ChatMessage[];say?:(text:string)=>Promise<void>;you?:string};
let roomState:RoomState={here:null,others:[],chat:[]};const roomListeners=new Set<()=>void>();
const setRoom=(next:Partial<RoomState>)=>{roomState={...roomState,...next};roomListeners.forEach(l=>l());};
const subscribeRoom=(l:()=>void)=>{roomListeners.add(l);return()=>{roomListeners.delete(l);};};
export const setRoomPresence=(here:Here)=>setRoom(here?{here}:{here:null,others:[],chat:[]});
export const setRoomCrowd=(crowd:Pick<RoomState,'others'|'chat'|'say'|'you'>)=>{if(crowd.others!==roomState.others||crowd.chat!==roomState.chat||crowd.you!==roomState.you)setRoom(crowd);};
export function useRoomPresence(){return useSyncExternalStore(subscribeRoom,()=>roomState);}

const MOVE_EVERY_MS=80,HEARTBEAT_MS=5_000;
export {playerLabel} from './presence-names';
import {playerLabel,isNpc} from './presence-names';
const hue=(id:string)=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return 60+h%240;};

async function post(path:string,body:unknown){
 const r=await fetch('/api/presence/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw Error((await r.json().catch(()=>({}))).error??'Presence request failed');
 return r.json();
}

export function useTownPresence(here:Here){
 const [rooms,setRooms]=useState<Record<string,string[]>>({});
 const [you,setYou]=useState<string>();const [others,setOthers]=useState<Record<string,PresencePlayer>>({});const [chat,setChat]=useState<ChatMessage[]>([]);const [online,setOnline]=useState(false);
 const latest=useRef(here);latest.current=here;const lastSent=useRef(0);const pending=useRef<ReturnType<typeof setTimeout>>(undefined);const ready=useRef(false);
 const flush=()=>{pending.current=undefined;if(!ready.current)return;lastSent.current=Date.now();const h=latest.current;void post('move',{...(h??{district:null,x:0,y:0,facing:'down'}),look:myLook()}).catch(()=>{});};
 const schedule=()=>{if(pending.current)return;const wait=Math.max(0,MOVE_EVERY_MS-(Date.now()-lastSent.current));pending.current=setTimeout(flush,wait);};
 useEffect(()=>{
  // EventSource retries dropped connections itself, but gives up for good on a non-200 answer (for example 401
  // after a server restart cleared sessions). Then reopen with backoff until the page has a session again.
  let source:EventSource,retry:ReturnType<typeof setTimeout>|undefined,closed=false,backoff=2000;
  const connect=()=>{if(closed)return;source=new EventSource('/api/presence/stream');
  const on=(name:string,fn:(data:any)=>void)=>source.addEventListener(name,e=>fn(JSON.parse((e as MessageEvent).data)));
  // A (re)connect resets server state; resend where we stand right away.
  on('hello',d=>{setYou(d.you);setOnline(true);setOthers({});ready.current=true;clearTimeout(pending.current);flush();});
  on('snapshot',d=>{if(spaceOf(d)!==spaceOf(latest.current))return;setOthers(Object.fromEntries(d.players.map((p:PresencePlayer)=>[p.id,p])));setChat(d.chat);});
  const upsert=(d:{player:PresencePlayer})=>{if(spaceOf(d.player)===spaceOf(latest.current))setOthers(o=>({...o,[d.player.id]:d.player}));};
  on('join',upsert);on('move',upsert);
  on('leave',d=>setOthers(o=>{const {[d.id]:_,...rest}=o;return rest;}));
  on('chat',m=>setChat(c=>[...c,m].slice(-80)));
  on('rooms',r=>setRooms(r&&typeof r==='object'?r:{}));
  on('hello',()=>{backoff=2000;});
  source.onerror=()=>{setOnline(false);ready.current=false;if(source.readyState===EventSource.CLOSED){clearTimeout(retry);retry=setTimeout(connect,backoff);backoff=Math.min(15000,backoff*2);}};
  };
  connect();
  const beat=setInterval(()=>{if(ready.current)flush();},HEARTBEAT_MS);
  return()=>{closed=true;clearTimeout(retry);source.close();clearInterval(beat);clearTimeout(pending.current);ready.current=false;};
 },[]);
 const look=useMyLook();
 useEffect(()=>{schedule();},[here?.district,here?.room,here?.x,here?.y,here?.facing,here===null,look]);
 // Leaving a district clears its crowd immediately; the snapshot refills it. Town chat is one room, so it stays
 // across districts and is only cleared when entering or leaving a building (which has its own channel).
 useEffect(()=>{setOthers({});},[here?.district,here?.room,here===null]);
 useEffect(()=>{setChat([]);},[here?.room,here===null]);
 const say=async(text:string)=>{await post('chat',{text});};
 const list=useMemo(()=>Object.values(others),[others]);
 return {you,others:list,chat,online,say,rooms};
}

function OtherAvatar({player,cell}:{player:PresencePlayer;cell:number}){
 const prev=useRef(player);const jump=Math.abs(prev.current.x-player.x)+Math.abs(prev.current.y-player.y)>2;useEffect(()=>{prev.current=player;});
 const x=player.x*cell+cell/2,y=player.y*cell+cell/2;
 return <g className={`presence-avatar ${jump?'jump':''}`} style={{transform:`translate(${x}px, ${y}px)`}} data-player={player.id}>
  <g style={asLook(player.look)===undefined?{filter:`hue-rotate(${hue(player.id)}deg) saturate(1.3)`}:undefined}><CharacterSprite x={-22} y={-25} width={44} height={46} facing={player.facing} at={player} look={asLook(player.look)??0}/></g>
  <text className={`presence-name ${isNpc(player.id)?'npc':''}`} y={-26} textAnchor="middle">{playerLabel(player.id)}</text>
 </g>;
}

/** Renders inside the town SVG, beneath your own avatar. */
export function PresenceAvatars({players,cell}:{players:PresencePlayer[];cell:number}){
 const safe=useSafety();
 return <g className="presence-layer" aria-hidden="true">{players.filter(p=>!safe.blocked.includes(p.id)).map(p=><OtherAvatar key={p.id} player={p} cell={cell}/>)}</g>;
}

const districtNames=Object.fromEntries(districts.map(d=>[d.id,d.name]));
/** Town chat: one room for everyone outdoors, like a chatroom, with the district each line was spoken in. Typing here never
 * moves the character; Escape returns to the map, Enter on the map focuses the chat. */
export function TownChat({presence,district,districtName,field,disabled,onPlayer}:{presence:ReturnType<typeof useTownPresence>;district?:DistrictId;districtName:string;field:React.RefObject<HTMLDivElement|null>;disabled:boolean;onPlayer?:(id:string)=>void}){
 const [draft,setDraft]=useState('');const [error,setError]=useState('');const [manual,setOpen]=useState<boolean|null>(null);const wide=typeof matchMedia!=='function'||matchMedia('(min-width: 700px)').matches;const input=useRef<HTMLInputElement>(null);const log=useRef<HTMLOListElement>(null);
 useEffect(()=>{const el=field.current;if(!el)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Enter'&&e.target===el&&!disabled){e.preventDefault();setOpen(true);setTimeout(()=>input.current?.focus(),0);}};el.addEventListener('keydown',onKey);return()=>el.removeEventListener('keydown',onKey);},[field,disabled]);
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight});},[presence.chat.length,manual]);
 const send=async()=>{const text=draft.trim();if(!text)return;try{await presence.say(text);setDraft('');setError('');}catch(e){setError((e as Error).message);}};
 const count=presence.others.length;const safe=useSafety();const [menu,setMenu]=useState<string>();const [manage,setManage]=useState(false);const [reported,setReported]=useState<string[]>([]);
 const shown=presence.chat.filter(m=>m.from===presence.you||!hidden(safe,m.from)),hiddenCount=presence.chat.length-shown.length;
 const report=async(m:ChatMessage)=>{try{await post('report',{messageId:m.id,from:m.from,text:m.text});setReported(r=>[...r,m.id]);}catch(e){setError((e as Error).message);}setMenu(undefined);};
 // A chatroom: open on wide screens; the head collapses it. Narrow screens open it on Enter or when someone speaks.
 const open=manual??(wide||presence.chat.length>0);const people=presence.others.filter(o=>!isNpc(o.id)).length,folk=count-people;
 return <div className={`town-chat ${open?'open':''}`} onClick={e=>e.stopPropagation()}>
  <button className="town-chat-head" onClick={()=>setOpen(!open)} aria-expanded={open} title={presence.others.map(p=>playerLabel(p.id)).join(', ')||undefined}>
   <span className={`presence-dot ${presence.online?'on':''}`} aria-hidden="true"/>{presence.online?`Town chat · ${count?`${people?`${people} player${people===1?'':'s'}`:''}${people&&folk?' and ':''}${folk?`${folk} townsfolk`:''} in ${districtName}`:`alone in ${districtName}`}`:'Reconnecting…'}
  </button>
  {open&&<>
   <ol className="town-chat-log" ref={log} aria-live="polite" aria-label="Town chat">
    {shown.map(m=><li key={m.id} className={m.from===presence.you?'mine':isNpc(m.from)?'npc':''}>{m.district&&m.district!==district&&<i className="chat-where" title={`Said in ${districtNames[m.district]??m.district}`}>{districtNames[m.district]??m.district}</i>}{onPlayer&&m.from!==presence.you&&!isNpc(m.from)&&presence.others.some(o=>o.id===m.from)&&!safe.blocked.includes(m.from)?<button className="chat-name" onClick={()=>onPlayer(m.from)} title="Trade">{playerLabel(m.from)}</button>:<b>{playerLabel(m.from)}</b>} {filtered(m.text,safe.filter)}
     {m.from!==presence.you&&<button className="chat-more" aria-label={`Options for ${playerLabel(m.from)}'s message`} aria-expanded={menu===m.id} onClick={()=>setMenu(menu===m.id?undefined:m.id)}>⋯</button>}
     {menu===m.id&&<span className="chat-menu"><button onClick={()=>{safety.mute(m.from);setMenu(undefined);}}>Mute</button><button onClick={()=>{safety.block(m.from);setMenu(undefined);}}>Block</button><button disabled={reported.includes(m.id)} onClick={()=>void report(m)}>{reported.includes(m.id)?'Reported':'Report'}</button></span>}</li>)}
    {hiddenCount>0&&<li className="empty">{hiddenCount} message{hiddenCount===1?'':'s'} from muted or blocked players hidden.</li>}
    {!presence.chat.length&&<li className="empty">Nobody has spoken yet. Press Enter and say something to the whole town. Click a player's name to trade.</li>}
   </ol>
   <div className="chat-safety"><label><input type="checkbox" checked={safe.filter} onChange={e=>safety.setFilter(e.target.checked)}/> Filter words</label>{(safe.muted.length>0||safe.blocked.length>0)&&<button className="link-button" onClick={()=>setManage(!manage)}>Muted ({safe.muted.length})</button>}</div>
   {manage&&<ul className="chat-manage">{safe.muted.map(id=><li key={id}>{playerLabel(id)}{safe.blocked.includes(id)?' (blocked)':''} <button onClick={()=>safety.unmute(id)}>Unmute</button></li>)}</ul>}
   <form className="town-chat-send" onSubmit={e=>{e.preventDefault();void send();}}>
    <input ref={input} value={draft} maxLength={160} disabled={disabled||!presence.online} placeholder="Say something to the town" aria-label="Chat message" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();field.current?.focus({preventScroll:true});}}}/>
    <button type="submit" disabled={disabled||!presence.online||!draft.trim()}>Say</button>
   </form>
   {error&&<p className="town-chat-error" role="alert">{error}</p>}
  </>}
 </div>;
}
