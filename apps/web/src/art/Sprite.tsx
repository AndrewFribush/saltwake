import React,{useEffect,useRef,useState} from 'react';
import {spriteUrl,textureVars,type SpriteName} from './sprites';

export type Facing='up'|'down'|'left'|'right';

/** Ambient light follows the player's local clock: morning, day, evening, night (html[data-daypart]). */
export function daypart(h=new Date().getHours()){return h>=6&&h<10?'morning':h>=10&&h<17?'day':h>=17&&h<21?'evening':'night';}
if(typeof document!=='undefined'){const set=()=>{document.documentElement.dataset.daypart=new URLSearchParams(location.search).get('daypart')??daypart();};set();setInterval(set,5*60_000);}

// Install texture variables once so every stylesheet can use var(--tx-*).
if(typeof document!=='undefined'){const root=document.documentElement;for(const [k,v] of Object.entries(textureVars))root.style.setProperty(k,v);
 for(const n of ['rat','boar','sentry','crab','brute','nest','keg','crack','fountain','altar','cache','loot','stairs','spikesArmed','spikesSafe'] as SpriteName[])root.style.setProperty(`--sp-${n}`,spriteUrl(n));}

export function heroFrame(facing:Facing):[SpriteName,boolean]{return facing==='up'?['heroUp',false]:facing==='left'?['heroSide',true]:facing==='right'?['heroSide',false]:['heroDown',false];}
const href=(u:string)=>u.slice(5,-2);

/** A pixel sprite as a single element (background image). Cheap enough for whole boards. */
export function Sprite({name,flip=false,className='',style}:{name:SpriteName;flip?:boolean;className?:string;style?:React.CSSProperties}){
 return <span aria-hidden="true" className={`px-sprite ${className}`} style={{backgroundImage:spriteUrl(name,flip),...style}}/>;
}

/** The player character in SVG form, usable inside the town SVG or in HTML tiles. */
export const walkFrame=(n:SpriteName):SpriteName=>(n+'Walk') as SpriteName;
export function HeroSvg({facing='down',x,y,width='100%',height='100%',walking=false}:{facing?:Facing;x?:number;y?:number;width?:number|string;height?:number|string;walking?:boolean}){
 const [name,flip]=heroFrame(facing);
 return <svg className={`character-sprite facing-${facing} ${walking?'walking':''}`} aria-hidden="true" focusable="false" x={x} y={y} width={width} height={height} viewBox="0 0 16 17" style={{display:'block',pointerEvents:'none',overflow:'visible'}}>
  <ellipse cx="8" cy="15.6" rx="5" ry="1.6" fill="#0b0f0d" opacity=".45"/>
  <g className="hero-body"><image className="frame-a" href={href(spriteUrl(name,flip))} width="16" height="16" style={{imageRendering:'pixelated'}}/><image className="frame-b" href={href(spriteUrl(walkFrame(name),flip))} width="16" height="16" style={{imageRendering:'pixelated'}}/></g>
 </svg>;
}

/** Remember the last movement direction of something that moves on a grid. */
export function useFacing(p:{x:number;y:number},initial:Facing='down'):Facing{
 const last=useRef(p),facing=useRef<Facing>(initial);
 if(p.x!==last.current.x||p.y!==last.current.y){const dx=p.x-last.current.x,dy=p.y-last.current.y;facing.current=Math.abs(dx)>=Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');last.current=p;}
 return facing.current;
}

/** True for a short moment after a grid position changes: drives the two-frame walk. */
export function useMoving(x:number|undefined,y:number|undefined,ms=280):boolean{
 const [moving,setMoving]=useState(false);const first=useRef(true);
 useEffect(()=>{if(first.current){first.current=false;return;}if(x===undefined)return;setMoving(true);const t=setTimeout(()=>setMoving(false),ms);return()=>clearTimeout(t);},[x,y]);
 return moving;
}
