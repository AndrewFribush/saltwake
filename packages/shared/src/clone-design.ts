import {decodeCustomModule} from './custom-layout';
import {decodeBlueprint,encodeBlueprint,type Blueprint} from './blueprint';
import type {CreatorPlacement} from './creator-rewards';
import type {EditionTerms} from './types';

export type ClonableEdition={id:string;maker:string;terms:EditionTerms;randomTables?:{table_id:string;socket_ids:string[]}[]};
const trimTitle=(t:string)=>{let out=t;while(new TextEncoder().encode(out).length>80)out=out.slice(0,-1);return out.trim()||'Copied dungeon';};

/** Rebuild an editable design from a published edition's immutable terms. Layout, encounters and reward
 * *types* are copied; funded goods, fees earned, ownership and records are not. Preset (developer) modules
 * cannot be copied: only player-built layouts. The result passes the same checks as an imported blueprint. */
export function blueprintFromEdition(e:ClonableEdition,makerName:string=e.maker):Blueprint{
 let floors;
 try{floors=e.terms.modules.map(m=>decodeCustomModule(m));}catch{throw Error('Only player-built dungeons can be copied; this one uses fixed developer rooms.');}
 const tableOf=(socketId:string)=>e.randomTables?.find(t=>t.socket_ids.includes(socketId));
 const placements:CreatorPlacement[][]=floors.map((floor,room)=>floor.sockets.map((_,slot)=>{
  const s=e.terms.sockets.find(x=>x.room===room&&x.slot===slot);const table=s&&tableOf(s.id);
  return {enemy:s?.enemy??'none',trap:!!s?.trap,reward:table?'random':(s?.reward??null),...(table&&table.table_id!=='creator-loot'?{randomPool:table.table_id}:{})};
 }));
 const draft:Blueprint={title:trimTitle(`${e.terms.title} (copy)`),fee:'0',floors,placements,source:{title:trimTitle(e.terms.title),maker:trimTitle(makerName),edition:e.id}};
 return decodeBlueprint(encodeBlueprint(draft));
}
