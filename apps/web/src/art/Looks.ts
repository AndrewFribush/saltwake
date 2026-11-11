/** Cosmetic hero looks: palette swaps of cloak (y/Y) and hair (h/H). Purely visual; stored per browser and per
 * character, and shared with other players through presence as a small id with no authority. */
import {useSyncExternalStore} from 'react';
import {dataUrl,pixelSvg,P,type Palette} from './pixel';
import {spriteMaps,type SpriteName} from './sprites';

export const looks:{name:string;cloak:[string,string];hair:[string,string]}[]=[
 {name:'Harbor gold',cloak:['#d9b45a','#9e7a34'],hair:['#6e4a30','#4a3020']},
 {name:'Tide blue',cloak:['#5f8fc6','#3a5e8e'],hair:['#2f2822','#1b1714']},
 {name:'Kelp green',cloak:['#6fa060','#3f6a38'],hair:['#c9763a','#8e4f20']},
 {name:'Coral red',cloak:['#c9563f','#8a2e1e'],hair:['#e8d08a','#b09a56']},
 {name:'Storm grey',cloak:['#8a949a','#5a6266'],hair:['#e8e2d0','#a8a294']},
 {name:'Dusk violet',cloak:['#8a68b8','#5a3e80'],hair:['#3a2418','#22140c']},
 {name:'Rope brown',cloak:['#a07850','#6e4e2e'],hair:['#d8b070','#9e7a40']},
 {name:'Salt white',cloak:['#e8e2d0','#a8a294'],hair:['#5a3a26','#3a2416']},
];
export const lookCount=looks.length;
const valid=(n:unknown):n is number=>Number.isInteger(n)&&(n as number)>=0&&(n as number)<looks.length;

const key=(profile:string)=>`saltwake.look.${profile||'default'}`;
let profile='',current=0;const listeners=new Set<()=>void>();
function read(p:string){try{const n=Number(localStorage.getItem(key(p)));return valid(n)?n:0;}catch{return 0;}}
/** Called by the HUD observer when the active character changes. */
export function setLookProfile(p:string){if(p===profile)return;profile=p;current=read(p);listeners.forEach(f=>f());}
export function setMyLook(n:number){if(!valid(n))return;current=n;try{localStorage.setItem(key(profile),String(n));}catch{}listeners.forEach(f=>f());}
export function myLook(){return current;}
export function useMyLook(){return useSyncExternalStore(f=>{listeners.add(f);return()=>{listeners.delete(f);};},()=>current);}
export function asLook(n:unknown):number|undefined{return valid(n)?n:undefined;}

const cache=new Map<string,string>();
/** Hero sprite URL for a look (look 0 is the default art). */
export function lookUrl(name:SpriteName,flip:boolean,look:number){
 const k=`${name}:${flip?1:0}:${look}`;let u=cache.get(k);
 if(!u){const l=looks[look]??looks[0];const pal:Palette={...P,q:'#07090b',y:l.cloak[0],Y:l.cloak[1],h:l.hair[0],H:l.hair[1]};u=dataUrl(pixelSvg(spriteMaps[name],pal,flip));cache.set(k,u);}
 return u;
}

/** Adds a small "Look" swatch button to the top bar; it opens a row of palette swatches. */
export function installLookPicker(){
 if(typeof document==='undefined')return;
 const ensure=()=>{
  const token=document.querySelector('.player-hud .character-token');
  if(token)setLookProfile((token.childNodes[0]?.textContent??token.textContent??'').trim());
  const ctl=document.querySelector('.game-shell>.player-hud .sound-ctl');if(!ctl||ctl.querySelector('.look-btn'))return;
  const btn=document.createElement('button');btn.type='button';btn.className='look-btn';btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');
  const pop=document.createElement('div');pop.className='look-pop';pop.hidden=true;pop.setAttribute('role','group');pop.setAttribute('aria-label','Character look (cosmetic)');
  const paint=()=>{const l=looks[current];btn.style.setProperty('--look',l.cloak[0]);btn.style.setProperty('--hair',l.hair[0]);btn.setAttribute('aria-label',`Character look: ${l.name}. Change look`);btn.title=`Look: ${l.name}`;
   pop.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===current)));};
  looks.forEach((l,i)=>{const b=document.createElement('button');b.type='button';b.className='look-swatch';b.style.setProperty('--look',l.cloak[0]);b.style.setProperty('--hair',l.hair[0]);b.setAttribute('aria-label',l.name);b.title=l.name;
   const img=document.createElement('span');img.className='px-sprite';img.style.backgroundImage=lookUrl('heroDown',false,i);b.appendChild(img);
   b.onclick=()=>{setMyLook(i);paint();pop.hidden=true;btn.setAttribute('aria-expanded','false');btn.focus();};pop.appendChild(b);});
  btn.onclick=()=>{pop.hidden=!pop.hidden;btn.setAttribute('aria-expanded',String(!pop.hidden));if(!pop.hidden)(pop.querySelectorAll('button')[current] as HTMLButtonElement)?.focus();};
  pop.onkeydown=e=>{if(e.key==='Escape'){pop.hidden=true;btn.setAttribute('aria-expanded','false');btn.focus();}};
  listeners.add(paint);paint();ctl.prepend(btn,pop);
 };
 let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;ensure();});}).observe(document.body,{childList:true,subtree:true,characterData:true});
}
