import type {CustomFloor} from '../../shared/src/custom-layout';
/** Grid power tools for the builder: geometry-only stamps ('#' wall, '.' floor, ' ' leave as is). */
export type Stamp={name:string;tiles:string[]};
export type Rect={x0:number;y0:number;x1:number;y1:number};
export const normalRect=(a:{x:number;y:number},b:{x:number;y:number}):Rect=>({x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)});
export const inRect=(r:Rect,x:number,y:number)=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1;

export function copyRegion(floor:Pick<CustomFloor,'tiles'>,r:Rect,name='Selection'):Stamp{
 return {name,tiles:floor.tiles.slice(r.y0,r.y1+1).map(row=>row.slice(r.x0,r.x1+1))};
}
/** Quarter turn clockwise. */
export function rotateStamp(s:Stamp):Stamp{const h=s.tiles.length,w=s.tiles[0]?.length??0;return {...s,tiles:Array.from({length:w},(_,x)=>Array.from({length:h},(_,y)=>s.tiles[h-1-y][x]).join(''))};}
export function mirrorStamp(s:Stamp):Stamp{return {...s,tiles:s.tiles.map(r=>[...r].reverse().join(''))};}

/** Occupied tiles (markers, encounters, devices, features, passages) are never walled over. */
export function occupiedTiles(f:CustomFloor):Set<string>{
 const at=(p:{x:number;y:number})=>`${p.x},${p.y}`;
 return new Set([f.spawn,f.exit,...f.sockets,...(f.devices??[]),...(f.links??[]),...((f as {features?:{x:number;y:number}[]}).features??[])].map(at));
}
/** Paste with the stamp's top-left at (x,y). Keeps the outer boundary closed and markers on floor.
 * Returns the new tile rows and how many cells were skipped. */
export function pasteStamp(f:CustomFloor,s:Stamp,x:number,y:number):{tiles:string[];changed:number;skipped:number}{
 const rows=f.tiles.map(r=>[...r]),h=rows.length,w=rows[0].length,busy=occupiedTiles(f);let changed=0,skipped=0;
 s.tiles.forEach((line,dy)=>[...line].forEach((ch,dx)=>{
  if(ch!=='#'&&ch!=='.')return;const tx=x+dx,ty=y+dy;
  if(tx<=0||ty<=0||tx>=w-1||ty>=h-1){skipped++;return;}
  if(ch==='#'&&busy.has(`${tx},${ty}`)){skipped++;return;}
  if(rows[ty][tx]!==ch){rows[ty][tx]=ch;changed++;}
 }));
 return {tiles:rows.map(r=>r.join('')),changed,skipped};
}
export const builtInStamps:Stamp[]=[
 {name:'Pillared hall',tiles:['.......','.#.#.#.','.......','.#.#.#.','.......']},
 {name:'Corridor junction',tiles:['##.##','##.##','.....','##.##','##.##']},
 {name:'Vault alcove',tiles:['#####','#...#','#...#','##.##']},
 {name:'Arena ring',tiles:['.........','.#######.','.#.....#.','.#.....#.','.###.###.','.........']},
 {name:'Long corridor',tiles:['#######','.......','#######']},
 {name:'Twin rooms',tiles:['###.#.###','#...#...#','#.......#','#...#...#','###.#.###']},
 {name:'Wall segment',tiles:['#####']},
];
/** Floor tiles that cannot be walked to from arrival (the layout check rejects these). */
export function unreachableTiles(f:Pick<CustomFloor,'tiles'|'spawn'>):Set<string>{
 const h=f.tiles.length,w=f.tiles[0].length,seen=new Set<string>([`${f.spawn.x},${f.spawn.y}`]),q=[f.spawn];
 for(const p of q)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,k=`${x},${y}`;if(x>=0&&y>=0&&x<w&&y<h&&f.tiles[y][x]==='.'&&!seen.has(k)){seen.add(k);q.push({x,y});}}
 const out=new Set<string>();f.tiles.forEach((r,y)=>[...r].forEach((c,x)=>{if(c==='.'&&!seen.has(`${x},${y}`))out.add(`${x},${y}`);}));return out;
}
/** Wall off unreachable floor, keeping marker tiles. */
export function sealUnreachable(f:CustomFloor):string[]{const cut=unreachableTiles(f),busy=occupiedTiles(f);return f.tiles.map((r,y)=>[...r].map((c,x)=>cut.has(`${x},${y}`)&&!busy.has(`${x},${y}`)?'#':c).join(''));}
