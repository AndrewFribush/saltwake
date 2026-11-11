import {useSyncExternalStore} from 'react';
/** Per-browser chat safety: mute (hide someone's messages), block (also hide their avatar and refuse trades with them),
 * and an optional word filter. Client-side only; reporting is a separate server call. */
export type Safety={muted:string[];blocked:string[];filter:boolean};
const KEY='saltwake.chat-safety.v1';
const read=():Safety=>{try{const v=JSON.parse(localStorage.getItem(KEY)??'null');if(v&&Array.isArray(v.muted)&&Array.isArray(v.blocked))return {muted:v.muted.slice(0,200),blocked:v.blocked.slice(0,200),filter:v.filter!==false};}catch{}return {muted:[],blocked:[],filter:true};};
let state=typeof localStorage==='undefined'?{muted:[],blocked:[],filter:true}:read();const listeners=new Set<()=>void>();
const set=(next:Safety)=>{state=next;try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}listeners.forEach(l=>l());};
export const safety={
 mute:(id:string)=>set({...state,muted:[...new Set([...state.muted,id])]}),
 unmute:(id:string)=>set({...state,muted:state.muted.filter(x=>x!==id),blocked:state.blocked.filter(x=>x!==id)}),
 block:(id:string)=>set({...state,blocked:[...new Set([...state.blocked,id])],muted:[...new Set([...state.muted,id])]}),
 setFilter:(on:boolean)=>set({...state,filter:on}),
};
export function useSafety(){return useSyncExternalStore(l=>{listeners.add(l);return()=>{listeners.delete(l);};},()=>state,()=>state);}
export const hidden=(s:Safety,id:string)=>s.muted.includes(id)||s.blocked.includes(id);
// A short, editable list; whole words only, case-insensitive. Shown as dots, never sent anywhere.
const WORDS=['damn','hell','crap','idiot','stupid','moron','bastard','bitch','shit','fuck','asshole','dick','piss','slut','whore','retard'];
const pattern=new RegExp(`\\b(${WORDS.join('|')})(s|es|ed|ing)?\\b`,'gi');
export const filtered=(text:string,on:boolean)=>on?text.replace(pattern,w=>'•'.repeat(Math.min(6,w.length))):text;
