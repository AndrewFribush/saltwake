import {districtPlaces,districts,type DistrictId} from './town-districts';
import type {Shopfront} from '../../shared/src/types';
/** What a walker hears on arriving in a district: the player buildings standing there, from shared contract state. */
export function districtArrival(id:DistrictId,shops:readonly Shopfront[],label:(owner:string)=>string=o=>o):string{
 const name=districts.find(d=>d.id===id)!.name;
 const built=districtPlaces(id,shops).filter(p=>p.shopId);
 if(!built.length)return `You arrive in ${name}. Nobody has built here yet: use Build here to claim a plot.`;
 const list=built.slice(0,3).map(p=>`${p.name} (${label(p.keeper)}, ${p.purpose.toLowerCase()})`).join('; ');
 return `You arrive in ${name}. Built here: ${list}${built.length>3?` and ${built.length-3} more`:''}.`;
}
/** A short line for the building whose door you stand beside. */
export function doorstepLine(place:{name:string;keeper:string;purpose:string;shopId?:string},label:(owner:string)=>string=o=>o):string|undefined{
 return place.shopId?`${place.name}: ${place.purpose.toLowerCase()} built by ${label(place.keeper)}. Walk in to visit.`:undefined;
}
/** Stable hue per owner, so a player's buildings share a banner colour across the town. */
export function ownerHue(owner:string){let h=0;for(const c of owner)h=(h*31+c.charCodeAt(0))>>>0;return h%360;}
