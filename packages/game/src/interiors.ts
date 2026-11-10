import type {PlaceId,TownPoint} from './town';
export type RoomFixture={id:string;name:string;glyph:string;x:number;y:number};
export const roomSize={width:11,height:9};
export const roomEntry={x:5,y:7};
export const roomExit={x:5,y:8};
export function roomFixtures(place:PlaceId):RoomFixture[]{
 const service:Record<PlaceId,[string,string]>={inn:['Mara · storage & journal','☷'],market:['Merchant · buy & sell','⚖'],workshop:['Ivo · working kettle','♨'],guild:['Steward · dungeon charters','⚑'],gate:['Gatewarden · expeditions','⚔']};
 const [name,glyph]=service[place];return [{id:'service',name,glyph,x:5,y:2},{id:'wallet',name:'Account book · purse & receipts',glyph:'◉',x:8,y:5},{id:'decor-a',name:place==='inn'?'Guest bed':'Stock shelves',glyph:place==='inn'?'▰':'▤',x:2,y:2},{id:'decor-b',name:place==='workshop'?'Ingredient barrels':'Supply chest',glyph:'▣',x:2,y:5}];
}
export function roomWalkable(place:PlaceId,p:TownPoint){return Number.isInteger(p.x)&&Number.isInteger(p.y)&&(p.x===roomExit.x&&p.y===roomExit.y||p.x>0&&p.y>0&&p.x<roomSize.width-1&&p.y<roomSize.height-1)&&!roomFixtures(place).some(f=>f.x===p.x&&f.y===p.y);}
export function roomPath(place:PlaceId,from:TownPoint,to:TownPoint):TownPoint[]{
 if(!roomWalkable(place,from)||!roomWalkable(place,to))return [];const key=(p:TownPoint)=>`${p.x},${p.y}`;const queue=[from],parents=new Map<string,TownPoint|null>([[key(from),null]]);
 for(const p of queue){if(key(p)===key(to)){const path:TownPoint[]=[];let n:TownPoint|null=p;while(n&&key(n)!==key(from)){path.unshift(n);n=parents.get(key(n))??null;}return path;}for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){const n={x:p.x+dx,y:p.y+dy};if(roomWalkable(place,n)&&!parents.has(key(n))){parents.set(key(n),p);queue.push(n);}}}return [];
}
export function fixtureApproach(place:PlaceId,from:TownPoint,fixture:RoomFixture){return [[0,1],[-1,0],[1,0],[0,-1]].map(([dx,dy])=>({x:fixture.x+dx,y:fixture.y+dy})).filter(p=>roomWalkable(place,p)).map(p=>({p,path:roomPath(place,from,p)})).filter(v=>v.path.length||v.p.x===from.x&&v.p.y===from.y).sort((a,b)=>a.path.length-b.path.length)[0];}
