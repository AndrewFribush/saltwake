import {signalValue} from '../../shared/src/mechanisms';
import {catalog} from '../../shared/src/catalog';
import {explore} from './roguelike';
import {atClearedExit,canExtract,canContinue,enterRoom,nextRoomIndex} from './generation';
import {inventoryAction,type InventoryAction} from './inventory';
import {distance,walkable,attackDamage,type RunState} from './state';
import {resolveEnemies} from './combat';
import {visibleTiles} from './roguelike';
import {bumpFeature,collectCache,interact,makeCtx,shoveTarget,supplyTargetError,useSupply,hurt,explodeBomber,who,updatePlates} from './depth';
import type {SupplyKind} from '../../shared/src/depth-components';
export type Action={type:'move';x:number;y:number}|{type:'attack'|'shove';enemyId:string}|{type:'guard'}|{type:'wait'}|InventoryAction|{type:'extract'}|{type:'continue'}|{type:'boon';choice:'edge'|'rest'}|{type:'interact'}|{type:'supply';supply:SupplyKind;x?:number;y?:number};
function resolveAction(s:RunState,a:Action):RunState {
 if(!a||typeof a!=='object'||!['move','attack','shove','guard','wait','pickup','equip','use','drop','extract','continue','boon','interact','supply'].includes(a.type))return s;
 if(['pickup','equip','use','drop'].includes(a.type)&&(!('itemId' in a)||typeof a.itemId!=='string'))return s;
 const allowed=a.type==='move'?['type','x','y']:(a.type==='attack'||a.type==='shove')?['type','enemyId']:a.type==='boon'?['type','choice']:a.type==='supply'?['type','supply','x','y']:['pickup','equip','use','drop'].includes(a.type)?['type','itemId']:['type'];
 if(Object.keys(a).some(k=>!allowed.includes(k)))return s;
 if(s.status!=='active')return s;
 if(a.type==='boon'){if(s.exitRule!==undefined||s.connections!==undefined||!s.roguelike||s.boon||s.roomIndex!==0||!atClearedExit(s)||!['edge','rest'].includes(a.choice)||(a.choice==='edge'&&s.player.hp<=3))return s;const n=structuredClone(s);n.boon=a.choice;n.player.hp=a.choice==='rest'?Math.min(12,n.player.hp+4):n.player.hp-3;n.log.push(a.choice==='rest'?'You rest at the shrine: recovered 4 health.':'You take the blood edge: lost 3 health, gained 1 attack damage.');return n;}
 if(a.type==='extract'||a.type==='continue'){
  if(a.type==='extract'?!canExtract(s):!canContinue(s))return s;
  const n=structuredClone(s);n.turn++;
  if(n.exitRule!==undefined||a.type==='extract'&&n.rulesVersion===4)resolveEnemies(n,false);
  if(n.status!=='died'){if(a.type==='extract'){n.status='extracted';n.log.push('Extracted safely.');}else enterRoom(n,nextRoomIndex(n));}explore(n);
  return n;
 }
 if(s.depth&&(a.type==='interact'||a.type==='supply')){
  if(a.type==='supply'&&(!['bomb','dart','flash'].includes(a.supply)||supplyTargetError(s,a.supply,a.x===undefined&&a.y===undefined?undefined:{x:a.x!,y:a.y!},visibleTiles(s))))return s;
  const n=structuredClone(s);delete n.blasts;
  if(a.type==='interact'){if(!interact(n))return s;n.turn++;resolveEnemies(n,false);}
  else{const ctx=makeCtx(n,false);useSupply(ctx,a.supply,a.x===undefined?undefined:{x:a.x,y:a.y!});n.enemies=n.enemies.filter(e=>e.hp>0);n.turn++;if(n.player.hp<=0)n.status='died';else resolveEnemies(n,false);}
  explore(n);return n;
 }
 if(s.depth&&a.type==='move'&&distance(s.player,a)===1&&!walkable(s,a)){const n=structuredClone(s);delete n.blasts;if(!bumpFeature(n,a))return s;n.turn++;resolveEnemies(n,false);explore(n);return n;}
 if(a.type==='move'&&s.connections?.some(l=>l.x===a.x&&l.y===a.y&&l.require_clear&&s.enemies.length))return s;
 if(a.type==='move'&&(!walkable(s,a)||distance(s.player,a)!==1||s.enemies.some(e=>e.x===a.x&&e.y===a.y)))return s;
 if(a.type==='attack'&&!s.enemies.some(e=>e.id===a.enemyId&&distance(s.player,e)===1))return s;
 if(a.type==='shove'){
  const e=s.enemies.find(e=>e.id===a.enemyId&&distance(s.player,e)===1);
  if(s.depth){if(!e||!shoveTarget(s,e))return s;}else{
  if(s.rulesVersion!==4||s.player.weapon!=='club'||!e)return s;
  const to={x:e.x+(e.x-s.player.x),y:e.y+(e.y-s.player.y)};
  if(!walkable(s,to)||s.enemies.some(other=>other.hp>0&&other.x===to.x&&other.y===to.y))return s;}
 }
 const n=structuredClone(s);if(n.depth)delete n.blasts;
 if(a.type==='shove'&&n.depth){const e=n.enemies.find(e=>e.id===a.enemyId)!,t=shoveTarget(n,e)!;e.x=t.to.x;e.y=t.to.y;if(t.fall){e.hp=0;n.log.push(`You shove ${who(e)} into the chasm.`);n.enemies=n.enemies.filter(e=>e.hp>0);}else{e.stunned=Math.max(e.stunned??0,1);e.primed=false;e.aim=false;e.lane=[];n.log.push(`You shove ${who(e)}; it staggers.`);}}
 else if(a.type==='shove'){const e=n.enemies.find(e=>e.id===a.enemyId)!;e.x+=e.x-n.player.x;e.y+=e.y-n.player.y;n.log.push(`You shove ${who(e)}.`);}
 // Stepping already took the loot: a pickup of something now in the bag is a turn spent checking it, not a refusal,
 // so recorded play (bots, traces, saved runs) keeps its turn count.
 if(a.type==='pickup'&&'itemId' in a&&n.items[a.itemId]?.location.kind==='bag')n.log.push('That is already in your bag.');
 else if(['pickup','equip','use','drop'].includes(a.type)&&'itemId' in a&&!inventoryAction(n,a))return s;
 if(a.type==='move'){n.player.x=a.x;n.player.y=a.y;
  // Stepping onto loot takes it, as many pieces as the bag holds; what does not fit stays on the tile.
  for(const item of Object.values(n.items)){const l=item.location as {kind:string;room?:number;x?:number;y?:number};if(l.kind==='floor'&&l.room===n.roomIndex&&l.x===a.x&&l.y===a.y){if(inventoryAction(n,{type:'pickup',itemId:item.id}))n.log.push(`You take the ${catalog[item.type].name.toLowerCase()}.`);else{n.log.push('Your bag is full. Drop something to take what lies here.');break;}}}const device=n.devices?.find(d=>d.kind==='switch'&&d.x===a.x&&d.y===a.y);if(device?.kind==='switch'){n.signals??={};n.signals[device.channel]=device.mode==='toggle'?!signalValue(n.signals,device.channel):device.mode==='set';n.log.push(`Switch ${device.channel}: ${n.signals[device.channel]?'on':'off'}.`);}if(n.depth){collectCache(n);updatePlates(n);}}
 if(a.type==='attack'){
  const e=n.enemies.find(e=>e.id===a.enemyId)!;const damage=attackDamage(n);
  if(n.depth){const ctx=makeCtx(n,false);const lit=e.kind==='bomber'&&e.primed;hurt(ctx,e,damage,'You',false);if(lit&&e.hp<=0)explodeBomber(ctx,e);if(n.player.hp<=0)n.status='died';}
  else{e.hp-=damage;n.log.push(`You hit ${who(e)} for ${damage}.`);}n.enemies=n.enemies.filter(e=>e.hp>0);
 }
 if(n.status==='died'){n.turn++;explore(n);return n;}
 n.turn++;resolveEnemies(n,a.type==='guard');if(a.type==='move'&&n.status==='active'){const link=n.connections?.find(l=>l.x===n.player.x&&l.y===n.player.y);if(link)enterRoom(n,link.to);}explore(n);return n;
}

/** Optional local diagnostic sink captures this action before the display log is bounded. */
export function actWithMessages(s:RunState,a:Action,onMessages?:(messages:string[])=>void):RunState {
 const next=resolveAction(s,a);if(next===s)return s;
 onMessages?.(next.log.slice(s.log.length));next.log=next.log.slice(-8);return next;
}

export function act(s:RunState,a:Action):RunState {return actWithMessages(s,a);}
