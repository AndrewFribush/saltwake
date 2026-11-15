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
export type Dir='N'|'E'|'S'|'W';
export type Cell={level:number;col:number;row:number};
export const dirs:Record<Dir,[number,number]>={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
export const opposite:Record<Dir,Dir>={N:'S',E:'W',S:'N',W:'E'};
export const dirName:Record<Dir,string>={N:'north',E:'east',S:'south',W:'west'};
type RoomLike={links?:readonly FloorLink[];tiles:readonly string[]};
/** The wall a passage tile is nearest to: the side of the room it leaves by. */
export function linkSide(room:{tiles:readonly string[]},p:{x:number;y:number}):Dir{
 const w=room.tiles[0].length,h=room.tiles.length;const dx=(p.x-(w-1)/2)/w,dy=(p.y-(h-1)/2)/h;
 return Math.abs(dx)>=Math.abs(dy)?(dx>=0?'E':'W'):(dy>=0?'S':'N');
}
/** Grid cell of every room. Levels stack; within a level each room sits beside the room it opens from, on the side
 * its passage leaves by (the next free side when that one is taken). Stairs start the next level under the room they
 * leave. Linear dungeons are one room per level. Unreachable rooms get a cell of their own. */
export function roomGrid(rooms:readonly RoomLike[]):Cell[]{
 const n=rooms.length;if(!n)return [];const levels=roomLevels(rooms);const cells:(Cell|undefined)[]=new Array(n);const taken=new Set<string>();
 const k=(c:Cell)=>`${c.level}:${c.col},${c.row}`;const place=(i:number,c:Cell)=>{cells[i]=c;taken.add(k(c));};
 const free=(c:Cell)=>{while(taken.has(k(c)))c={...c,col:c.col+1};return c;};
 place(0,{level:0,col:0,row:0});const queue=[0];
 for(const i of queue)for(const l of rooms[i].links??[]){
  if(l.to<0||l.to>=n||cells[l.to])continue;const from=cells[i]!;
  if(isDescent(l.id))place(l.to,free({level:levels[l.to],col:from.col,row:from.row}));
  else{const side=linkSide(rooms[i],l);const order:Dir[]=[side,...(Object.keys(dirs) as Dir[]).filter(d=>d!==side)];
   const spot=order.map(d=>({level:from.level,col:from.col+dirs[d][0],row:from.row+dirs[d][1]})).find(c=>!taken.has(k(c)));
   place(l.to,spot??free({level:from.level,col:from.col+2,row:from.row}));}
  queue.push(l.to);
 }
 for(let i=0;i<n;i++)if(!cells[i])place(i,free({level:levels[i],col:0,row:0}));
 return cells as Cell[];
}
/** Rooms of one level with cells shifted so the smallest column and row are 0. */
export function levelCells(cells:readonly Cell[],level:number):{index:number;col:number;row:number}[]{
 const mine=cells.map((c,index)=>({index,...c})).filter(c=>c.level===level);if(!mine.length)return [];
 const c0=Math.min(...mine.map(c=>c.col)),r0=Math.min(...mine.map(c=>c.row));
 return mine.map(c=>({index:c.index,col:c.col-c0,row:c.row-r0}));
}
/** Floor tiles the arrival reaches without opening anything (doors, cracks, locks, kegs and pits stay shut). */
function reachable(floor:CustomFloor):Set<string>{
 const stop=new Set([...(floor.devices??[]).filter(d=>d.kind==='door').map(key),...(floor.features??[]).filter(x=>['crack','lock','barrel','pit'].includes(x.kind)).map(key)]);
 const seen=new Set([key(floor.spawn)]);const q=[floor.spawn];
 for(const p of q)for(const [dx,dy] of Object.values(dirs)){const n={x:p.x+dx,y:p.y+dy};if(floor.tiles[n.y]?.[n.x]==='.'&&!stop.has(key(n))&&!seen.has(key(n))){seen.add(key(n));q.push(n);}}
 return seen;
}
/** A free, reachable floor tile against the `dir` wall of the room, nearest the middle of that wall, for a passage
 * that leaves on that side. Falls back to the other walls, then to a tile beside the arrival. */
export function wallSpot(floor:CustomFloor,dir:Dir):{x:number;y:number}|undefined{
 const taken=new Set([floor.spawn,floor.exit,...floor.sockets,...(floor.devices??[]),...(floor.features??[]),...(floor.links??[])].map(key));
 const w=floor.tiles[0].length,h=floor.tiles.length;const seen=reachable(floor);
 const order:Dir[]=[dir,...(Object.keys(dirs) as Dir[]).filter(d=>d!==dir)];
 for(const d of order){
  const spots:{x:number;y:number;far:number}[]=[];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   if(floor.tiles[y][x]!=='.'||taken.has(key({x,y}))||!seen.has(key({x,y})))continue;
   // Against a wall on that side of the room (generated rooms have ragged walls, so "against" means the next tile
   // that way is solid and the tile sits in that half of the room), and not a dead end.
   const [ddx,ddy]=dirs[d];if(floor.tiles[y+ddy]?.[x+ddx]==='.')continue;
   const half=d==='E'?x>(w-1)/2:d==='W'?x<(w-1)/2:d==='S'?y>(h-1)/2:y<(h-1)/2;if(!half)continue;
   const open=Object.values(dirs).filter(([dx,dy])=>floor.tiles[y+dy]?.[x+dx]==='.').length;if(open<2)continue;
   const depth=d==='E'?x:d==='W'?w-1-x:d==='S'?y:h-1-y;
   spots.push({x,y,far:-depth*100+(d==='W'||d==='E'?Math.abs(y-(h-1)/2):Math.abs(x-(w-1)/2))});
  }
  spots.sort((a,b)=>a.far-b.far);if(spots.length)return {x:spots[0].x,y:spots[0].y};
 }
 return passageSpot(floor);
}
/** Adds a side room on the same level as `from`, through the `dir` wall (default: the first wall with room for a
 * passage): a blank room appended at the end, with a passage each way. The new room's passage back sits on the
 * opposite wall, so the pair reads as neighbours on the level map. Returns the new room's index, or a reason. */
export function addSideRoom(floors:CustomFloor[],from:number,blank:CustomFloor,dir?:Dir):{index:number}|{error:string}{
 if(floors.some(f=>f.links===undefined))connectLinear(floors);
 const here=floors[from];const a=dir?wallSpot(here,dir):passageSpot(here);if(!a)return {error:'No free tile beside this room’s arrival (S) for a passage. Clear one first.'};
 const room:CustomFloor={...structuredClone(blank),links:[]};const b=dir?wallSpot(room,opposite[dir]):passageSpot(room);if(!b)return {error:'The new room has no free tile beside its arrival.'};
 const index=floors.length;
 here.links!.push({id:`door-${index}`,...a,to:index,require_clear:false});
 room.links!.push({id:`door-back-${index}`,...b,to:from,require_clear:false});
 floors.push(room);return {index};
}
