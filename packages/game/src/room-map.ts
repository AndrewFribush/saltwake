import type {RunState} from './state';
import type {FloorLink} from '../../shared/src/custom-layout';
import {roomGrid,type Cell} from './level-map';

export type RoomMapInfo={cell:Cell;tiles?:string[];links?:FloorLink[]};
/** What the player knows of the room grid: every room's cell, plus the geometry and passages of rooms they have been
 * in (under fog, a passage counts only once its tile has been seen). Nothing the fog hides crosses here. */
export function roomMap(s:RunState):RoomMapInfo[]|undefined{
 const layout=s.layout;if(!layout)return undefined;
 const cells=roomGrid(layout);const explored=new Set(s.explored??[]);
 const seen=(room:number,l:{x:number;y:number})=>!s.roguelike||explored.has(`${room}:${l.x},${l.y}`);
 return layout.map((r,i)=>{
  const here=i===s.roomIndex,mem=s.roomMemory?.[i];
  if(!here&&!mem)return {cell:cells[i]};
  const tiles=here?s.room:mem?.tiles??r.tiles;
  return {cell:cells[i],tiles:[...tiles],links:(r.links??[]).filter(l=>seen(i,l))};
 });
}
