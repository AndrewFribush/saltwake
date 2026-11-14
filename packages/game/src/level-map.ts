import type {CustomFloor,FloorLink} from '../../shared/src/custom-layout';

/** Levels of rooms. A dungeon is a list of rooms ("floors" in the format) joined by walk-on passages. A passage whose
 * id starts with down/stairs/drop descends to the next level; any other passage joins two rooms of the same level.
 * Without passages, rooms chain by their stairs, one level each. Purely presentational: the format is unchanged. */
export const isDescent=(linkId:string)=>/^(down|stairs|drop)/i.test(linkId);
type Room={links?:readonly FloorLink[]};

/** Level number (0-based) of every room, breadth-first from the entrance; unreachable rooms fall back to their index. */
export function roomLevels(rooms:readonly Room[]):number[]{
 const n=rooms.length;const level=new Array<number>(n).fill(-1);if(!n)return level;
 const linear=rooms.every(r=>r.links===undefined);
 if(linear)return rooms.map((_,i)=>i);
 level[0]=0;const queue=[0];
 for(const i of queue){
  const next=[...(rooms[i].links??[]).map(l=>({to:l.to,lv:level[i]+(isDescent(l.id)?1:0)}))];
  for(const {to,lv} of next)if(to>=0&&to<n&&(level[to]<0||lv<level[to])){level[to]=lv;queue.push(to);}
 }
 return level.map((lv,i)=>lv<0?i:lv);
}
/** "Level 2 · room B" when a level has several rooms, else "Level 2". */
export function roomLabel(rooms:readonly Room[],index:number,levels=roomLevels(rooms)):string{
 const lv=levels[index];const mates=levels.map((l,i)=>l===lv?i:-1).filter(i=>i>=0);
 return mates.length>1?`Level ${lv+1} · room ${String.fromCharCode(65+mates.indexOf(index))}`:`Level ${lv+1}`;
}
export const levelCount=(rooms:readonly Room[])=>rooms.length?Math.max(...roomLevels(rooms))+1:0;

const key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
/** A free floor tile four-adjacent to `near` (default: the arrival) that carries no marker, for a new passage. */
export function passageSpot(floor:CustomFloor,near:{x:number;y:number}=floor.spawn):{x:number;y:number}|undefined{
 const taken=new Set([floor.spawn,floor.exit,...floor.sockets,...(floor.devices??[]),...(floor.features??[]),...(floor.links??[])].map(key));
 for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const p={x:near.x+dx,y:near.y+dy};if(floor.tiles[p.y]?.[p.x]==='.'&&!taken.has(key(p)))return p;}
 return undefined;
}
/** Gives a linear draft explicit passages (a `down{i}` beside each stairs), as the generator does, so turning on
 * connected rooms keeps every room reachable. Rooms whose stairs have no free neighbour are left for the author. */
export function connectLinear(floors:CustomFloor[]):void{
 for(const [i,f] of floors.entries()){f.links??=[];if(i<floors.length-1&&!f.links.length){const p=passageSpot(f,f.exit);if(p)f.links.push({id:`down${i}`,...p,to:i+1,require_clear:f.exit_rule?.require_clear??true});}}
}
/** Adds a side room on the same level as `from`: a blank room appended at the end, with a passage each way.
 * Returns the new room's index, or a reason when no passage tile is free. */
export function addSideRoom(floors:CustomFloor[],from:number,blank:CustomFloor):{index:number}|{error:string}{
 if(floors.some(f=>f.links===undefined))connectLinear(floors);
 const here=floors[from];const a=passageSpot(here);if(!a)return {error:'No free tile beside this room’s arrival (S) for a passage. Clear one first.'};
 const room:CustomFloor={...structuredClone(blank),links:[]};const b=passageSpot(room);if(!b)return {error:'The new room has no free tile beside its arrival.'};
 const index=floors.length;
 here.links!.push({id:`door-${index}`,...a,to:index,require_clear:false});
 room.links!.push({id:`door-back-${index}`,...b,to:from,require_clear:false});
 floors.push(room);return {index};
}
