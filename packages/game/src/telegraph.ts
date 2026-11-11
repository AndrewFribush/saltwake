import {visibleTiles} from './roguelike';
import {encounterRules} from './component-catalog';import {distance,type Enemy,type RunState} from './state';
/** Describes only the supplied visible enemy and its already committed intent. */
export function enemyTelegraph(s:RunState,e:Enemy):string{
 if(e.recovering)return 'Recovering: no action this turn.';
 if(s.roguelike&&e.alerted===false&&distance(e,s.player)>(e.alertRadius??5))return 'Unaware: approaching may wake it.';
 if(e.kind==='charger'&&e.lane?.length)return `Charge: ${e.damage??encounterRules.charger.damage} damage to the first creature in its lane, then one recovery turn.`;
 if(distance(e,e.intent)===1&&e.intent.x===s.player.x&&e.intent.y===s.player.y)return `Attack: ${e.damage??encounterRules.pursuer.damage} damage before armor or guard.`;
 if(e.intent.x===e.x&&e.intent.y===e.y)return 'Holding position this turn.';
 return `Moving to ${e.intent.x}, ${e.intent.y}.`;
}

/** Public warning geometry only: no enemy IDs, offscreen coordinates or loot. */
export function visibleThreatTiles(s:RunState){
 const visible=visibleTiles(s),tiles=new Map<string,{x:number;y:number}>();
 for(const e of s.enemies){if(e.recovering||s.roguelike&&e.alerted===false&&distance(e,s.player)>(e.alertRadius??5))continue;const intent=e.lane?.length?e.lane:distance(e,e.intent)===1?[e.intent]:[];
  for(const p of intent)if(visible.has(`${p.x},${p.y}`))tiles.set(`${p.x},${p.y}`,{x:p.x,y:p.y});
 }
 return [...tiles.values()].sort((a,b)=>a.y-b.y||a.x-b.x);
}
