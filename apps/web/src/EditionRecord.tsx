import React from 'react';
import {Pages} from './GamePanels';
import type {EditionRecord as Record} from '../../../packages/shared/src/edition-record';
const value=(n:number|null)=>n===null?'Not recorded':n.toFixed(1);
const time=(n:number|null)=>n===null?'Not recorded':`${Math.floor(n/60)}m ${Math.round(n%60)}s`;
export function EditionRecord({record:r}:{record?:Record}){
 if(!r)return <p>Run history is not available yet.</p>;
 const rate=r.completed?`${Math.round(100*r.extracted/r.completed)}%`:'Not yet known';
 return <section aria-label="Dungeon track record"><Pages label="Track record details" items={[
  <><p>{r.completed} settled attempts · {r.participants} participant profiles</p><p>Extraction {rate} · {r.died} deaths · {r.abandoned} abandoned · {r.expired} timed out</p><p>{r.active} active / awaiting settlement · {r.voided} voided (excluded)</p></>,
  <><p>Loot taken home per attempt</p><p>Mean {value(r.averageLoot)} · Median {value(r.medianLoot)}</p><p>Reference value; not sale proceeds or profit. Failed attempts count as zero. {r.lootSamples}/{r.completed} results recorded.</p></>,
  <><p>Run time: mean {time(r.averageSeconds)} · median {time(r.medianSeconds)}</p><p>{r.durationSamples}/{r.completed} attempts timed. Includes idle time, from playable admission to outcome; settlement delay excluded. Older runs may lack timings.</p></>,
  <><p>History for this edition, across fees and refreshes. {r.completed<10?'Small sample: outcomes are not reliable predictions.':'Past results do not guarantee your outcome.'}</p><p>Local demo profiles are not verified unique people. Active and voided runs are excluded from averages. Missing records are not zeros; partial samples may be biased.</p></>
 ]} render={page=>page}/></section>;
}
