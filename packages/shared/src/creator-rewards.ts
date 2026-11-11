import {catalog} from './catalog';
import type {Item,ItemType,Socket,RandomTable} from './types';
export type CreatorPlacement={enemy:Socket['enemy'];trap:boolean;reward:ItemType|'random'|null;randomPool?:string};
export const placementPool=(p:CreatorPlacement)=>p.randomPool??'creator-loot';
export const validPool=(id:unknown):id is string=>typeof id==='string'&&id.trim()===id&&id.length>0&&new TextEncoder().encode(id).length<=40;
export function poolConfigurationErrors(placements:readonly (readonly CreatorPlacement[])[]):string[]{
 const counts=new Map<string,number>(),errors:string[]=[];for(const p of placements.flat()){if(p.reward!=='random'){if(p.randomPool!==undefined)errors.push('Only random rewards may name a pool.');continue;}const id=placementPool(p);if(!validPool(id))errors.push('Random pool names must be 1–40 UTF-8 bytes without surrounding spaces.');counts.set(id,(counts.get(id)??0)+1);}
 if(counts.size>16)errors.push('At most 16 independent random pools are supported.');for(const [id,n] of counts)if(n>16)errors.push(`Random pool ${id} has more than 16 draws per attempt. Split it into separate pools.`);return errors;
}
export function creatorSockets(placements:readonly (readonly CreatorPlacement[])[]):Socket[]{return placements.flatMap((ps,room)=>ps.map((p,slot)=>({id:`floor-${room}-slot-${slot}`,room,slot,enemy:p.enemy,trap:p.trap,reward:p.reward==='random'?null:p.reward})));}
/** Assign each physical good to exactly one pool. Legacy ID lists mean creator-loot. */
export function creatorFunding(placements:readonly (readonly CreatorPlacement[])[],selected:readonly string[],randomAssignments:readonly string[]|Readonly<Record<string,string>>,items:readonly Item[],profile:string){
 const assignments:Readonly<Record<string,string>>=Array.isArray(randomAssignments)?Object.fromEntries(randomAssignments.map(id=>[id,'creator-loot'])):randomAssignments as Readonly<Record<string,string>>;
 const errors:string[]=poolConfigurationErrors(placements),funding=[...new Set(selected)],pools=new Map<string,string[]>();
 const required:Partial<Record<ItemType,number>>={};
 placements.forEach((ps,room)=>ps.forEach((p,slot)=>{if(p.reward==='random'){const pool=placementPool(p);const sockets=pools.get(pool)??[];sockets.push(`floor-${room}-slot-${slot}`);pools.set(pool,sockets);}else if(p.reward)required[p.reward]=(required[p.reward]??0)+1;}));
 if(funding.length!==selected.length)errors.push('Remove duplicate funding selections.');
 if(funding.length>128)errors.push('Select at most 128 funding items across all pools.');
 const owned=funding.map(id=>items.find(i=>i.id===id&&i.location.kind==='owned'&&i.location.profile===profile));
 if(owned.some(i=>!i))errors.push('Some selected goods are no longer yours. Refresh and select again.');
 const fixed_funding=funding.filter(id=>!Object.hasOwn(assignments,id));
 const counts:Partial<Record<ItemType,number>>={};for(const item of owned)if(item&&!Object.hasOwn(assignments,item.id))counts[item.item_type]=(counts[item.item_type]??0)+1;
 for(const [type,count] of Object.entries(required) as [ItemType,number][]){if((counts[type]??0)<count)errors.push(`Fixed pool needs ${count} ${catalog[type].name}; ${counts[type]??0} assigned.`);}
 if(Object.keys(counts).some(type=>!required[type as ItemType]))errors.push('Assign fixed stock only to types used by fixed reward sockets.');
 if(funding.some(id=>Object.hasOwn(assignments,id)&&!pools.has(assignments[id])))errors.push('Remove random-pool stock or assign it to a configured random reward pool.');
 const random_tables:RandomTable[]=[...pools].map(([table_id,socket_ids])=>{const item_ids=funding.filter(id=>Object.hasOwn(assignments,id)&&assignments[id]===table_id);if(item_ids.length<socket_ids.length)errors.push(`Random pool ${table_id} needs at least ${socket_ids.length} goods for one complete attempt; ${item_ids.length} assigned.`);return {table_id,socket_ids,item_ids};});
 const capacities=[...Object.entries(required).map(([type,n])=>Math.floor((counts[type as ItemType]??0)/n)),...random_tables.map(t=>Math.floor(t.item_ids.length/t.socket_ids.length))];
 return {errors,fixed_funding,random_tables,randomSocketCount:random_tables.reduce((n,t)=>n+t.socket_ids.length,0),completeCopies:capacities.length?Math.min(...capacities):null};
}
