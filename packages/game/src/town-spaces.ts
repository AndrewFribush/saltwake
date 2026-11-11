import {roomWalkable,validateInterior,type BuildingKind,type InteriorLayout,type RoomFixture} from './interiors';
/** Player-built town spaces: what a placed building is for, read from its authoritative (contract-stored) interior. */
export type BuildingUse={kind:'shop'}|{kind:'dungeon';edition:string};
export const portalFixture=(x:number,y:number):RoomFixture=>({id:'portal',name:'Stairway down',glyph:'▼',x,y});
/** Parses a stored interior without throwing; unreadable rooms are treated as shops so the town still renders. */
export function readBuildingUse(interior:string):BuildingUse{
 try{const r=JSON.parse(interior) as InteriorLayout;if(r.kind==='dungeon'&&typeof r.edition==='string'&&r.edition)return {kind:'dungeon',edition:r.edition};}catch{}
 return {kind:'shop'};
}
/** First floor tile where a new furnishing keeps the room valid (reachable, clear of arrival/door). */
export function freeFixtureTile(layout:InteriorLayout,make:(x:number,y:number)=>RoomFixture):RoomFixture|undefined{
 for(let y=1;y<8;y++)for(let x=1;x<10;x++){
  if(!roomWalkable('inn',{x,y},layout)||x===layout.entry.x&&y===layout.entry.y)continue;
  const f=make(x,y);const probe={...layout,edition:layout.kind==='dungeon'?layout.edition||'probe':layout.edition,fixtures:[...layout.fixtures,f]};
  if(!validateInterior(probe).length)return f;
 }
 return undefined;
}
/** Switches a building's use, adding the one required stairway for a dungeon entrance or removing it for a shop. */
export function withBuildingUse(layout:InteriorLayout,kind:BuildingKind,edition?:string):InteriorLayout{
 const base:InteriorLayout={tiles:[...layout.tiles],entry:{...layout.entry},exit:{...layout.exit},fixtures:layout.fixtures.filter(f=>f.id!=='portal').map(f=>({...f}))};
 if(kind==='shop')return base;
 const existing=layout.fixtures.find(f=>f.id==='portal');
 const withEdition={...base,kind:'dungeon' as const,edition:edition??layout.edition??''};
 const portal=existing??freeFixtureTile(withEdition,portalFixture);
 return portal?{...withEdition,fixtures:[...withEdition.fixtures,portal]}:withEdition;
}
/** Display shelves are decor fixtures (`decor-display-<8 hex>`, within the contract's 40-character decor id limit) that show the shop's real listed goods. */
export const displayId=()=>`decor-display-${Array.from({length:8},()=>Math.floor(Math.random()*16).toString(16)).join('')}`;
export const isDisplay=(f:{id:string})=>f.id.startsWith('decor-display-');
/** Spreads active stock stacks over the shelves in placement order; every stack is on exactly one shelf. */
export function displayAssignments<T>(shelves:readonly {id:string}[],stacks:readonly T[]):Map<string,T[]>{
 const out=new Map(shelves.map(s=>[s.id,[] as T[]]));stacks.forEach((stack,i)=>{if(shelves.length)out.get(shelves[i%shelves.length].id)!.push(stack);});return out;
}
