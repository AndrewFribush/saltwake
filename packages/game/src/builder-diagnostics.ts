import {validateCustomFloor,floorFormat,type CustomFloor} from '../../shared/src/custom-layout';
import {depthReachable} from '../../shared/src/depth-components';
export type FloorDiagnostic={message:string;at?:{x:number;y:number}};
/** Editor repair hints; authoritative structural validation remains the shared validator. */
export function floorDiagnostics(value:unknown):FloorDiagnostic[]{
 const errors=validateCustomFloor(value,value&&typeof value==='object'&&!Array.isArray(value)?floorFormat(value as CustomFloor):'sized');if(!errors.length)return [];
 if(!value||typeof value!=='object')return errors.map(message=>({message}));
 const f=value as CustomFloor;const issues:FloorDiagnostic[]=[];
 const height=f.tiles?.length??0,width=f.tiles?.[0]?.length??0;
 const point=(p:any):p is {x:number;y:number}=>!!p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<width&&p.y>=0&&p.y<height;
 const valid=Array.isArray(f.tiles)&&height>=5&&height<=31&&width>=5&&width<=31&&f.tiles.every(r=>typeof r==='string'&&r.length===width&&/^[#.]+$/.test(r));
 if(!valid)return errors.map(message=>({message}));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if((x===0||x===width-1||y===0||y===height-1)&&f.tiles[y][x]!== '#')issues.push({message:`Close the boundary at column ${x}, row ${y} with a wall.`,at:{x,y}});
 const markers=[...(Array.isArray(f.devices)?f.devices.map(d=>({name:`${d.kind} ${d.channel}`,p:d})):[]),...(Array.isArray(f.links)?f.links.map(l=>({name:`Connection ${l.id}`,p:l})):[]),{name:'Arrival',p:f.spawn},{name:'Exit',p:f.exit},...(Array.isArray(f.sockets)?f.sockets.map((p,i)=>({name:`Socket ${i}`,p})):[])];
 const occupied=new Map<string,string>();
 for(const {name,p} of markers){if(!point(p))continue;const key=`${p.x},${p.y}`;
  if(f.tiles[p.y][p.x]!=='.')issues.push({message:`${name} is on a wall. Paint floor here or move the marker.`,at:{...p}});
  if(occupied.has(key))issues.push({message:`${name} overlaps ${occupied.get(key)}. Move one marker to another floor tile.`,at:{...p}});
  occupied.set(key,name);
 }
 if(Array.isArray(f.features)&&point(f.spawn)){const {missing,first}=depthReachable(f.tiles,f.spawn,f.features.filter(x=>x&&typeof x==='object'));if(first)issues.push({message:`${missing} floor tiles cannot be reached from arrival, even through cracked walls. Connect them, add a cracked wall, or remove a chasm.`,at:first});}
 else if(point(f.spawn)&&f.tiles[f.spawn.y][f.spawn.x]==='.'){
  const q=[f.spawn],seen=new Set([`${f.spawn.x},${f.spawn.y}`]);
  for(const p of q)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy},key=`${n.x},${n.y}`;if(f.tiles[n.y]?.[n.x]==='.'&&!seen.has(key)){seen.add(key);q.push(n);}}
  let first:{x:number;y:number}|undefined,count=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(f.tiles[y][x]==='.'&&!seen.has(`${x},${y}`)){first??={x,y};count++;}
  if(first)issues.push({message:`${count} floor tiles cannot be reached from arrival. Connect this area with a corridor or remove unused floor.`,at:first});
 }
 // Keep every authoritative rejection visible, including malformed marker arrays.
 return [...issues,...errors.map(message=>({message}))];
}
