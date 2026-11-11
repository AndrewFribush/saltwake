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
