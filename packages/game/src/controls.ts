import type {RunState} from './state';
import type {Action} from './actions';
import {isConsumable} from './inventory';
import {visibleTiles} from './roguelike';
import {supplyTargetError} from './depth';
import type {SupplyKind} from '../../shared/src/depth-components';

/** Every run action has a key. Movement/attack: arrows or WASD. G guard · Space wait · E interact · X escape ·
 * C continue deeper · 1/2 shrine choice · Q drink · R equip · T take (when stepping did not, e.g. the bag was full) ·
 * Backspace/Delete drop the last dungeon find · B bomb, N dart (nearest valid visible enemy), F flash.
 * Shift+X is left to the host (abandon). UI-only keys (shove mode V, tabs, paging, restarts) live in the view. */
export function keyAction(s:RunState,e:{key:string;repeat?:boolean;metaKey?:boolean;ctrlKey?:boolean;altKey?:boolean;shiftKey?:boolean}):Action|null{
 if(e.repeat||e.metaKey||e.ctrlKey||e.altKey)return null;
 const key=e.key.toLowerCase();
 if(key==='g')return {type:'guard'};
 if(key===' ')return {type:'wait'};
 if(key==='e'&&s.depth)return {type:'interact'};
 if(key==='x'&&!e.shiftKey)return {type:'extract'};
 if(key==='c')return {type:'continue'};
 if(key==='1')return {type:'boon',choice:'rest'};
 if(key==='2')return {type:'boon',choice:'edge'};
 const items=Object.values(s.items),bag=items.filter(i=>i.location.kind==='bag');
 if(key==='q'){const drink=['fineTonic','tonic'].map(t=>bag.find(i=>i.type===t)).find(Boolean)??bag.find(i=>isConsumable(i.type));return drink?{type:'use',itemId:drink.id}:null;}
 if(key==='r'){const gear=equipChoice(s);return gear?{type:'equip',itemId:gear.id}:null;}
 if(key==='t'){const here=lootHere(s)[0];return here?{type:'pickup',itemId:here.id}:null;}
 if(key==='backspace'||key==='delete'){const find=[...bag].reverse().find(i=>i.origin==='dungeon');return find?{type:'drop',itemId:find.id}:null;}
 if(s.depth&&(key==='b'||key==='n'||key==='f')){const kind:SupplyKind=key==='b'?'bomb':key==='n'?'dart':'flash';if((s.supplies?.[kind]??0)<=0)return null;
  if(kind==='flash')return {type:'supply',supply:'flash'};const target=supplyTarget(s,kind);return target?{type:'supply',supply:kind,x:target.x,y:target.y}:null;}
 const d:Record<string,number[]>={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};
 if(!d[key])return null;
 const x=s.player.x+d[key][0],y=s.player.y+d[key][1];
 const enemy=s.enemies.find(e=>e.x===x&&e.y===y);
 return enemy?{type:'attack',enemyId:enemy.id}:{type:'move',x,y};
}
/** Loot on the player's tile (what stepping could not take). */
export function lootHere(s:RunState){return Object.values(s.items).filter(i=>{const l=i.location as {kind:string;room?:number;x?:number;y?:number};return l.kind==='floor'&&l.room===s.roomIndex&&l.x===s.player.x&&l.y===s.player.y;});}
/** The one piece of carried gear worth equipping now: a sword over a club, armor if unarmored, a club if unarmed. */
export function equipChoice(s:RunState){
 const bag=Object.values(s.items).filter(i=>i.location.kind==='bag');
 return (s.player.weapon!=='sword'?bag.find(i=>i.type==='sword'):undefined)??(!s.player.armor?bag.find(i=>i.type==='armor'):undefined)??(s.player.weapon==='unarmed'?bag.find(i=>i.type==='club'):undefined);
}
/** Nearest visible enemy the supply can legally target; null when none (the view says so). */
export function supplyTarget(s:RunState,kind:SupplyKind){
 const vis=visibleTiles(s);const near=(e:{x:number;y:number})=>Math.abs(e.x-s.player.x)+Math.abs(e.y-s.player.y);
 return [...s.enemies].filter(e=>vis.has(`${e.x},${e.y}`)).sort((a,b)=>near(a)-near(b)).find(e=>!supplyTargetError(s,kind,e,vis))??null;
}
