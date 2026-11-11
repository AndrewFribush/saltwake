import React,{useEffect,useRef,useState} from 'react';
import {CharacterSprite} from './CharacterSprite';
import {playerLabel,setRoomPresence,useRoomPresence} from './TownPresence';
import {useSafety,hidden,filtered} from './chat-safety';
import type {TownPoint} from '../../../packages/game/src/town';
import type {DistrictId} from '../../../packages/game/src/town-districts';
/** Visitors inside the same player building see each other: the room is contract state, so it is the same room for everyone. */
export function useSharedRoom(room:string,district:DistrictId){
 const state=useRoomPresence();const blocked=useSafety().blocked;
 useEffect(()=>()=>setRoomPresence(null),[room]);
 const onPosition=(p:TownPoint)=>setRoomPresence({district,room,x:p.x,y:p.y,facing:'down'});
 const overlay=({x,y}:{x:number;y:number})=>{const here=state.others.filter(o=>o.room===room&&o.x===x&&o.y===y&&!blocked.includes(o.id));return here.length?<span className="room-visitor" title={here.map(o=>playerLabel(o.id)).join(', ')}><CharacterSprite/><small>{playerLabel(here[0].id)}</small></span>:null;};
 return {overlay,onPosition,state};
}
export function RoomChat({room}:{room:string}){
 const state=useRoomPresence();const safe=useSafety();const [draft,setDraft]=useState('');const [error,setError]=useState('');const log=useRef<HTMLOListElement>(null);
 const others=state.others.filter(o=>o.room===room);
 useEffect(()=>{log.current?.scrollTo({top:log.current.scrollHeight});},[state.chat.length]);
 const send=async()=>{const text=draft.trim();if(!text||!state.say)return;try{await state.say(text);setDraft('');setError('');}catch(e){setError((e as Error).message);}};
 return <div className="room-chat" aria-label="Room chat"><p>{others.length?`${others.length} other visitor${others.length===1?'':'s'} here: ${others.map(o=>playerLabel(o.id)).join(', ')}`:'No other visitors right now.'}</p>
  <ol ref={log} aria-live="polite">{state.chat.filter(m=>m.from===state.you||!hidden(safe,m.from)).map(m=><li key={m.id}><b>{m.from===state.you?'You':playerLabel(m.from)}</b> {filtered(m.text,safe.filter)}</li>)}</ol>
  <form onSubmit={e=>{e.preventDefault();void send();}}><input aria-label="Say something in this room" maxLength={160} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.stopPropagation()}/><button type="submit" disabled={!draft.trim()||!state.say}>Say</button></form>{error&&<p role="alert">{error}</p>}</div>;
}
