import {validateExitNetwork} from './exit-rules';
import {validateMechanismNetwork} from './mechanisms';
import {authoringBudgetErrors} from './authoring-limits';
import {operatingErrors,type OperatingSettings} from './operating-terms';
import {tuningCompatibility} from './encounter-tuning';
import type {CreatorPlacement} from './creator-rewards';
import {poolConfigurationErrors,validPool} from './creator-rewards';
import {catalog} from './catalog';
import {validateFloorGraph,validateCustomFloor,type CustomFloor} from './custom-layout';
import type {Socket,ItemType} from './types';
export type Blueprint={title:string;fee:string;floors:CustomFloor[];placements:CreatorPlacement[][];operating?:OperatingSettings};
function normalize(value:unknown,allowRandom=true,flexible:boolean|'sized'|'graph'|'tuned'|'mechanisms'|'missions'='missions',independentPools=true,allowOperating=true,extendedFloors=true):Blueprint{
 if(!value||typeof value!=='object')throw Error('Expected a blueprint');
 const d=value as Blueprint;
 if(typeof d.title!=='string'||!d.title.trim()||new TextEncoder().encode(d.title).length>80)throw Error('Name must be 1–80 UTF-8 bytes');
 if(typeof d.fee!=='string'||!/^\d{1,7}$/.test(d.fee)||BigInt(d.fee)>1000000n)throw Error('Entry fee must be a whole number from 0 to 1000000');
 if(!Array.isArray(d.floors)||d.floors.length<(extendedFloors?1:2)||d.floors.length>(extendedFloors?16:4)||!Array.isArray(d.placements)||d.placements.length!==d.floors.length)throw Error(extendedFloors?'Expected 1–16 floors with matching encounters':'Expected 2–4 floors with matching encounters');
 const point=(p:{x:number;y:number})=>({x:p.x,y:p.y});
 const floors=d.floors.map((f,i)=>{const errors=validateCustomFloor(f,flexible==='missions'?(f.exit_rule!==undefined?'missions':f.devices!==undefined?'mechanisms':f.tuning!==undefined?'tuned':f.links!==undefined?'graph':'sized'):flexible==='mechanisms'?(f.devices!==undefined?'mechanisms':f.tuning!==undefined?'tuned':f.links!==undefined?'graph':'sized'):flexible==='tuned'?(f.tuning!==undefined?'tuned':f.links!==undefined?'graph':'sized'):flexible==='graph'?(f.links!==undefined?'graph':'sized'):flexible);if(errors.length)throw Error(`Floor ${i+1}: ${errors.join('; ')}`);return {tiles:[...f.tiles],spawn:point(f.spawn),exit:point(f.exit),sockets:f.sockets.map(point),...((flexible==='graph'||flexible==='tuned'||flexible==='mechanisms'||flexible==='missions')&&f.links!==undefined?{links:f.links.map(l=>({id:l.id,x:l.x,y:l.y,to:l.to,require_clear:l.require_clear}))}:{}),...((flexible==='tuned'||flexible==='mechanisms'||flexible==='missions')&&f.tuning!==undefined?{tuning:structuredClone(f.tuning)}:{}),...((flexible==='mechanisms'||flexible==='missions')&&f.devices!==undefined?{devices:structuredClone(f.devices)}:{}),...(flexible==='missions'&&f.exit_rule!==undefined?{exit_rule:structuredClone(f.exit_rule)}:{})};});
 if(extendedFloors){const errors=authoringBudgetErrors(floors);if(errors.length)throw Error(errors.join('; '));}
 const graphErrors=[...validateFloorGraph(floors),...validateMechanismNetwork(floors),...validateExitNetwork(floors)];if(graphErrors.length)throw Error(graphErrors.join('; '));
 const placements=d.placements.map((ps,i)=>{if(!Array.isArray(ps)||ps.length!==floors[i].sockets.length)throw Error('Each encounter needs a matching floor position');return ps.map(p=>{
  if(!p||!['none','pursuer','charger'].includes(p.enemy)||typeof p.trap!=='boolean'||(p.reward!==null&&!(allowRandom&&p.reward==='random')&&(typeof p.reward!=='string'||!Object.hasOwn(catalog,p.reward))))throw Error('Unsupported encounter or reward');
  if(p.randomPool!==undefined&&(!independentPools||p.reward!=='random'||!validPool(p.randomPool)))throw Error('Unsupported random pool configuration');
  return {enemy:p.enemy,trap:p.trap,reward:p.reward,...(p.randomPool!==undefined?{randomPool:p.randomPool}:{})};
 });});
 for(const [i,f] of floors.entries())for(const t of f.tuning??[]){const p=placements[i][t.slot];const errors=tuningCompatibility(t,p.enemy,p.trap);if(errors.length)throw Error(errors.join('; '));}
 const poolErrors=poolConfigurationErrors(placements);if(poolErrors.length)throw Error(poolErrors.join('; '));
 if(allowOperating&&d.operating!==undefined){const errors=operatingErrors(d.operating);if(errors.length)throw Error(errors.join('; '));}
 return {title:d.title,fee:d.fee,floors,placements,...(allowOperating&&d.operating!==undefined?{operating:structuredClone(d.operating)}:{})};
}
export function encodeBlueprint(value:unknown):string{const text=JSON.stringify({format:'saltwake-blueprint',version:11,...normalize(value)},null,2);if(new TextEncoder().encode(text).length>100000)throw Error('Blueprint limit is 100 KB');return text;}
export function decodeBlueprint(text:string):Blueprint{
 if(typeof text!=='string'||new TextEncoder().encode(text).length>100000)throw Error('Blueprint limit is 100 KB');
 const value=JSON.parse(text);if(value?.format!=='saltwake-blueprint'||![1,2,3,4,5,6,7,8,9,10,11].includes(value?.version))throw Error('Unsupported blueprint format or version');return normalize(value,value.version>=2,value.version>=11?'missions':value.version>=10?'mechanisms':value.version>=7?'tuned':value.version>=5?'graph':value.version>=4?'sized':value.version>=3,value.version>=6,value.version>=8,value.version>=9);
}
