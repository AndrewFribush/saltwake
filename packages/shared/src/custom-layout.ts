import {validateExitRule,type ExitRule} from './exit-rules';
import {validateDevices,wellFormedId,type Device} from './mechanisms';
import {validateTuning,type EncounterTuning} from './encounter-tuning';
export type FloorLink={id:string;x:number;y:number;to:number;require_clear:boolean};
export type CustomFloor = {
 exit_rule?:ExitRule;
 devices?:Device[];
 tuning?:EncounterTuning[];
 links?:FloorLink[];
 tiles:string[];
 spawn:{x:number;y:number};
 exit:{x:number;y:number};
 sockets:{x:number;y:number}[];
};
const MAX_MODULE_BYTES=2048;

/** Validate untrusted JSON data without throwing. Coordinates use four-way connectivity. */
export function validateCustomFloor(value:unknown, flexible:boolean|'sized'|'graph'|'tuned'|'mechanisms'|'missions'=false):string[]{
 try {
  if(!value||typeof value!=='object'||Array.isArray(value))return ['Floor must be an object'];
  const f=value as CustomFloor,errors:string[]=[];
  const height=Array.isArray(f.tiles)?f.tiles.length:0,width=typeof f.tiles?.[0]==='string'?f.tiles[0].length:0;
  const sized=flexible==='sized'||flexible==='graph'||flexible==='tuned'||(flexible==='mechanisms'||flexible==='missions');
  const validTiles=Array.isArray(f.tiles)&&(sized?height>=5&&height<=31&&width>=5&&width<=31:height===9&&width===13)&&Array.from(f.tiles).every(row=>typeof row==='string'&&row.length===width&&/^[#.]+$/.test(row));
  if(!validTiles)errors.push(sized?'Tiles must be a rectangle with each dimension from 5 to 31, using # or .':'Tiles must be nine rows of thirteen # or . characters');
  else if(f.tiles.some((row,y)=>[...row].some((tile,x)=>(y===0||y===height-1||x===0||x===width-1)&&tile!=='#')))errors.push('Floor boundary must be closed');
  if(!Array.isArray(f.sockets)||(flexible?f.sockets.length>16:f.sockets.length!==4))errors.push(flexible?'At most sixteen encounters per floor':'Exactly four sockets are required');
  const graph=flexible==='graph'||(flexible==='tuned'||(flexible==='mechanisms'||flexible==='missions'))&&f.links!==undefined;
  if(flexible==='missions')errors.push(...validateExitRule(f.exit_rule));
  if((flexible==='mechanisms'||flexible==='missions'))errors.push(...validateDevices(f.devices));
  if(flexible==='tuned'||(flexible==='mechanisms'||flexible==='missions'))errors.push(...validateTuning(f.tuning,Array.isArray(f.sockets)?f.sockets.length:0));
  if(graph&&(!Array.isArray(f.links)||f.links.length>8||f.links.some(l=>!l||typeof l.id!=='string'||!wellFormedId(l.id)||!l.id.length||new TextEncoder().encode(l.id).length>32||!Number.isInteger(l.to)||l.to<0||typeof l.require_clear!=='boolean')||new Set(f.links.map(l=>l.id)).size!==f.links.length))errors.push('Connections need unique IDs, target floors and a clear-room rule; at most eight per floor');
  const points=[f.spawn,f.exit,...((flexible==='mechanisms'||flexible==='missions')&&Array.isArray(f.devices)?f.devices:[]),...(Array.isArray(f.sockets)?f.sockets:[]),...(graph&&Array.isArray(f.links)?f.links:[])];
  const occupied=new Set<string>();
  for(const p of points){
   if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=width||p.y<0||p.y>=height){errors.push('Positions must be integer coordinates within the floor');continue;}
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
export function encodeCustomModule(floor:CustomFloor, flexible:boolean|'sized'|'graph'|'tuned'|'mechanisms'|'missions'=false):string{
 const errors=validateCustomFloor(floor,flexible);if(errors.length)throw Error(errors.join('; '));
 // Only serialize the authored schema, never caller metadata.
 const point=({x,y}:{x:number;y:number})=>({x,y});
 const module=(flexible==='missions'?'custom11:':flexible==='mechanisms'?'custom10:':flexible==='tuned'?'custom7:':flexible==='graph'?'custom6:':flexible==='sized'?'custom5:':flexible?'custom4:':'custom:')+JSON.stringify({tiles:floor.tiles,spawn:point(floor.spawn),exit:point(floor.exit),sockets:floor.sockets.map(point),...(flexible==='graph'||(flexible==='tuned'||(flexible==='mechanisms'||flexible==='missions'))&&floor.links!==undefined?{links:floor.links?.map(l=>({id:l.id,x:l.x,y:l.y,to:l.to,require_clear:l.require_clear}))}:{}),...((flexible==='tuned'||(flexible==='mechanisms'||flexible==='missions'))?{tuning:floor.tuning}:{}),...((flexible==='mechanisms'||flexible==='missions')?{devices:structuredClone(floor.devices)}:{}),...(flexible==='missions'?{exit_rule:structuredClone(floor.exit_rule)}:{})});
 if(new TextEncoder().encode(module).length>((flexible==='tuned'||(flexible==='mechanisms'||flexible==='missions'))?4096:MAX_MODULE_BYTES))throw Error(`Custom module exceeds ${(flexible==='tuned'||(flexible==='mechanisms'||flexible==='missions'))?4096:2048} bytes`);
 return module;
}
export function decodeCustomModule(module:string):CustomFloor{
 if(typeof module!=='string'||!(module.startsWith('custom:')||module.startsWith('custom4:')||module.startsWith('custom5:')||module.startsWith('custom6:')||module.startsWith('custom7:')||(module.startsWith('custom10:')||module.startsWith('custom11:')))||new TextEncoder().encode(module).length>((module.startsWith('custom7:')||(module.startsWith('custom10:')||module.startsWith('custom11:')))?4096:MAX_MODULE_BYTES))throw Error('Invalid custom module prefix or length');
 const floor:unknown=JSON.parse(module.slice(module.indexOf(':')+1));const errors=validateCustomFloor(floor,module.startsWith('custom11:')?'missions':module.startsWith('custom10:')?'mechanisms':module.startsWith('custom7:')?'tuned':module.startsWith('custom6:')?'graph':module.startsWith('custom5:')?'sized':module.startsWith('custom4:'));
 if(errors.length)throw Error(errors.join('; '));
 const f=floor as CustomFloor;return {tiles:f.tiles,spawn:f.spawn,exit:f.exit,sockets:f.sockets,...((module.startsWith('custom6:')||module.startsWith('custom7:')||(module.startsWith('custom10:')||module.startsWith('custom11:')))&&f.links!==undefined?{links:f.links}:{}),...((module.startsWith('custom7:')||(module.startsWith('custom10:')||module.startsWith('custom11:')))?{tuning:f.tuning}:{}),...((module.startsWith('custom10:')||module.startsWith('custom11:'))?{devices:f.devices}:{}),...(module.startsWith('custom11:')?{exit_rule:f.exit_rule}:{})};
}

/** Validate cross-floor graph references independently of publication/economic terms. */
export function validateFloorGraph(floors:readonly CustomFloor[]):string[]{
 if(!floors.some(f=>f.links!==undefined))return [];
 if(floors.some(f=>!Array.isArray(f.links)))return ['Every connected floor must declare its connections.'];
 if(floors.some(f=>f.links!.some(l=>!Number.isInteger(l.to)||l.to<0||l.to>=floors.length)))return ['A connection targets a missing floor.'];
 const reached=new Set([0]),queue=[0];for(const from of queue)for(const link of floors[from].links!){if(!reached.has(link.to)){reached.add(link.to);queue.push(link.to);}}
 return reached.size===floors.length?[]:['Every floor must be reachable from the entrance through connections.'];
}
