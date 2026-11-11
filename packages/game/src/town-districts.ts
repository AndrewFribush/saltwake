import type {Shopfront} from '../../shared/src/types';
export type TownBuilding={id:string;name:string;keeper:string;purpose:string;x:number;y:number;width:number;height:number;door:{x:number;y:number};shopId?:string};
import {places,townSize,townWalkable,type TownPoint,type PlaceId} from './town';
export type DistrictId='nw'|'n'|'ne'|'w'|'center'|'e'|'sw'|'s'|'se';
export const districts:{id:DistrictId;name:string;x:number;y:number;service?:PlaceId}[]=[
 {id:'nw',name:'Lantern Gardens',x:0,y:0,service:'inn'},
 {id:'n',name:'North Ward',x:1,y:0,service:'inn'},
 {id:'ne',name:'Old Wall',x:2,y:0,service:'gate'},
 {id:'w',name:'West Docks',x:0,y:1,service:'market'},
 {id:'center',name:'Harbor Square',x:1,y:1},
 {id:'e',name:'Market Ward',x:2,y:1,service:'market'},
 {id:'sw',name:'Ropewalk',x:0,y:2,service:'workshop'},
 {id:'s',name:'South Quay',x:1,y:2,service:'workshop'},
 {id:'se',name:'Guild Quarter',x:2,y:2,service:'guild'},
];
function starterPlaces(id:DistrictId){
 if(id==='center')return places;
 const service=districts.find(d=>d.id===id)!.service!;
 const original=places.find(p=>p.id===service)!;
 return [{...original,x:10,y:4,door:{x:12,y:6}}];
}
export function districtPlaces(id:DistrictId,shops:readonly Shopfront[]=[]):TownBuilding[]{return [...starterPlaces(id),...shops.filter(s=>s.district===id).map(s=>({id:s.id,shopId:s.id,name:s.title,keeper:s.owner,purpose:s.open?'Player shop':'Closed shop',x:s.x,y:s.y,width:3,height:2,door:{x:s.x+1,y:s.y+1}}))];}
export function neighbor(id:DistrictId,dx:number,dy:number){const d=districts.find(d=>d.id===id)!;return districts.find(n=>n.x===d.x+dx&&n.y===d.y+dy);}
export function districtWalkable(id:DistrictId,p:TownPoint,shops:readonly Shopfront[]=[]){
 if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=24||p.y<0||p.y>=16)return false;
 if(id==='center'&&!townWalkable(p))return false;
 return !districtPlaces(id,shops).some(b=>p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height&&!(p.x===b.door.x&&p.y===b.door.y));
}
const onEdge=(p:TownPoint)=>p.x===0||p.x===23||p.y===0||p.y===15;
export function districtPath(id:DistrictId,from:TownPoint,to:TownPoint,shops:readonly Shopfront[]=[]):TownPoint[]{
 if(!districtWalkable(id,from,shops)||!districtWalkable(id,to,shops))return [];
 const key=(p:TownPoint)=>`${p.x},${p.y}`,queue=[from],parents=new Map<string,TownPoint|null>([[key(from),null]]);
 for(const p of queue){if(key(p)===key(to)){const result:TownPoint[]=[];let n:TownPoint|null=p;while(n&&key(n)!==key(from)){result.unshift(n);n=parents.get(key(n))??null;}return result;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};const door=districtPlaces(id,shops).some(b=>b.door.x===n.x&&b.door.y===n.y);if(districtWalkable(id,n,shops)&&(!onEdge(n)&&!door||key(n)===key(to))&&!parents.has(key(n))){parents.set(key(n),p);queue.push(n);}}
 }return [];
}
export function districtStep(id:DistrictId,from:TownPoint,to:TownPoint,shops:readonly Shopfront[]=[]):{district:DistrictId;position:TownPoint;enter?:string;blocked?:string}{
 const unchanged={district:id,position:from};const dx=to.x-from.x,dy=to.y-from.y;
 if(!Number.isInteger(to.x)||!Number.isInteger(to.y)||Math.abs(dx)+Math.abs(dy)!==1)return unchanged;
 const edge=dx===-1&&to.x<=0||dx===1&&to.x>=townSize.width-1||dy===-1&&to.y<=0||dy===1&&to.y>=townSize.height-1;
 if(edge){
  // Reaching water is never a passage, even if another district exists beyond it.
  const boundary={x:Math.max(0,Math.min(23,to.x)),y:Math.max(0,Math.min(15,to.y))};
  if(!districtWalkable(id,boundary,shops))return {...unchanged,blocked:'Water blocks this route. Use the dock crossing.'};
  const next=neighbor(id,dx,dy);if(!next)return {...unchanged,blocked:'The town wall ends this road.'};
  const arrival={x:dx===-1?23:dx===1?0:to.x,y:dy===-1?15:dy===1?0:to.y};
  if(!districtWalkable(next.id,arrival,shops))return {...unchanged,blocked:'Water blocks this route. Use the dock crossing.'};
  return {district:next.id,position:arrival};
 }
 if(!districtWalkable(id,to,shops))return unchanged;
 const building=districtPlaces(id,shops).find(b=>b.door.x===to.x&&b.door.y===to.y);
 return building?{district:id,position:{x:building.door.x,y:building.door.y+1},enter:building.id}:{district:id,position:to};
}
