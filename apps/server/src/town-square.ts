import type {EconomySnapshot} from '../../../packages/shared/src/types';
import {catalog} from '../../../packages/shared/src/catalog';
import type {Store} from './db';
import type {SavedRun} from './runs';
import {readBuildingUse} from '../../../packages/game/src/town-spaces';
/** Town-square highlights for the notice board, from public contract state and confirmed settlements only.
 * Read-only and presence-level: nothing here grants or changes anything. */
export type Highlight={kind:'dungeon'|'haul'|'commission'|'building';text:string;who?:string;district?:string};
const num=(id:string)=>Number(id.split('-').pop())||0;
export function townSquare(world:EconomySnapshot,db:Store,now=Date.now()):Highlight[]{
 const out:Highlight[]=[];
 // Where a dungeon can be entered in town: the district of its first entrance (none if no entrance is built).
 const at=(edition:string)=>{const shop=(world.shops??[]).filter(s=>{const u=readBuildingUse(s.interior);return u.kind==='dungeon'&&u.edition===edition;}).sort((a,b)=>num(a.id)-num(b.id))[0];return shop?{district:shop.district}:{};};
 const editions=world.editions.filter(e=>!e.closed).sort((a,b)=>num(b.id)-num(a.id));
 if(editions[0])out.push({kind:'dungeon',who:editions[0].maker,text:`Newest dungeon: “${editions[0].terms.title}”, entry ${editions[0].fee} coins`,...at(editions[0].id)});
 let best:{player:string;value:number;title:string;edition:string}|undefined;
 for(const run of world.runs.filter(r=>r.status==='extracted')){
  const saved=db.get<SavedRun>('run',run.id);if(!saved?.finishedAtMs||now-saved.finishedAtMs>86_400_000||!saved.settlement)continue;
  const op=db.operation(saved.settlement);const a=op?.command.action;
  if(op?.status!=='Applied'||a?.type!=='settle'||a.run_id!==run.id)continue;
  const value=a.disposition.dungeon_extracted.reduce((n,id)=>{const it=world.items.find(i=>i.id===id);return n+(it?catalog[it.item_type].value:0);},0);
  if(value>0&&(!best||value>best.value))best={player:run.player,value,edition:run.edition,title:world.editions.find(e=>e.id===run.edition)?.terms.title??run.edition};
 }
 if(best)out.push({kind:'haul',who:best.player,text:`Biggest haul today: treasure worth ${best.value} from “${best.title}”`,...at(best.edition)});
 const filled=(world.commissions??[]).filter(c=>c.status==='filled').sort((a,b)=>num(b.id)-num(a.id))[0];
 if(filled)out.push({kind:'commission',who:filled.buyer,text:`Commission filled: ${filled.quantity} ${catalog[filled.item_type].name.toLowerCase()}${filled.quantity===1?'':'s'} at ${filled.unit_price} each`});
 const shop=(world.shops??[]).slice().sort((a,b)=>num(b.id)-num(a.id))[0];
 if(shop)out.push({kind:'building',who:shop.owner,text:`Newest building: “${shop.title}”`,district:shop.district});
 return out;
}
