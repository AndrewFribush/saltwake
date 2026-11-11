import './expedition-offer.css';
import React,{useState} from 'react';
import type {EditionTerms} from '../../../packages/shared/src/types';
import type {EditionRecord as Record} from '../../../packages/shared/src/edition-record';
import {editionRulePages} from '../../../packages/game/src/edition-rules';
import {Pages,Reading} from './GamePanels';
import {EditionRecord} from './EditionRecord';
import {playerLabel} from './presence-names';
type Offer={maker?:string;id:string;version:string;terms:EditionTerms;fee:string;bundles:number;remainingValue:number;record?:Record;status:string};
export function ExpeditionOffer({edition:e,packed,disabled,onAdmit}:{edition:Offer;packed:number;disabled:boolean;onAdmit:()=>void}){
 const [view,setView]=useState('Overview');
 let pages:ReturnType<typeof editionRulePages>=[],error='';
 try{pages=editionRulePages(e.terms);}catch{error='This edition’s rules could not be read. Entry is unavailable; refresh and try again.';}
 return <article className="expedition-offer"><div><h3>{e.terms.title}</h3>{e.maker&&<p className="offer-maker">Built by {playerLabel(e.maker)} · entry {e.fee} {e.fee==='1'?'coin':'coins'}</p>}
 <label>Offer details<select aria-label="Offer details" value={view} onChange={event=>setView(event.target.value)}><option>Overview</option><option>Rules & hazards</option><option>Track record</option></select></label>
 {view==='Overview'&&<><p>{e.status} · {e.terms.modules.length} {e.terms.modules.length===1?'floor':'floors'} · {e.terms.no_reward?`${e.bundles} ${e.bundles===1?'place':'places'} open now · no treasure`:`${e.bundles} funded attempts · ${e.remainingValue} treasure value`}</p><p>Death forfeits packed gear. {packed} packed · {Number(e.terms.run_duration_ms)/60000} min/run</p><p>{e.record?.completed??0} settled attempts. Read Rules &amp; hazards and Track record before entry.</p></>}
 {view==='Rules & hazards'&&<Pages items={pages} label="Dungeon rule pages" className="offer-details" prevLabel="‹ Back" nextLabel="More rules ›" render={p=><><h4>{p.title}</h4><Reading text={p.text} limit={190}/></>}/>}
 {view==='Track record'&&<EditionRecord record={e.record}/>}
 {error&&<Reading text={error}/>}
 <button className="primary" disabled={disabled||!!error} onClick={onAdmit}>{e.fee==='0'?'Descend · free entry':<>Pay {e.fee} {e.fee==='1'?'coin':'coins'} &amp; enter {e.terms.title}</>}</button>
 </div></article>;
}
