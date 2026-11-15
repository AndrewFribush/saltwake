import {isDescent,linkSide,dirs,opposite} from './level-map';
import {signalValue} from '../../shared/src/mechanisms';
import {clockOn} from '../../shared/src/depth-components';
import rooms from '../../../content/rooms.json';
import {createRun,walkable,type RunState,type Enemy} from './state';
import {addItem} from './inventory';
import {revealIntents} from './combat';
export function enterRoom(s:RunState,index:number):boolean{
 const r=(s.layout??rooms)[index] as import('./state').RoomLayout;if(!r)throw Error('Missing room');
 const graph=r.links!==undefined;
 const remembered=graph&&s.roomMemory?(index===s.roomIndex?{enemies:s.enemies,traps:s.traps,features:s.features,tiles:s.room,tideTurns:s.tideTurns}:s.roomMemory[index]):undefined;
 const enemies=structuredClone(remembered?.enemies??r.enemies) as Enemy[],traps=structuredClone(remembered?.traps??r.traps);
 const features=r.features!==undefined?structuredClone(remembered?.features??r.features):undefined,tiles=[...(remembered?.tiles??r.tiles)];
 const target={...s,room:tiles,devices:r.devices,features};
 // Arrive just inside the passage that leads back where you came from, so neighbouring rooms join up on the map;
 // stairs and rooms without a way back still start at the arrival marker.
 const back=graph&&index!==s.roomIndex?r.links!.find(l=>l.to===s.roomIndex&&!isDescent(l.id)):undefined;
 let arrival={...r.spawn};
 if(back){const [ix,iy]=dirs[opposite[linkSide(r,back)]];const onLink=(p:{x:number;y:number})=>r.links!.some(l=>l.x===p.x&&l.y===p.y);
  const inward=[{x:back.x+ix,y:back.y+iy},...Object.values(dirs).map(([dx,dy])=>({x:back.x+dx,y:back.y+dy}))].find(p=>walkable(target,p)&&!onLink(p));
  arrival=inward??{x:back.x,y:back.y};}
 if(graph&&enemies.some(e=>e.x===arrival.x&&e.y===arrival.y)){
  const queue=[arrival],seen=new Set([`${arrival.x},${arrival.y}`]);let free:typeof arrival|undefined;
  for(const p of queue){if(walkable(target,p)&&!enemies.some(e=>e.x===p.x&&e.y===p.y)){free=p;break;}for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(walkable(target,{x,y})&&!seen.has(key)){seen.add(key);queue.push({x,y});}}}
  if(!free){s.log.push('Passage blocked: no free arrival tile.');return false;}arrival=free;
 }
 if(graph&&s.roomMemory)s.roomMemory[s.roomIndex]={enemies:structuredClone(s.enemies),traps:structuredClone(s.traps),...(s.features!==undefined?{features:structuredClone(s.features),tiles:[...s.room],tideTurns:s.tideTurns??0}:{})};
 if(r.exitRule!==undefined)s.exitRule=structuredClone(r.exitRule);else delete s.exitRule;
 if(r.devices!==undefined)s.devices=structuredClone(r.devices);else delete s.devices;
 if(features!==undefined){s.depth=true;s.features=features;delete s.blasts;if(r.tide){s.tide={...r.tide};s.tideTurns=remembered?.tideTurns??0;}else{delete s.tide;delete s.tideTurns;}}else{delete s.features;delete s.tide;delete s.tideTurns;}
 s.floorTurn=0;for(const f of features??[])if(f.kind==='clock'){s.signals??={};s.signals[f.channel]=clockOn(f,0);}
 s.roomIndex=index;s.room=tiles;s.player.x=arrival.x;s.player.y=arrival.y;s.enemies=enemies;s.traps=traps;
 if(graph){s.roomMemory??={};s.connections=structuredClone(r.links!);}else delete s.connections;
 revealIntents(s);s.log.push(`Entered ${r.title}.`);return true;
}

export function atClearedExit(s:RunState){const r=(s.layout??rooms)[s.roomIndex];return !!r&&!s.enemies.length&&s.player.x===r.exit.x&&s.player.y===r.exit.y;}
export const roomTitle=(s:RunState)=>(s.layout??rooms)[s.roomIndex]?.title??'Practice room';
export const roomExit=(s:RunState)=>(s.layout??rooms)[s.roomIndex]?.exit;
/** The stairs of this room: in a connected layout, the descent passage; in a linear one, the next floor. */
export const descentLink=(s:RunState)=>s.connections?.find(l=>isDescent(l.id)&&l.to!==s.roomIndex&&(!l.require_clear||!s.enemies.length));
export const hasNextRoom=(s:RunState)=>s.connections===undefined?s.roomIndex+1<(s.layout??rooms).length:descentLink(s)!==undefined;
/** Where the stairs lead when the player continues from the exit tile. */
export const nextRoomIndex=(s:RunState)=>descentLink(s)?.to??s.roomIndex+1;
export function practiceRun(armored=false){const s=createRun();enterRoom(s,0);
 addItem(s,{id:'town-tonic',type:'tonic',origin:'town',location:{kind:'bag'}});
 if(armored){addItem(s,{id:'town-armor',type:'armor',origin:'town',location:{kind:'armor'}});s.player.armor=true;}
 for(const [id,type,room,x,y] of [['cache-tonic','tonic',0,1,1],['cache-sword','sword',0,2,3],['cache-armor','armor',0,1,3],['deep-fine','fineTonic',1,7,4],['deep-iron','iron',1,7,5]] as const)addItem(s,{id,type,origin:'dungeon',location:{kind:'floor',room,x,y}});
 return s;
}

export function atExit(s:RunState){const r=(s.layout??rooms)[s.roomIndex];return !!r&&s.player.x===r.exit.x&&s.player.y===r.exit.y;}
export function exitReady(s:RunState){return atExit(s)&&(!s.exitRule?.require_clear||!s.enemies.length)&&(s.exitRule?.channel===undefined||signalValue(s.signals,s.exitRule.channel)===s.exitRule.value);}
export function canExtract(s:RunState){return s.status==='active'&&(s.exitRule?s.exitRule.extract&&exitReady(s):s.rulesVersion===4?atExit(s):atClearedExit(s));}
export function canContinue(s:RunState){return s.status==='active'&&hasNextRoom(s)&&(s.exitRule?exitReady(s):atClearedExit(s));}
export function exitHint(s:RunState):string{const r=s.exitRule;if(!r)return 'Clear the room and reach the exit.';return `${r.extract?'Extraction allowed':'No extraction on this floor'}. ${r.require_clear?'Defeat all enemies first.':'You may leave surviving enemies behind.'}${r.channel!==undefined?` Requires ${r.channel} ${r.value?'on':'off'} (currently ${signalValue(s.signals,r.channel)?'on':'off'}).`:''} Departure spends a turn; enemies and hazards act before you leave.`;}
