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
/** Mirrors the contract's placement rule (shops.rs save_shop): bounds, one-tile clearance, and the reserved spawn road. */
export function footprintBlocked(id:DistrictId,shops:readonly Shopfront[],x:number,y:number,ignore?:string){
 const buildings=districtPlaces(id,shops.filter(s=>s.id!==ignore));
 return x<4||x>19||y<1||y>11||buildings.some(b=>x<=b.x+b.width&&x+3>=b.x&&y<=b.y+b.height&&y+2>=b.y)||(x<=12&&x+3>12&&y<=9&&y+2>9);
}
/** The free 3×2 plot nearest to where the player stands, if any: used to point at land in the world, not to place anything. */
export function suggestPlot(id:DistrictId,shops:readonly Shopfront[],from:{x:number;y:number}){
 let best:{x:number;y:number}|undefined,dist=Infinity;
 for(let y=1;y<=11;y++)for(let x=4;x<=19;x++){if(footprintBlocked(id,shops,x,y))continue;const d=Math.abs(x+1-from.x)+Math.abs(y+1-from.y);if(d<dist){dist=d;best={x,y};}}
 return best;
}
