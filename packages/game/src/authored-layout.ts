import {validateExitNetwork,defaultExitRule} from '../../shared/src/exit-rules';
import {validateMechanismNetwork} from '../../shared/src/mechanisms';
import {authoringBudgetErrors} from '../../shared/src/authoring-limits';
import {tuningCompatibility} from '../../shared/src/encounter-tuning';
import {poolConfigurationErrors,placementPool,creatorSockets,type CreatorPlacement} from '../../shared/src/creator-rewards';
import {catalog} from '../../shared/src/catalog';
import type {ItemType} from '../../shared/src/types';
import {encounterRules} from './component-catalog';
import {validateFloorGraph,validateCustomFloor,type CustomFloor} from '../../shared/src/custom-layout';
import type {Socket} from '../../shared/src/types';
import type {RoomLayout} from './state';
/** Shared by creator rehearsal and authoritative play. Contains no item creation. */
export function authoredLayout(floors:readonly CustomFloor[],sockets:readonly Socket[]):RoomLayout[]{
 const budgetErrors=authoringBudgetErrors(floors);if(budgetErrors.length)throw Error(budgetErrors.join('; '));
 for(const floor of floors){const errors=validateCustomFloor(floor,floor.exit_rule!==undefined?'missions':floor.devices!==undefined?'mechanisms':floor.tuning!==undefined?'tuned':floor.links?'graph':'sized');if(errors.length)throw Error(errors.join('; '));}
 const graphErrors=[...validateFloorGraph(floors),...validateMechanismNetwork(floors),...validateExitNetwork(floors)];if(graphErrors.length)throw Error(graphErrors.join('; '));
 const ids=new Set<string>(),positions=new Set<string>();
 for(const s of sockets){const key=`${s.room}:${s.slot}`;
  if(!s.id||ids.has(s.id)||positions.has(key)||!Number.isInteger(s.room)||!Number.isInteger(s.slot)||!floors[s.room]?.sockets[s.slot]||!['none','pursuer','charger'].includes(s.enemy)||typeof s.trap!=='boolean')throw Error('Invalid authored encounter');
  ids.add(s.id);positions.add(key);
 }
 for(const [room,floor] of floors.entries())for(const t of floor.tuning??[]){const socket=sockets.find(s=>s.room===room&&s.slot===t.slot);if(!socket)throw Error('Tuning requires a declared encounter.');const errors=tuningCompatibility(t,socket.enemy,socket.trap);if(errors.length)throw Error(errors.join('; '));}
 return floors.map((floor,room)=>({... (floor.exit_rule!==undefined?{exitRule:structuredClone(floor.exit_rule)}:{}),... (floor.devices!==undefined?{devices:structuredClone(floor.devices)}:{}),id:`custom-${room}`,title:`Floor ${room+1}`,tiles:[...floor.tiles],spawn:{...floor.spawn},exit:{...floor.exit},...(floor.links?{links:structuredClone(floor.links)}:{}),
  enemies:sockets.filter(s=>s.room===room&&s.enemy!=='none').map(s=>{const p=floor.sockets[s.slot],t=floor.tuning?.find(t=>t.slot===s.slot);return {...p,...(t?.damage!==undefined?{damage:t.damage}:{}),...(t?.alert!==undefined?{alertRadius:t.alert}:{}),id:s.id,kind:s.enemy as 'pursuer'|'charger',hp:t?.hp??encounterRules[s.enemy as 'pursuer'|'charger'].hp,intent:{...p},alerted:false};}),
  traps:sockets.filter(s=>s.room===room&&s.trap).map(s=>{const t=floor.tuning?.find(t=>t.slot===s.slot),period=t?.trap_period??2,activeTurns=t?.trap_active??1,phase=t?.trap_offset??0;return {...floor.sockets[s.slot],id:s.id+'-trap',armed:phase<activeTurns,...(t?{period,activeTurns,phase,damage:t.trap_damage??3}:{})};}),
 }));
}

import {createRun} from './state';
import {addItem} from './inventory';
import {enterRoom} from './generation';
import {explore} from './roguelike';
export type RehearsalSample=ItemType|Record<string,ItemType>;
export type RehearsalKit='club'|'sword'|'armored'|'unarmed';
/** Only the creator's rehearsal may synthesize these goods. Never economic admission. */
export function authoredRehearsal(floors:readonly CustomFloor[],sockets:readonly Socket[],kit:RehearsalKit='club'){
 if(!['club','sword','armored','unarmed'].includes(kit))throw Error('Unknown rehearsal kit');
 const s=createRun();s.items={};s.originalTownIds=[];s.reservedItemIds=[];s.roguelike=true;s.explored=[];
 s.layout=authoredLayout(floors,sockets);s.player.weapon=kit==='unarmed'?'unarmed':kit==='sword'?'sword':'club';s.player.armor=kit==='armored';
 if(s.player.weapon!=='unarmed')addItem(s,{id:'preview-weapon',type:s.player.weapon,origin:'town',location:{kind:'weapon'}});
 if(kit!=='unarmed')addItem(s,{id:'preview-tonic',type:'tonic',origin:'town',location:{kind:'bag'}});
 if(s.player.armor)addItem(s,{id:'preview-armor',type:'armor',origin:'town',location:{kind:'armor'}});
 for(const socket of sockets)if(socket.reward)addItem(s,{id:`preview-reward-${socket.room}-${socket.slot}`,type:socket.reward,origin:'dungeon',location:{kind:'floor',room:socket.room,...floors[socket.room].sockets[socket.slot]}});
 enterRoom(s,0);explore(s);s.log=['Synthetic rehearsal of your draft. Nothing carries home.'];return s;
}

/** A selectable possible random drop, not a draw prediction or owned stock. */
export function creatorRehearsal(floors:readonly CustomFloor[],placements:readonly (readonly CreatorPlacement[])[],kit:RehearsalKit='club',sample:RehearsalSample='tonic'){
 if((typeof sample==='string'?[sample]:sample&&typeof sample==='object'&&!Array.isArray(sample)?Object.values(sample):[null]).some(type=>typeof type!=='string'||!Object.hasOwn(catalog,type)))throw Error('Unsupported rehearsal sample');
 const poolErrors=poolConfigurationErrors(placements);if(poolErrors.length)throw Error(poolErrors.join('; '));
 const sockets=creatorSockets(placements).map(s=>placements[s.room][s.slot].reward==='random'?{...s,reward:typeof sample==='string'?sample:Object.hasOwn(sample,placementPool(placements[s.room][s.slot]))?sample[placementPool(placements[s.room][s.slot])]:'tonic'}:s);
 return authoredRehearsal(floors.map(f=>({...f,tuning:f.tuning??[],devices:f.devices??[],exit_rule:f.exit_rule??{...defaultExitRule}})),sockets,kit);
}
