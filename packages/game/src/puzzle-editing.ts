// One place to build puzzles: plates, keys, locks, switches, gates and walk-on passages share the
// same placement rules here, so the builder's Puzzle panel needs no per-kind tab. Data formats are unchanged:
// plates/keys/locks are v13 features, switches/gates are devices, passages are floor links.
import type {CustomFloor,FloorLink} from '../../shared/src/custom-layout';
import {defaultFeature,maxFeaturesPerFloor,maxFeaturesTotal,type Feature} from '../../shared/src/depth-components';
import {validChannel,type Device} from '../../shared/src/mechanisms';
type P={x:number;y:number};
export type PuzzlePiece='plate'|'clock'|'key'|'lock'|'switch'|'door'|'passage';
export const puzzlePieces:Record<PuzzlePiece,{name:string;glyph:string;summary:string}>={
 plate:{name:'Pressure plate',glyph:'▫',summary:'Its channel is on while any creature stands on it. Lure or shove an enemy onto it to hold a gate open.'},
 clock:{name:'Tide clock',glyph:'◷',summary:'Rules v14. Its channel is on for some turns of every cycle: wire a gate to it for a timed door, or an exit condition for a timed exit.'},
 switch:{name:'Switch / lever',glyph:'⚡',summary:'Stepping on it toggles, sets or clears its channel. Channels persist across floors.'},
 door:{name:'Gate',glyph:'▣',summary:'Blocks movement and sight unless its channel matches “opens when”. Wire it to a plate or switch with the same channel.'},
 key:{name:'Key',glyph:'⚷',summary:'Picked up on contact; opens one lock of the same colour on any floor.'},
 lock:{name:'Locked door',glyph:'🔒',summary:'Bump it holding a matching key to open it for good; the key is used up.'},
 passage:{name:'Passage',glyph:'↪',summary:'Walk onto it to travel to another floor. With no passage back it is a one-way drop.'},
};
export type PuzzleThing={kind:'feature';feature:Feature}|{kind:'device';device:Device}|{kind:'passage';link:FloorLink};
const puzzleFeatures=new Set(['plate','clock','key','lock']);
export function puzzleAt(floor:CustomFloor,x:number,y:number):PuzzleThing|null{
 const f=(floor.features??[]).find(f=>f.x===x&&f.y===y&&puzzleFeatures.has(f.kind));if(f)return {kind:'feature',feature:f};
 const d=(floor.devices??[]).find(d=>d.x===x&&d.y===y);if(d)return {kind:'device',device:d};
 const l=(floor.links??[]).find(l=>l.x===x&&l.y===y);return l?{kind:'passage',link:l}:null;
}
export type PlaceOptions={id:string;channel:string;color:string;mode:'toggle'|'set'|'clear';openWhen:boolean;to:number;requireClear:boolean};
/** Place a puzzle piece on a free floor tile (mutates the floor). Returns a repair hint instead when it cannot. */
export function placePuzzlePiece(floors:CustomFloor[],index:number,piece:PuzzlePiece,x:number,y:number,o:PlaceOptions):string|null{
 const floor=floors[index];if(!floor)return 'Missing floor.';
 if(floor.tiles[y]?.[x]!=='.')return 'Puzzle pieces go on floor tiles.';
 const taken=[floor.spawn,floor.exit,...floor.sockets,...(floor.devices??[]),...(floor.features??[]),...(floor.links??[])].some(p=>p.x===x&&p.y===y);
 if(taken)return 'That tile already holds something. Pick a free floor tile.';
 if(piece==='plate'||piece==='clock'||piece==='key'||piece==='lock'){
  if((floor.features??[]).length>=maxFeaturesPerFloor||floors.reduce((n,f)=>n+(f.features?.length??0),0)>=maxFeaturesTotal)return `Use at most ${maxFeaturesPerFloor} features per floor and ${maxFeaturesTotal} in all.`;
  if((piece==='plate'||piece==='clock')&&!validChannel(o.channel))return 'Channels start with a letter, then letters, digits, _ or -.';
  if((piece==='key'||piece==='lock')&&!o.color.trim())return 'Give the key or lock a colour name.';
  const f={...defaultFeature(piece,o.id,x,y),...(piece==='plate'||piece==='clock'?{channel:o.channel}:{color:o.color.trim()})} as Feature;
  (floor.features??=[]).push(f);return null;
 }
 if(piece==='switch'||piece==='door'){
  if((floor.devices??[]).length>=16||floors.reduce((n,f)=>n+(f.devices?.length??0),0)>=64)return 'Use at most 16 switches and gates per floor and 64 in all.';
  if(!validChannel(o.channel))return 'Channels start with a letter, then letters, digits, _ or -.';
  floor.tuning??=[];(floor.devices??=[]).push(piece==='switch'?{id:o.id,x,y,channel:o.channel,kind:'switch',mode:o.mode}:{id:o.id,x,y,channel:o.channel,kind:'door',open_when:o.openWhen});return null;
 }
 if(!floor.links)return 'Passages need connected rooms: turn them on first (this replaces automatic next-floor stairs).';
 if(floor.links.length>=8)return 'Use at most 8 passages per floor.';
 if(!Number.isInteger(o.to)||o.to<0||o.to>=floors.length)return 'Choose a destination floor.';
 floor.links.push({id:o.id,x,y,to:o.to,require_clear:o.requireClear});return null;
}
export function removePuzzleThing(floor:CustomFloor,thing:PuzzleThing){
 if(thing.kind==='feature')floor.features=(floor.features??[]).filter(f=>f.id!==thing.feature.id);
 else if(thing.kind==='device')floor.devices=(floor.devices??[]).filter(d=>d.id!==thing.device.id);
 else floor.links=(floor.links??[]).filter(l=>l.id!==thing.link.id);
}
/** Turn on connected rooms for every floor, keeping the old order as stairs: a passage beside each exit to the next floor. */
export function connectRooms(floors:CustomFloor[]){
 floors.forEach((f,i)=>{if(f.links)return;f.links=[];if(i+1>=floors.length)return;
  const taken=new Set([f.spawn,f.exit,...f.sockets,...(f.devices??[]),...(f.features??[])].map(p=>`${p.x},${p.y}`));
  const p=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:f.exit.x+dx,y:f.exit.y+dy})).find(p=>f.tiles[p.y]?.[p.x]==='.'&&!taken.has(`${p.x},${p.y}`));
  if(p)f.links.push({id:`stairs${i}`,...p,to:i+1,require_clear:false});});
}
/** A passage is one-way when its destination floor has no passage back to where it starts. */
export const oneWay=(floors:readonly CustomFloor[],from:number,link:FloorLink)=>link.to!==from&&!(floors[link.to]?.links??[]).some(l=>l.to===from);
/** Sealed arena: arrivals cannot walk back; extraction opens only when every enemy is down. */
export function isSealedArena(floors:readonly CustomFloor[],index:number){
 const f=floors[index];if(!f?.links||index===0)return false;
 const incoming=floors.flatMap((g,i)=>(g.links??[]).filter(l=>l.to===index).map(()=>i));
 return incoming.length>0&&incoming.every(i=>!(f.links??[]).some(l=>l.to===i))&&f.exit_rule?.require_clear===true&&f.exit_rule.extract;
}
export function makeSealedArena(floors:CustomFloor[],index:number){
 const f=floors[index];const incoming=new Set(floors.flatMap((g,i)=>(g.links??[]).some(l=>l.to===index)?[i]:[]));
 f.links=(f.links??[]).filter(l=>!incoming.has(l.to)).map(l=>({...l,require_clear:true}));
 f.exit_rule={extract:true,require_clear:true,...(f.exit_rule?.channel!==undefined?{channel:f.exit_rule.channel,value:f.exit_rule.value}:{})};
}
/** Connected floors a player can get stuck on: no passage out and no extraction. */
export function deadEndFloors(floors:readonly CustomFloor[]):number[]{
 if(!floors.some(f=>f.links))return [];
 return floors.flatMap((f,i)=>!(f.links??[]).some(l=>l.to!==i)&&!(f.exit_rule?.extract??true)?[i]:[]);
}
export type ChannelWiring={channel:string;plates:P[];switches:(P&{mode:string;floor:number})[];doors:(P&{openWhen:boolean})[];exit:boolean;issues:string[]};
/** How each channel used on a floor is wired, with plain-language problems. Switches on other floors count. */
export function channelWiring(floors:readonly CustomFloor[],index:number):ChannelWiring[]{
 const f=floors[index];if(!f)return [];
 const local=new Set([...(f.devices??[]).map(d=>d.channel),...(f.features??[]).flatMap(x=>x.kind==='plate'||x.kind==='clock'?[x.channel]:[]),...(f.exit_rule?.channel!==undefined?[f.exit_rule.channel]:[])]);
 return [...local].sort().map(channel=>{
  const plates=floors.flatMap(g=>(g.features??[]).flatMap(x=>(x.kind==='plate'||x.kind==='clock')&&x.channel===channel?[{x:x.x,y:x.y}]:[]));
  const switches=floors.flatMap((g,i)=>(g.devices??[]).flatMap(d=>d.kind==='switch'&&d.channel===channel?[{x:d.x,y:d.y,mode:d.mode,floor:i}]:[]));
  const doors=(f.devices??[]).flatMap(d=>d.kind==='door'&&d.channel===channel?[{x:d.x,y:d.y,openWhen:d.open_when}]:[]);
  const exit=f.exit_rule?.channel===channel,issues:string[]=[];
  const drivers=plates.length+switches.length,users=floors.reduce((n,g)=>n+(g.devices??[]).filter(d=>d.kind==='door'&&d.channel===channel).length+(g.exit_rule?.channel===channel?1:0),0);
  if(!drivers)issues.push('Nothing drives this channel: add a plate or switch with the same name.');
  if(!users)issues.push('Nothing listens to this channel: add a gate or an exit condition with the same name.');
  if(plates.length&&switches.length)issues.push('A plate or clock rewrites this channel every turn, so switches on it are overridden.');
  return {channel,plates:floors[index].features?.flatMap(x=>(x.kind==='plate'||x.kind==='clock')&&x.channel===channel?[{x:x.x,y:x.y}]:[])??[],switches:switches.filter(s=>s.floor===index),doors,exit,issues};
 });
}
