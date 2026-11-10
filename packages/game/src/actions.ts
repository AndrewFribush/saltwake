import {explore} from './roguelike';
import {atClearedExit,enterRoom,hasNextRoom} from './generation';
import {inventoryAction,type InventoryAction} from './inventory';
import {distance,walkable,type RunState} from './state';
import {resolveEnemies} from './combat';
export type Action={type:'move';x:number;y:number}|{type:'attack';enemyId:string}|{type:'guard'}|{type:'wait'}|InventoryAction|{type:'extract'}|{type:'continue'}|{type:'boon';choice:'edge'|'rest'};
export function act(s:RunState,a:Action):RunState {
 if(!a||typeof a!=='object'||!['move','attack','guard','wait','pickup','equip','use','drop','extract','continue','boon'].includes(a.type))return s;
 if(['pickup','equip','use','drop'].includes(a.type)&&(!('itemId' in a)||typeof a.itemId!=='string'))return s;
 const allowed=a.type==='move'?['type','x','y']:a.type==='attack'?['type','enemyId']:a.type==='boon'?['type','choice']:['pickup','equip','use','drop'].includes(a.type)?['type','itemId']:['type'];
 if(Object.keys(a).some(k=>!allowed.includes(k)))return s;
 if(s.status!=='active')return s;
 if(a.type==='boon'){if(!s.roguelike||s.boon||s.roomIndex!==0||!atClearedExit(s)||!['edge','rest'].includes(a.choice)||(a.choice==='edge'&&s.player.hp<=3))return s;const n=structuredClone(s);n.boon=a.choice;n.player.hp=a.choice==='rest'?Math.min(12,n.player.hp+4):n.player.hp-3;n.log.push(a.choice==='rest'?'You rest at the shrine: recovered 4 health.':'You take the blood edge: lost 3 health, gained 1 attack damage.');return n;}
 if(a.type==='extract'||a.type==='continue'){
  if(!atClearedExit(s)||(a.type==='continue'&&!hasNextRoom(s)))return s;
  const n=structuredClone(s);n.turn++;
  if(a.type==='extract'){n.status='extracted';n.log.push('Extracted safely.');}else enterRoom(n,n.roomIndex+1);explore(n);
  return n;
 }
 if(a.type==='move'&&(!walkable(s,a)||distance(s.player,a)!==1||s.enemies.some(e=>e.x===a.x&&e.y===a.y)))return s;
 if(a.type==='attack'&&!s.enemies.some(e=>e.id===a.enemyId&&distance(s.player,e)===1))return s;
 const n=structuredClone(s);
 if(['pickup','equip','use','drop'].includes(a.type)&&'itemId' in a&&!inventoryAction(n,a))return s;
 if(a.type==='move'){n.player.x=a.x;n.player.y=a.y;}
 if(a.type==='attack'){
  const e=n.enemies.find(e=>e.id===a.enemyId)!;const damage=(n.player.weapon==='sword'?3:2)+(n.boon==='edge'?1:0);e.hp-=damage;
  n.log.push(`You hit ${e.id} for ${damage}.`);n.enemies=n.enemies.filter(e=>e.hp>0);
 }
 n.turn++;resolveEnemies(n,a.type==='guard');explore(n);return n;
}
