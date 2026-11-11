import {visibleTiles} from './roguelike';
import {encounterRules} from './component-catalog';import {depthThreatTiles} from './depth';import {enemyCatalog,nestPeriod} from '../../shared/src/depth-components';import {distance,type Enemy,type RunState} from './state';
/** Describes only the supplied visible enemy and its already committed intent. */
export function enemyTelegraph(s:RunState,e:Enemy):string{
 if(e.recovering)return 'Recovering: no action this turn.';
 if(s.roguelike&&e.alerted===false&&distance(e,s.player)>(e.alertRadius??5))return 'Unaware: approaching may wake it.';
 if(e.stunned)return `Stunned: no action for ${e.stunned} turn${e.stunned>1?'s':''}.`;
 if(e.kind==='nest')return e.hatch?`Hatching: a rat appears at ${e.hatch.x}, ${e.hatch.y} next turn.`:`Nest: hatches a rat every ${nestPeriod} turns once awake (${e.spawned??0}/6 hatched).`;
 if(e.kind==='bomber'&&e.primed)return `Fuse lit: bursts next turn for ${e.damage??enemyCatalog.bomber.damage} damage to every creature in the 3×3 around it.`;
 if(e.kind==='archer'&&e.aim)return `Aiming: ${e.damage??enemyCatalog.archer.damage} damage to the first creature on the marked line next turn.`;
 if(e.kind==='brute'&&e.resting)return 'Lumbering: no action this turn.';
 if(e.kind==='brute'&&e.lane?.length)return `Winding up: smashes the 3 marked tiles for ${e.damage??enemyCatalog.brute.damage} damage next turn.`;
 if(e.kind==='charger'&&e.lane?.length)return `Charge: ${e.damage??encounterRules.charger.damage} damage to the first creature in its lane, then one recovery turn.`;
 if(distance(e,e.intent)===1&&e.intent.x===s.player.x&&e.intent.y===s.player.y)return `Attack: ${e.damage??(e.kind&&e.kind!=='charger'?enemyCatalog[e.kind].damage:encounterRules.pursuer.damage)} damage before armor or guard.`;
 if(e.intent.x===e.x&&e.intent.y===e.y)return 'Holding position this turn.';
 return `Moving to ${e.intent.x}, ${e.intent.y}.`;
}

/** Public warning geometry only: no enemy IDs, offscreen coordinates or loot. */
export function visibleThreatTiles(s:RunState){
 const visible=visibleTiles(s),tiles=new Map<string,{x:number;y:number}>();
 for(const e of s.enemies){if(e.recovering||s.roguelike&&e.alerted===false&&distance(e,s.player)>(e.alertRadius??5))continue;const intent=e.lane?.length?e.lane:distance(e,e.intent)===1?[e.intent]:[];
  for(const p of intent)if(visible.has(`${p.x},${p.y}`))tiles.set(`${p.x},${p.y}`,{x:p.x,y:p.y});
 }
 for(const p of depthThreatTiles(s))if(visible.has(`${p.x},${p.y}`))tiles.set(`${p.x},${p.y}`,{x:p.x,y:p.y});
 return [...tiles.values()].sort((a,b)=>a.y-b.y||a.x-b.x);
}
