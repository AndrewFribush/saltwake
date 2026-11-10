export type TownPoint={x:number;y:number};
export type PlaceId='inn'|'market'|'workshop'|'guild'|'gate';
export const townSize={width:24,height:16};
export const townStart:TownPoint={x:12,y:9};
export const places:{id:PlaceId;name:string;keeper:string;purpose:string;x:number;y:number;width:number;height:number;door:TownPoint}[]=[
 {id:'inn',name:'The Salt Lantern',keeper:'Mara, innkeeper',purpose:'Pack your satchel, read your journal, or practise in the cellar.',x:5,y:2,width:4,height:3,door:{x:7,y:4}},
 {id:'market',name:'Quayside market',keeper:'The town merchants',purpose:'Sell your finds. Buy supplies. Stock a stall of your own.',x:11,y:2,width:5,height:3,door:{x:13,y:4}},
 {id:'workshop',name:'The Copper Kettle',keeper:'Ivo, alchemist',purpose:'Turn herbs and flasks into tonics, or earn a wage at the bench.',x:6,y:10,width:4,height:3,door:{x:8,y:12}},
 {id:'guild',name:'Delvers’ guild',keeper:'The expedition steward',purpose:'Build a livelihood: fund treasure, open a dungeon, and collect entry fees.',x:18,y:9,width:4,height:3,door:{x:19,y:11}},
 {id:'gate',name:'The old catacombs',keeper:'The gatewarden',purpose:'Choose a funded expedition. What you bring can be lost.',x:19,y:1,width:4,height:3,door:{x:20,y:3}},
];
export function townWalkable(p:TownPoint){return Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<townSize.width&&p.y>=0&&p.y<townSize.height&&(p.x>=3||p.y===8)&&(!places.some(b=>p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height)||!!doorAt(p));}
export function townPath(from:TownPoint,to:TownPoint):TownPoint[]{
 if(!townWalkable(from)||!townWalkable(to))return [];
 const key=(p:TownPoint)=>`${p.x},${p.y}`;const queue=[from];const parents=new Map<string,TownPoint|null>([[key(from),null]]);
 for(const p of queue){if(key(p)===key(to)){const path:TownPoint[]=[];let step:TownPoint|null=p;while(step&&key(step)!==key(from)){path.unshift(step);step=parents.get(key(step))??null;}return path;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next={x:p.x+dx,y:p.y+dy};if(townWalkable(next)&&(!doorAt(next)||key(next)===key(to))&&!parents.has(key(next))){parents.set(key(next),p);queue.push(next);}}
 }return [];
}
export function nearbyPlace(p:TownPoint){return places.find(b=>Math.abs(b.door.x-p.x)+Math.abs(b.door.y-p.y)<=1);}

export function doorAt(p:TownPoint){return places.find(b=>b.door.x===p.x&&b.door.y===p.y);}
export function townStep(from:TownPoint,to:TownPoint):{position:TownPoint;enter?:PlaceId}{
 if(!townWalkable(to)||Math.abs(from.x-to.x)+Math.abs(from.y-to.y)!==1)return {position:from};
 const door=doorAt(to);return door?{position:{x:door.door.x,y:door.door.y+1},enter:door.id}:{position:to};
}
