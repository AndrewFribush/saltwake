import type {RunState} from './state';
import {isConsumable} from './inventory';
export type Outcome='extracted'|'died'|'void';
export type Disposition={townConsumed:string[];townReturned:string[];townForfeited:string[];dungeonConsumed:string[];dungeonExtracted:string[];dungeonReturned:string[]};
export function disposition(s:RunState,outcome:Outcome):Disposition{
 const d:Disposition={townConsumed:[],townReturned:[],townForfeited:[],dungeonConsumed:[],dungeonExtracted:[],dungeonReturned:[]};
 const all=[...s.originalTownIds,...s.reservedItemIds];
 if(new Set(all).size!==all.length||all.length!==Object.keys(s.items).length)throw Error('Invalid source manifest');
 for(const id of all){
  const i=s.items[id];if(!i||i.id!==id||i.origin!==(s.originalTownIds.includes(id)?'town':'dungeon'))throw Error('Missing or wrong-origin item');
  if(i.location.kind==='consumed'){
   if(!isConsumable(i.type))throw Error('Consumed nonconsumable');
   (i.origin==='town'?d.townConsumed:d.dungeonConsumed).push(id);
  }else if(i.origin==='town'){
   if(i.location.kind==='floor')throw Error('Town gear cannot be dropped');
   (outcome==='died'?d.townForfeited:d.townReturned).push(id);
  }else{
   (outcome==='extracted'&&['bag','weapon','armor'].includes(i.location.kind)?d.dungeonExtracted:d.dungeonReturned).push(id);
  }
 }
 return d;
}
