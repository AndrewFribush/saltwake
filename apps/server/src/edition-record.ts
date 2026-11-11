import {catalog} from '../../../packages/shared/src/catalog';
import type {EditionRecord} from '../../../packages/shared/src/edition-record';
import type {EconomySnapshot} from '../../../packages/shared/src/types';
import type {Store} from './db';
import type {SavedRun} from './runs';

const mean = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const median = (xs: number[]) => {if(!xs.length)return null;const a=[...xs].sort((x,y)=>x-y);return (a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2;};
/** Confirmed outcomes only. No names, hidden assignments or loot locations leave this projection. */
export function editionRecord(world: EconomySnapshot, db: Store, editionId: string): EditionRecord {
  const runs=world.runs.filter(r=>r.edition===editionId);
  const completed=runs.filter(r=>r.status!=='active'&&r.status!=='void');
  const loot:number[]=[], durations:number[]=[];
  for(const run of completed){
    const saved=db.get<SavedRun>('run',run.id);
    // A failed attempt yielded zero extracted loot, even if local history is unavailable.
    if(run.status!=='extracted')loot.push(0);
    else {
      const op=saved?.settlement?db.operation(saved.settlement):undefined;
      const a=op?.command.action;
      if(op?.status==='Applied'&&op.receipt?.status==='Applied'&&op.receipt.op_id===op.id&&op.receipt.payload_hash===op.hash&&a?.type==='settle'&&a.run_id===run.id&&a.outcome==='extracted'){
        const ids=a.disposition.dungeon_extracted;
        const items=ids.map(id=>world.items.find(i=>i.id===id));
        if(new Set(ids).size===ids.length&&items.every(i=>i!==undefined))loot.push(items.reduce((n,i)=>n+catalog[i!.item_type].value,0));
      }
    }
    if(saved?.terminal===run.status&&Number.isSafeInteger(saved.startedAtMs)&&Number.isSafeInteger(saved.finishedAtMs)&&saved.finishedAtMs!>=saved.startedAtMs!){
      durations.push((saved.finishedAtMs!-saved.startedAtMs!)/1000);
    }
  }
  const count=(status:string)=>runs.filter(r=>r.status===status).length;
  return {attempts:runs.length,completed:completed.length,active:count('active'),voided:count('void'),extracted:count('extracted'),died:count('died'),abandoned:count('abandoned'),expired:count('expired'),participants:new Set(completed.map(r=>r.player)).size,lootSamples:loot.length,averageLoot:mean(loot),medianLoot:median(loot),durationSamples:durations.length,averageSeconds:mean(durations),medianSeconds:median(durations)};
}
