import {districtPlaces,districts,type DistrictId} from './town-districts';
import {readBuildingUse} from './town-spaces';
import type {Shopfront} from '../../shared/src/types';
import type {TownPoint} from './town';
/** The harbor notice board: a fixed spot on the Harbor Square quay. Shops cannot be placed west of x=4, so it is never built over. */
export const noticeBoard={district:'center' as DistrictId,x:3,y:7};
export const atNoticeBoard=(district:DistrictId,p:TownPoint)=>district===noticeBoard.district&&p.x===noticeBoard.x&&p.y===noticeBoard.y;
type EditionLike={id:string;fee:string;status:string;bundles:number;terms:{title:string;no_reward?:boolean};record?:{attempts:number;extracted:number;died:number;completed:number;recent?:{outcome:string;finishedAtMs:number|null}[]}};
type ListingLike={id:string;status:string;unit_price:string;remaining_ids:string[]};
export type BoardEntry={shopId:string;kind:'shop'|'dungeon';title:string;owner:string;district:DistrictId;districtName:string;door:TownPoint;open:boolean;
 dungeon?:{title:string;fee:string;status:string;funded:number;treasure:boolean;attempts:number;extracted:number;died:number;recent:string[];recentAt?:(number|null)[]}|null;goods?:{count:number;min:number;max:number;sold?:number;buyers?:number}};
/** Player buildings as public, confirmed records say they are. No ranking or endorsement; open ones first, then by district. */
export function boardEntries(shops:readonly (Shopfront&{publicRecord?:{sold:number;buyers:number}})[],editions:readonly EditionLike[],listings:readonly ListingLike[]):BoardEntry[]{
 const order=districts.map(d=>d.id);
 return shops.map(s=>{
  const use=readBuildingUse(s.interior);const place=districtPlaces(s.district as DistrictId,[s]).find(p=>p.shopId===s.id)!;
  const base={shopId:s.id,title:s.title,owner:s.owner,district:s.district as DistrictId,districtName:districts.find(d=>d.id===s.district)?.name??s.district,door:place.door,open:s.open};
  if(use.kind==='dungeon'){const e=editions.find(e=>e.id===use.edition);return {...base,kind:'dungeon' as const,dungeon:e?{title:e.terms.title,fee:e.fee,status:e.status,funded:e.bundles,treasure:!e.terms.no_reward,attempts:e.record?.completed??0,extracted:e.record?.extracted??0,died:e.record?.died??0,recent:(e.record?.recent??[]).map(r=>r.outcome),recentAt:(e.record?.recent??[]).map(r=>r.finishedAtMs)}:null};}
  const active=listings.filter(l=>s.listing_ids.includes(l.id)&&l.status==='active'&&l.remaining_ids.length);const prices=active.map(l=>Number(l.unit_price));
  return {...base,kind:'shop' as const,goods:{count:active.reduce((n,l)=>n+l.remaining_ids.length,0),min:prices.length?Math.min(...prices):0,max:prices.length?Math.max(...prices):0,...(s.publicRecord?{sold:s.publicRecord.sold,buyers:s.publicRecord.buyers}:{})}};
 }).sort((a,b)=>Number(b.open)-Number(a.open)||order.indexOf(a.district)-order.indexOf(b.district)||a.title.localeCompare(b.title));
}
/** Spoken directions from where you stand. Text only: the player still walks every step. */
export function directionsTo(from:DistrictId,to:{district:DistrictId;door:TownPoint}):string{
 const a=districts.find(d=>d.id===from)!,b=districts.find(d=>d.id===to.district)!;const legs:string[]=[];
 let x=a.x,y=a.y;
 while(x!==b.x){x+=Math.sign(b.x-x);legs.push(`${b.x>a.x?'east':'west'} to ${districts.find(d=>d.x===x&&d.y===y)!.name}`);}
 while(y!==b.y){y+=Math.sign(b.y-y);legs.push(`${b.y>a.y?'south':'north'} to ${districts.find(d=>d.x===x&&d.y===y)!.name}`);}
 const door=`the door at ${to.door.x}, ${to.door.y}`;
 return legs.length?`Go ${legs.join(', then ')}; ${door}.`:`It is here in ${a.name}: ${door}.`;
}
