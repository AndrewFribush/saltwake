export type CustomFloor = {
 tiles:string[];
 spawn:{x:number;y:number};
 exit:{x:number;y:number};
 sockets:{x:number;y:number}[];
};
const MAX_MODULE_BYTES=2048;

/** Validate untrusted JSON data without throwing. Coordinates use four-way connectivity. */
export function validateCustomFloor(value:unknown):string[]{
 try {
  if(!value||typeof value!=='object'||Array.isArray(value))return ['Floor must be an object'];
  const f=value as CustomFloor,errors:string[]=[];
  const validTiles=Array.isArray(f.tiles)&&f.tiles.length===9&&Array.from(f.tiles).every(row=>typeof row==='string'&&/^[#.]{13}$/.test(row));
  if(!validTiles)errors.push('Tiles must be nine rows of thirteen # or . characters');
  else if(f.tiles.some((row,y)=>[...row].some((tile,x)=>(y===0||y===8||x===0||x===12)&&tile!=='#')))errors.push('Floor boundary must be closed');
  if(!Array.isArray(f.sockets)||f.sockets.length!==4)errors.push('Exactly four sockets are required');
  const points=[f.spawn,f.exit,...(Array.isArray(f.sockets)?f.sockets:[])];
  const occupied=new Set<string>();
  for(const p of points){
   if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=13||p.y<0||p.y>=9){errors.push('Positions must be integer coordinates within the floor');continue;}
   const key=`${p.x},${p.y}`;
   if(occupied.has(key))errors.push('Spawn, exit and sockets must have unique positions');
   occupied.add(key);
   if(validTiles&&f.tiles[p.y][p.x]!=='.')errors.push('All positions must be traversable');
  }
  if(errors.length)return errors;
  const queue=[f.spawn],seen=new Set([`${f.spawn.x},${f.spawn.y}`]);
  for(const p of queue)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;
   if(f.tiles[y]?.[x]==='.'&&!seen.has(key)){seen.add(key);queue.push({x,y});}
  }
  if(f.tiles.join('').split('.').length-1!==seen.size)errors.push('All floor tiles must be connected to spawn');
  return errors;
 }catch{return ['Invalid floor data'];}
}
export function encodeCustomModule(floor:CustomFloor):string{
 const errors=validateCustomFloor(floor);if(errors.length)throw Error(errors.join('; '));
 // Only serialize the authored schema, never caller metadata.
 const point=({x,y}:{x:number;y:number})=>({x,y});
 const module='custom:'+JSON.stringify({tiles:floor.tiles,spawn:point(floor.spawn),exit:point(floor.exit),sockets:floor.sockets.map(point)});
 if(new TextEncoder().encode(module).length>MAX_MODULE_BYTES)throw Error('Custom module exceeds 2048 bytes');
 return module;
}
export function decodeCustomModule(module:string):CustomFloor{
 if(typeof module!=='string'||!module.startsWith('custom:')||new TextEncoder().encode(module).length>MAX_MODULE_BYTES)throw Error('Invalid custom module prefix or length');
 const floor:unknown=JSON.parse(module.slice(7));const errors=validateCustomFloor(floor);
 if(errors.length)throw Error(errors.join('; '));
 return floor as CustomFloor;
}
