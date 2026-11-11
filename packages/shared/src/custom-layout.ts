import {validateExitRule,type ExitRule} from './exit-rules';
import {validateDevices,wellFormedId,type Device} from './mechanisms';
import {validateTuning,type EncounterTuning} from './encounter-tuning';
import {validateFeatures,validateTide,depthReachable,featureCatalog,type Feature,type Tide} from './depth-components';
export type FloorLink={id:string;x:number;y:number;to:number;require_clear:boolean};
export type CustomFloor = {
 exit_rule?:ExitRule;
 devices?:Device[];
 tuning?:EncounterTuning[];
 links?:FloorLink[];
 features?:Feature[];
 tide?:Tide;
 tiles:string[];
 spawn:{x:number;y:number};
 exit:{x:number;y:number};
 sockets:{x:number;y:number}[];
};
export type FloorFormat=boolean|'sized'|'graph'|'tuned'|'mechanisms'|'missions'|'depth'|'keys';
const MAX_MODULE_BYTES=2048;
const rank=(f:FloorFormat)=>f===false?0:f===true?1:({sized:2,graph:3,tuned:4,mechanisms:5,missions:6,depth:7,keys:8} as const)[f];
const prefixes:[FloorFormat,string][]=[['keys','custom13:'],['depth','custom12:'],['missions','custom11:'],['mechanisms','custom10:'],['tuned','custom7:'],['graph','custom6:'],['sized','custom5:'],[true,'custom4:'],[false,'custom:']];
export const moduleByteLimit=(f:FloorFormat)=>f==='depth'||f==='keys'?6144:rank(f)>=4?4096:MAX_MODULE_BYTES;
function formatOf(module:string):FloorFormat|undefined{return prefixes.find(([,p])=>module.startsWith(p))?.[0];}
/** The most specific format whose optional sections a floor declares (used for unversioned shared paths). */
export function floorFormat(f:CustomFloor):FloorFormat{return f.features?.some(x=>(featureCatalog[x.kind]?.since??12)>=13)?'keys':f.features!==undefined||f.tide!==undefined?'depth':f.exit_rule!==undefined?'missions':f.devices!==undefined?'mechanisms':f.tuning!==undefined?'tuned':f.links!==undefined?'graph':'sized';}

/** Validate untrusted JSON data without throwing. Coordinates use four-way connectivity. */
export function validateCustomFloor(value:unknown, flexible:FloorFormat=false):string[]{
 try {
  if(!value||typeof value!=='object'||Array.isArray(value))return ['Floor must be an object'];
  const f=value as CustomFloor,errors:string[]=[],r=rank(flexible),depth=r>=7;
  const height=Array.isArray(f.tiles)?f.tiles.length:0,width=typeof f.tiles?.[0]==='string'?f.tiles[0].length:0;
  const sized=r>=2;
  const validTiles=Array.isArray(f.tiles)&&(sized?height>=5&&height<=31&&width>=5&&width<=31:height===9&&width===13)&&Array.from(f.tiles).every(row=>typeof row==='string'&&row.length===width&&/^[#.]+$/.test(row));
  if(!validTiles)errors.push(sized?'Tiles must be a rectangle with each dimension from 5 to 31, using # or .':'Tiles must be nine rows of thirteen # or . characters');
  else if(f.tiles.some((row,y)=>[...row].some((tile,x)=>(y===0||y===height-1||x===0||x===width-1)&&tile!=='#')))errors.push('Floor boundary must be closed');
  if(!Array.isArray(f.sockets)||(flexible?f.sockets.length>16:f.sockets.length!==4))errors.push(flexible?'At most sixteen encounters per floor':'Exactly four sockets are required');
  const graph=flexible==='graph'||r>=4&&f.links!==undefined;
  if(r>=6)errors.push(...validateExitRule(f.exit_rule));
  if(r>=5)errors.push(...validateDevices(f.devices));
  if(r>=4)errors.push(...validateTuning(f.tuning,Array.isArray(f.sockets)?f.sockets.length:0));
  if(depth)errors.push(...validateTide(f.tide));
  if(graph&&(!Array.isArray(f.links)||f.links.length>8||f.links.some(l=>!l||typeof l.id!=='string'||!wellFormedId(l.id)||!l.id.length||new TextEncoder().encode(l.id).length>32||!Number.isInteger(l.to)||l.to<0||typeof l.require_clear!=='boolean')||new Set(f.links.map(l=>l.id)).size!==f.links.length))errors.push('Connections need unique IDs, target floors and a clear-room rule; at most eight per floor');
  const points=[f.spawn,f.exit,...(r>=5&&Array.isArray(f.devices)?f.devices:[]),...(Array.isArray(f.sockets)?f.sockets:[]),...(graph&&Array.isArray(f.links)?f.links:[])];
  const occupied=new Set<string>();
  for(const p of points){
   if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=width||p.y<0||p.y>=height){errors.push('Positions must be integer coordinates within the floor');continue;}
   const key=`${p.x},${p.y}`;
   if(occupied.has(key))errors.push('Spawn, exit and sockets must have unique positions');
   occupied.add(key);
   if(validTiles&&f.tiles[p.y][p.x]!=='.')errors.push('All positions must be traversable');
  }
  if(depth)errors.push(...(validTiles?validateFeatures(f.features,f.tiles,occupied,r>=8?13:12):['Features need valid tiles.']));
  if(errors.length)return errors;
  if(depth){const {missing}=depthReachable(f.tiles,f.spawn,f.features!);if(missing)errors.push('All floor tiles must be reachable from spawn (cracked walls and kegs can be broken; chasms block)');return errors;}
  const queue=[f.spawn],seen=new Set([`${f.spawn.x},${f.spawn.y}`]);
  for(const p of queue)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;
   if(f.tiles[y]?.[x]==='.'&&!seen.has(key)){seen.add(key);queue.push({x,y});}
  }
  if(f.tiles.join('').split('.').length-1!==seen.size)errors.push('All floor tiles must be connected to spawn');
  return errors;
 }catch{return ['Invalid floor data'];}
}
export function encodeCustomModule(floor:CustomFloor, flexible:FloorFormat=false):string{
 const errors=validateCustomFloor(floor,flexible);if(errors.length)throw Error(errors.join('; '));
 const r=rank(flexible);
 // Only serialize the authored schema, never caller metadata.
 const point=({x,y}:{x:number;y:number})=>({x,y});
 const module=prefixes.find(([f])=>f===flexible)![1]+JSON.stringify({tiles:floor.tiles,spawn:point(floor.spawn),exit:point(floor.exit),sockets:floor.sockets.map(point),...(flexible==='graph'||r>=4&&floor.links!==undefined?{links:floor.links?.map(l=>({id:l.id,x:l.x,y:l.y,to:l.to,require_clear:l.require_clear}))}:{}),...(r>=4?{tuning:floor.tuning}:{}),...(r>=5?{devices:structuredClone(floor.devices)}:{}),...(r>=6?{exit_rule:structuredClone(floor.exit_rule)}:{}),...(r>=7?{features:structuredClone(floor.features),...(floor.tide!==undefined?{tide:{turns:floor.tide.turns,damage:floor.tide.damage}}:{})}:{})});
 if(new TextEncoder().encode(module).length>moduleByteLimit(flexible))throw Error(`Custom module exceeds ${moduleByteLimit(flexible)} bytes`);
 return module;
}
export function decodeCustomModule(module:string):CustomFloor{
 const format=typeof module==='string'?formatOf(module):undefined;
 if(format===undefined||new TextEncoder().encode(module).length>moduleByteLimit(format))throw Error('Invalid custom module prefix or length');
 const floor:unknown=JSON.parse(module.slice(module.indexOf(':')+1));const errors=validateCustomFloor(floor,format);
 if(errors.length)throw Error(errors.join('; '));
 const r=rank(format);
 const f=floor as CustomFloor;return {tiles:f.tiles,spawn:f.spawn,exit:f.exit,sockets:f.sockets,...(r>=3&&f.links!==undefined?{links:f.links}:{}),...(r>=4?{tuning:f.tuning}:{}),...(r>=5?{devices:f.devices}:{}),...(r>=6?{exit_rule:f.exit_rule}:{}),...(r>=7?{features:f.features,...(f.tide!==undefined?{tide:f.tide}:{})}:{})};
}

/** Validate cross-floor graph references independently of publication/economic terms. */
export function validateFloorGraph(floors:readonly CustomFloor[]):string[]{
 if(!floors.some(f=>f.links!==undefined))return [];
 if(floors.some(f=>!Array.isArray(f.links)))return ['Every connected floor must declare its connections.'];
 if(floors.some(f=>f.links!.some(l=>!Number.isInteger(l.to)||l.to<0||l.to>=floors.length)))return ['A connection targets a missing floor.'];
 const reached=new Set([0]),queue=[0];for(const from of queue)for(const link of floors[from].links!){if(!reached.has(link.to)){reached.add(link.to);queue.push(link.to);}}
 return reached.size===floors.length?[]:['Every floor must be reachable from the entrance through connections.'];
}
