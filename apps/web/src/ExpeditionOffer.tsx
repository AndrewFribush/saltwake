import './expedition-offer.css';
import React,{useState} from 'react';
import type {EditionTerms} from '../../../packages/shared/src/types';
import type {EditionRecord as Record} from '../../../packages/shared/src/edition-record';
import {editionRulePages} from '../../../packages/game/src/edition-rules';
import {Pages,Reading} from './GamePanels';
import {EditionRecord} from './EditionRecord';
import {playerLabel} from './presence-names';
import {offerSummary} from '../../../packages/shared/src/offer-summary';
type Offer={randomTables?:{socket_ids:string[]}[];maker?:string;id:string;version:string;terms:EditionTerms;fee:string;bundles:number;remainingValue:number;record?:Record;status:string};
export function ExpeditionOffer({edition:e,packed,packedNames,disabled,onAdmit}:{edition:Offer;packed:number;packedNames?:string;disabled:boolean;onAdmit:()=>void}){
 const sum=offerSummary(e.terms,e.record,(e.randomTables??[]).reduce((n,t)=>n+t.socket_ids.length,0));
 const [view,setView]=useState('Overview');
 let pages:ReturnType<typeof editionRulePages>=[],error='';
 try{pages=editionRulePages(e.terms);}catch{error='This edition’s rules could not be read. Entry is unavailable; refresh and try again.';}
 return <article className="expedition-offer"><div><h3>{e.terms.title}</h3>{e.maker&&<p className="offer-maker">Built by {playerLabel(e.maker)} · entry {e.fee} {e.fee==='1'?'coin':'coins'}</p>}
 <label>Offer details<select aria-label="Offer details" value={view} onChange={event=>setView(event.target.value)}><option>Overview</option><option>Rules & hazards</option><option>Track record</option></select></label>
 {view==='Overview'&&<dl className="offer-card">
  <div><dt>Danger</dt><dd><span className={`danger danger-${sum.danger.toLowerCase()}`}>{sum.danger}</span> <small>{sum.dangerWhy}</small></dd></div>
  <div><dt>Threats</dt><dd>{sum.enemies.length?sum.enemies.map(x=>`${x.count} × ${x.name}`).join(', '):'none'}{sum.traps?` · ${sum.traps} spike ${sum.traps===1?'trap':'traps'}`:''} · {sum.floors} {sum.floors===1?'floor':'floors'} · {Number(e.terms.run_duration_ms)/60000} min</dd></div>
  <div><dt>Treasure</dt><dd>{e.terms.no_reward?'none: an attraction for the challenge':<>{[...sum.treasure,...(sum.randomSpots?[`${sum.randomSpots} random ${sum.randomSpots===1?'draw':'draws'}`]:[])].join(', ')||'random draws'} <small>· worth {e.remainingValue} in stock · {e.bundles} {e.bundles===1?'attempt':'attempts'} funded</small></>}</dd></div>
  <div><dt>Record</dt><dd>{sum.record}</dd></div>
  <div><dt>You risk</dt><dd>{e.fee} {e.fee==='1'?'coin':'coins'}, plus {packed?<>your packed gear ({packedNames??`${packed} items`}): it goes to the bank if you die.</>:'nothing else: you go in bare-handed.'} Treasure only becomes yours if you escape.</dd></div>
 </dl>}
 {view==='Rules & hazards'&&<Pages items={pages} label="Dungeon rule pages" className="offer-details" prevLabel="‹ Back" nextLabel="More rules ›" render={p=><><h4>{p.title}</h4><Reading text={p.text} limit={190}/></>}/>}
 {view==='Track record'&&<EditionRecord record={e.record}/>}
 {error&&<Reading text={error}/>}
 <button className="primary" disabled={disabled||!!error} onClick={onAdmit}>{e.fee==='0'?'Descend · free entry':<>Pay {e.fee} {e.fee==='1'?'coin':'coins'} &amp; enter {e.terms.title}</>}</button>
 </div></article>;
}
