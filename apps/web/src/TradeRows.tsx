import React from 'react';
import {ItemIcon} from './ItemIcon';
import {catalog} from '../../../packages/shared/src/catalog';
import {itemUse} from '../../../packages/shared/src/equipment';
import type {Item} from '../../../packages/shared/src/types';

export const itemName=(type:string)=>(catalog as Record<string,{name:string}>)[type]?.name??type;
export const countOf=(n:number,type:string)=>{const name=itemName(type);return `${n} ${n===1||/armor|iron$/i.test(name)?name:name+'s'}`;};
export const itemNote=(type:string)=>(itemUse as Record<string,string>)[type]??'';

/** One row per stack of identical goods. The caller keeps exact item ids; the row only chooses how many. */
export type Stack={key:string;type:string;ids:string[];note?:React.ReactNode;price?:string;disabled?:boolean};

/** Groups items into stacks by item type, preserving the incoming id order (so "first N" is deterministic). */
export function stacksOf(items:Item[],extra?:(type:string,ids:string[])=>Partial<Stack>):Stack[]{
 const by=new Map<string,string[]>();
 for(const item of items){const list=by.get(item.item_type)??[];list.push(item.id);by.set(item.item_type,list);}
 return [...by].map(([type,ids])=>({key:type,type,ids,...extra?.(type,ids)}));
}

/** The exact ids chosen for a stack: the first `count` ids in the stack. */
export const chosenIds=(stacks:Stack[],counts:Record<string,number>)=>stacks.flatMap(s=>s.ids.slice(0,Math.min(counts[s.key]??0,s.ids.length)));

export function StackRows({stacks,counts,onCount,disabled,empty,unit='coins'}:{stacks:Stack[];counts:Record<string,number>;onCount:(key:string,n:number)=>void;disabled?:boolean;empty?:string;unit?:string}){
 if(!stacks.length)return <p className="empty-state">{empty??'Nothing here.'}</p>;
 return <ul className="stack-rows">{stacks.map(s=>{const n=Math.min(counts[s.key]??0,s.ids.length),off=disabled||s.disabled;return <li key={s.key} className={n?'chosen':''}>
  <ItemIcon type={s.type}/>
  <span className="stack-name"><b>{itemName(s.type)}</b><small>{s.note??itemNote(s.type)}</small></span>
  <span className="stack-meta">{s.price!==undefined&&<b>{s.price} {unit}</b>}<small>{s.ids.length} available</small></span>
  <span className="stack-qty" role="group" aria-label={`How many ${itemName(s.type)}`}>
   <button type="button" aria-label={`One fewer ${itemName(s.type)}`} disabled={off||n<=0} onClick={()=>onCount(s.key,n-1)}>−</button>
   <output aria-live="polite">{n}</output>
   <button type="button" aria-label={`One more ${itemName(s.type)}`} disabled={off||n>=s.ids.length} onClick={()=>onCount(s.key,n+1)}>+</button>
  </span>
 </li>;})}</ul>;
}
