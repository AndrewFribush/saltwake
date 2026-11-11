import type {EditionTerms} from '../../shared/src/types';
import {decodeCustomModule} from '../../shared/src/custom-layout';
import {authoredLayout} from './authored-layout';
import {enemyCatalog,featureCatalog,altarBoons,supplyCatalog} from '../../shared/src/depth-components';
export type RulePage={title:string;text:string};
/** Public admitted definitions only; never read private run state, paths or loot draws. */
export function editionRulePages(terms:EditionTerms):RulePage[]{
 const pages:RulePage[]=[
  {title:'Your attempt',text:`Up to ${Number(terms.run_duration_ms)/60000} minutes per run. Death, abandonment or timeout forfeits town gear to the bank. Unused dungeon goods return to their pool; consumed goods stay spent.`},
  {title:'Opening window',text:`Opens ${new Date(Number(terms.opens_at_ms)).toISOString()}. Closes ${new Date(Number(terms.closes_at_ms)).toISOString()}. Capacity: ${terms.max_runs} simultaneous attempts. Admitted runs keep their full deadline.`},
 ];
 if(!Number.isInteger(terms.rules_version)||terms.rules_version<1||terms.rules_version>12)throw Error('Unsupported dungeon rules');
 if(terms.rules_version<3){pages.push({title:'Legacy rules',text:'This edition uses an older floor system. Clear all enemies before extracting or taking onward stairs. Enemy and hazard settings use the original game defaults.'});return pages;}
 const layout=authoredLayout(terms.modules.map(decodeCustomModule),terms.sockets);
 for(const [index,room] of layout.entries()){
  const name=`Floor ${index+1}`,rule=room.exitRule;
  pages.push({title:`${name} · departure`,text:rule?`${rule.extract?'Extraction allowed.':'No extraction here.'} ${rule.require_clear?'Clear all enemies first.':'Surviving enemies do not block departure.'}${rule.channel!==undefined?` Requires ${rule.channel} ${rule.value?'on':'off'}.`:''} Enemies and hazards act before you leave.`:'Clear all enemies before extracting or taking onward stairs.'});
  pages.push({title:`${name} · routes`,text:room.links!==undefined?`${room.links.length} directed passages; ${room.links.filter(l=>l.require_clear).length} require a cleared room. Return routes are not guaranteed. Rooms remember enemies and traps. Passage travel spends a turn.`:`${index<layout.length-1?'Stairs lead to the next floor.':'Final floor; no onward stairs.'} Exit conditions also govern onward stairs. Rehearsal checks do not guarantee a solvable route.`});
  if(room.devices?.length)pages.push({title:`${name} · mechanisms`,text:`${room.devices.filter(d=>d.kind==='switch').length} switches, ${room.devices.filter(d=>d.kind==='door').length} doors. Channels start off and persist across floors. Switches toggle, set or clear channels. Closed doors block movement and sight.`});
  if(room.tide)pages.push({title:`${name} · tide`,text:`After ${room.tide.turns} turns on this floor the tide floods it: ${room.tide.damage} damage every turn until you leave. Armor and guard do not help. Time on this floor is remembered if you return.`});
  if(room.features?.length){const counts=new Map<string,number>();for(const f of room.features)counts.set(f.kind,(counts.get(f.kind)??0)+1);for(const [kind,n] of counts){const spec=featureCatalog[kind as keyof typeof featureCatalog],sample=room.features.find(f=>f.kind===kind)!;pages.push({title:`${name} · ${spec.name.toLowerCase()}${n>1?` ×${n}`:''}`,text:`${spec.summary}${sample.kind==='altar'?` Boons here: ${[...new Set(room.features.filter(f=>f.kind==='altar').map(f=>f.kind==='altar'?`${altarBoons[f.boon]} for ${f.cost} health`:''))].join('; ')}.`:sample.kind==='cache'?` Contents: ${room.features.filter(f=>f.kind==='cache').map(f=>f.kind==='cache'?`${f.count} × ${supplyCatalog[f.supply].name}`:'').join(', ')}.`:''}`});}}
  for(const [i,e] of room.enemies.entries())if(e.kind&&e.kind!=='pursuer'&&e.kind!=='charger')pages.push({title:`${name} · enemy ${i+1}`,text:`${enemyCatalog[e.kind].name}: ${e.hp} health; ${e.damage??enemyCatalog[e.kind].damage} ${e.kind==='nest'?'rat bite':''} damage; alert distance ${e.alertRadius??enemyCatalog[e.kind].alert}. ${enemyCatalog[e.kind].summary}`});else pages.push({title:`${name} · enemy ${i+1}`,text:e.kind==='charger'?`Charger: ${e.hp} health; ${e.damage??4} charge damage, ${e.damage??3} close attack damage; alert distance ${e.alertRadius??5}. Commits to a straight lane, then recovers for a turn. Damage shown before armor or guard.`:`Pursuer: ${e.hp} health; ${e.damage??3} damage; alert distance ${e.alertRadius??5}. Follows walkable routes and commits its next move. Damage shown before armor or guard.`});
  for(const [i,t] of room.traps.entries())pages.push({title:`${name} · trap ${i+1}`,text:`Spikes: ${t.damage??3} damage; armed ${t.activeTurns??1} of every ${t.period??2} turns; starting phase ${t.phase??0}. Initially ${t.armed?'armed':'safe'}. Hit creatures on the tile after enemies act. Damage shown before protection.`});
  if(!room.enemies.length&&!room.traps.length)pages.push({title:`${name} · encounters`,text:'No placed enemies or spike traps. Mechanisms and exit conditions may still obstruct a route.'});
 }
 return pages;
}
