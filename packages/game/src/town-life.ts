import {districtPlaces,districtWalkable,districts,type DistrictId} from './town-districts';
import type {Shopfront} from '../../shared/src/types';
import type {TownPoint} from './town';
import type {BoardEntry} from './town-board';
/** Town life: per-district notice posts, cosmetic townsfolk and clock signage.
 * Everything here is presentation over shared public records. Townsfolk are scenery: they never trade, pay,
 * block movement or grant anything, and the server never hears about them. */

/** Every district except Harbor Square (which has the full harbor board on the same tile) has a notice post on its
 * west verge. Shops cannot be placed west of x=4, so the post is never built over. */
export const districtPost={x:3,y:7};
export const atDistrictPost=(district:DistrictId,p:TownPoint)=>district!=='center'&&p.x===districtPost.x&&p.y===districtPost.y;

export type Period='dawn'|'day'|'dusk'|'night';
export function period(d:Date):Period{const h=d.getHours();return h>=5&&h<8?'dawn':h>=8&&h<17?'day':h>=17&&h<20?'dusk':'night';}
export function season(d:Date):string{const m=d.getMonth();return m===11||m<2?'ice season':m<5?'spawning season':m<8?'long-light season':'storm season';}
const periodLine:Record<Period,string>={dawn:'Dawn. Boats are going out on the early tide.',day:'Day. The quay is busy and the shutters are up.',dusk:'Dusk. Lamps are being lit along the quay.',night:'Night. The lamps are lit; most townsfolk have gone home.'};
const seasonLine:Record<string,string>={'ice season':'Ice season: rime on the ropes.','spawning season':'Spawning season: the nets come up full.','long-light season':'Long-light season: the evenings stretch out.','storm season':'Storm season: shutters rattle and the surf is high.'};
/** A sign line from the viewer's own clock. Purely descriptive. */
export function clockSign(d:Date){const p=period(d),s=season(d);return {period:p,season:s,text:`${periodLine[p]} ${seasonLine[s]}`};}

export type DistrictDigest={name:string;buildings:BoardEntry[];activity:string[]};
const ago=(ms:number)=>ms<90_000?'just now':ms<3_600_000?`${Math.round(ms/60_000)} min ago`:ms<86_400_000?`${Math.round(ms/3_600_000)} h ago`:`${Math.round(ms/86_400_000)} d ago`;
const outcomeWords:Record<string,string>={extracted:'escaped from',died:'died in',abandoned:'gave up in',completed:'finished'};
/** What a district's notice post shows: the player buildings standing in this district and their latest confirmed
 * activity (run outcomes with times, shop sales counts, who is inside now). No names for run outcomes: edition
 * records keep outcome and time only. */
export function districtDigest(id:DistrictId,entries:readonly BoardEntry[],browsing:Record<string,string[]>={},now=Date.now(),label:(p:string)=>string=p=>p):DistrictDigest{
 const name=districts.find(d=>d.id===id)!.name;const buildings=entries.filter(e=>e.district===id);
 const timed:{at:number;text:string}[]=[];
 for(const e of buildings){
  e.dungeon?.recentAt?.forEach((at,i)=>{const o=e.dungeon!.recent[i];if(at&&o)timed.push({at,text:`${ago(now-at)}: a delver ${outcomeWords[o]??o} ${e.dungeon!.title}`});});
 }
 const activity=timed.sort((a,b)=>b.at-a.at).slice(0,4).map(t=>t.text);
 for(const e of buildings){const who=browsing[e.shopId]??[];if(who.length)activity.unshift(`Now: ${who.slice(0,3).map(label).join(', ')} ${who.length===1?'is':'are'} inside ${e.title}`);}
 for(const e of buildings)if(e.kind==='shop'&&e.goods?.sold)activity.push(`${e.title} has sold ${e.goods.sold} ${e.goods.sold===1?'item':'items'} to ${e.goods.buyers} ${e.goods.buyers===1?'buyer':'buyers'} in all`);
 return {name,buildings,activity:activity.slice(0,6)};
}

export type Townsperson={id:string;name:string;role:string;look:number;x:number;y:number;facing:'left'|'right'|'up'|'down'};
const folk=[['Maren','netmender'],['Tobin','porter'],['Ysolde','fishwife'],['Arno','cooper'],['Pell','gull-chaser'],['Wenna','rope-spinner'],['Corrin','tide-watcher'],['Hessa','chandler']] as const;
const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
/** Longest walkable stretch of a road row that avoids doors, the notice post and the board tile. */
function lanes(id:DistrictId,shops:readonly Shopfront[]){
 const doors=new Set(districtPlaces(id,shops).map(b=>`${b.door.x},${b.door.y}`));const out:{y:number;x1:number;x2:number}[]=[];
 for(const y of [5,8,13]){let best:[number,number]|undefined,start=-1;
  for(let x=2;x<=22;x++){const ok=x<22&&districtWalkable(id,{x,y},shops)&&!doors.has(`${x},${y}`)&&!doors.has(`${x},${y-1}`);
   if(ok&&start<0)start=x;if(!ok&&start>=0){if(!best||x-1-start>best[1]-best[0])best=[start,x-1];start=-1;}}
  if(best&&best[1]-best[0]>=3)out.push({y,x1:best[0],x2:best[1]});}
 return out;
}
/** Ambient walkers for a district at a moment: deterministic from the clock, so every viewer sees roughly the same
 * scene without any server state. Two by day, one by night, plus a lamplighter at dusk. */
export function townsfolk(id:DistrictId,shops:readonly Shopfront[],now:number,d=new Date(now)):Townsperson[]{
 const ls=lanes(id,shops);if(!ls.length)return [];const p=period(d);const count=p==='night'?1:2;const out:Townsperson[]=[];
 for(let i=0;i<count;i++){
  const h=hash(id+':'+i);const [name,role]=folk[(hash(id)+i*3)%folk.length];const lane=ls[(h>>>4)%ls.length];const len=lane.x2-lane.x1;
  const t=Math.floor(now/1400)+(h%997);const phase=t%(2*len);const forward=phase<len;const x=forward?lane.x1+phase:lane.x2-(phase-len);
  out.push({id:`folk-${id}-${i}`,name,role,look:(h>>>8)%6,x,y:lane.y,facing:forward?'right':'left'});
 }
 if(p==='dusk'){const lane=ls[0];const t=Math.floor(now/2600)%(lane.x2-lane.x1+1);out.push({id:`folk-${id}-lamp`,name:'Old Fenn',role:'lamplighter',look:5,x:lane.x1+t,y:lane.y,facing:'right'});}
 return out;
}
/** What a townsperson says when you stop them. Built only from public facts in the digest; never an offer. */
export function folkLine(t:Townsperson,digest:DistrictDigest,d:Date){
 if(t.role==='lamplighter')return 'Mind the puddles. I light these lamps every dusk, coin or no coin.';
 const h=hash(t.id+Math.floor(d.getTime()/60_000));const dungeons=digest.buildings.filter(b=>b.kind==='dungeon'),shops=digest.buildings.filter(b=>b.kind==='shop');
 const options:string[]=[];
 if(digest.activity[0])options.push(`Heard on the street: ${digest.activity[0].replace(/^Now: /,'')}.`);
 if(dungeons[0])options.push(`${dungeons[0].title} is the dungeon door round here. ${dungeons[0].dungeon?`Entry is ${dungeons[0].dungeon.fee} coins, they say.`:'Nobody knows what is down there now.'}`);
 if(shops[0])options.push(shops[0].goods?.count?`${shops[0].title} has goods on the shelves today.`:`${shops[0].title}'s shelves look bare.`);
 if(!digest.buildings.length)options.push(`Nobody has built in ${digest.name} yet. Plenty of room for a shop.`);
 options.push(clockSign(d).text.split('. ')[0]+'. '+`${digest.name} is ${period(d)==='night'?'quiet':'busy enough'}.`);
 return options[h%options.length];
}
