import {signalValue} from '../../shared/src/mechanisms';
import {explore} from './roguelike';
import {atClearedExit,canExtract,canContinue,enterRoom} from './generation';
import {inventoryAction,type InventoryAction} from './inventory';
import {distance,walkable,attackDamage,type RunState} from './state';
import {resolveEnemies} from './combat';
export type Action={type:'move';x:number;y:number}|{type:'attack'|'shove';enemyId:string}|{type:'guard'}|{type:'wait'}|InventoryAction|{type:'extract'}|{type:'continue'}|{type:'boon';choice:'edge'|'rest'};
function resolveAction(s:RunState,a:Action):RunState {
 if(!a||typeof a!=='object'||!['move','attack','shove','guard','wait','pickup','equip','use','drop','extract','continue','boon'].includes(a.type))return s;
 if(['pickup','equip','use','drop'].includes(a.type)&&(!('itemId' in a)||typeof a.itemId!=='string'))return s;
 const allowed=a.type==='move'?['type','x','y']:(a.type==='attack'||a.type==='shove')?['type','enemyId']:a.type==='boon'?['type','choice']:['pickup','equip','use','drop'].includes(a.type)?['type','itemId']:['type'];
 if(Object.keys(a).some(k=>!allowed.includes(k)))return s;
 if(s.status!=='active')return s;
 if(a.type==='boon'){if(s.exitRule!==undefined||s.connections!==undefined||!s.roguelike||s.boon||s.roomIndex!==0||!atClearedExit(s)||!['edge','rest'].includes(a.choice)||(a.choice==='edge'&&s.player.hp<=3))return s;const n=structuredClone(s);n.boon=a.choice;n.player.hp=a.choice==='rest'?Math.min(12,n.player.hp+4):n.player.hp-3;n.log.push(a.choice==='rest'?'You rest at the shrine: recovered 4 health.':'You take the blood edge: lost 3 health, gained 1 attack damage.');return n;}
 if(a.type==='extract'||a.type==='continue'){
  if(a.type==='extract'?!canExtract(s):!canContinue(s))return s;
  const n=structuredClone(s);n.turn++;
  if(n.exitRule!==undefined||a.type==='extract'&&n.rulesVersion===4)resolveEnemies(n,false);
  if(n.status!=='died'){if(a.type==='extract'){n.status='extracted';n.log.push('Extracted safely.');}else enterRoom(n,n.roomIndex+1);}explore(n);
  return n;
 }
 if(a.type==='move'&&s.connections?.some(l=>l.x===a.x&&l.y===a.y&&l.require_clear&&s.enemies.length))return s;
 if(a.type==='move'&&(!walkable(s,a)||distance(s.player,a)!==1||s.enemies.some(e=>e.x===a.x&&e.y===a.y)))return s;
 if(a.type==='attack'&&!s.enemies.some(e=>e.id===a.enemyId&&distance(s.player,e)===1))return s;
 if(a.type==='shove'){
  const e=s.enemies.find(e=>e.id===a.enemyId&&distance(s.player,e)===1);
  if(s.rulesVersion!==4||s.player.weapon!=='club'||!e)return s;
  const to={x:e.x+(e.x-s.player.x),y:e.y+(e.y-s.player.y)};
  if(!walkable(s,to)||s.enemies.some(other=>other.hp>0&&other.x===to.x&&other.y===to.y))return s;
 }
 const n=structuredClone(s);
 if(a.type==='shove'){const e=n.enemies.find(e=>e.id===a.enemyId)!;e.x+=e.x-n.player.x;e.y+=e.y-n.player.y;n.log.push(`You shove ${e.id}.`);}
 if(['pickup','equip','use','drop'].includes(a.type)&&'itemId' in a&&!inventoryAction(n,a))return s;
 if(a.type==='move'){n.player.x=a.x;n.player.y=a.y;const device=n.devices?.find(d=>d.kind==='switch'&&d.x===a.x&&d.y===a.y);if(device?.kind==='switch'){n.signals??={};n.signals[device.channel]=device.mode==='toggle'?!signalValue(n.signals,device.channel):device.mode==='set';n.log.push(`Switch ${device.channel}: ${n.signals[device.channel]?'on':'off'}.`);}}
 if(a.type==='attack'){
  const e=n.enemies.find(e=>e.id===a.enemyId)!;const damage=attackDamage(n);e.hp-=damage;
  n.log.push(`You hit ${e.id} for ${damage}.`);n.enemies=n.enemies.filter(e=>e.hp>0);
 }
 n.turn++;resolveEnemies(n,a.type==='guard');if(a.type==='move'&&n.status==='active'){const link=n.connections?.find(l=>l.x===n.player.x&&l.y===n.player.y);if(link)enterRoom(n,link.to);}explore(n);return n;
}

/** Optional local diagnostic sink captures this action before the display log is bounded. */
export function actWithMessages(s:RunState,a:Action,onMessages?:(messages:string[])=>void):RunState {
 const next=resolveAction(s,a);if(next===s)return s;
 onMessages?.(next.log.slice(s.log.length));next.log=next.log.slice(-8);return next;
}

export function act(s:RunState,a:Action):RunState {return actWithMessages(s,a);}
