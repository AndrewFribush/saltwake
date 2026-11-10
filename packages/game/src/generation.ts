import rooms from '../../../content/rooms.json';
import {createRun,type RunState,type Enemy} from './state';
import {addItem} from './inventory';
import {revealIntents} from './combat';
export function enterRoom(s:RunState,index:number){const r=(s.layout??rooms)[index];if(!r)throw Error('Missing room');s.roomIndex=index;s.room=[...r.tiles];s.player.x=r.spawn.x;s.player.y=r.spawn.y;s.enemies=structuredClone(r.enemies) as Enemy[];s.traps=structuredClone(r.traps);revealIntents(s);s.log.push(`Entered ${r.title}.`);}
export function atClearedExit(s:RunState){const r=(s.layout??rooms)[s.roomIndex];return !!r&&!s.enemies.length&&s.player.x===r.exit.x&&s.player.y===r.exit.y;}
export const roomTitle=(s:RunState)=>(s.layout??rooms)[s.roomIndex]?.title??'Practice room';
export const roomExit=(s:RunState)=>(s.layout??rooms)[s.roomIndex]?.exit;
export const hasNextRoom=(s:RunState)=>s.roomIndex+1<(s.layout??rooms).length;
export function practiceRun(armored=false){const s=createRun();enterRoom(s,0);
 addItem(s,{id:'town-tonic',type:'tonic',origin:'town',location:{kind:'bag'}});
 if(armored){addItem(s,{id:'town-armor',type:'armor',origin:'town',location:{kind:'armor'}});s.player.armor=true;}
 for(const [id,type,room,x,y] of [['cache-tonic','tonic',0,1,1],['cache-sword','sword',0,2,3],['cache-armor','armor',0,1,3],['deep-fine','fineTonic',1,7,4],['deep-iron','iron',1,7,5]] as const)addItem(s,{id,type,origin:'dungeon',location:{kind:'floor',room,x,y}});
 return s;
}
