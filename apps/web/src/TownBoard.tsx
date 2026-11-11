import React,{useState} from 'react';
import {Pages} from './GamePanels';
import {playerLabel} from './presence-names';
import type {BoardEntry} from '../../../packages/game/src/town-board';
/** The harbor notice board. Lists player buildings where they stand; marking one only pins it on your map. */
export function TownBoard({entries,directions,onMark,onClose,marked,demo,browsing={}}:{browsing?:Record<string,string[]>;demo?:boolean;entries:BoardEntry[];directions:(e:BoardEntry)=>string;onMark:(e:BoardEntry)=>void;onClose:()=>void;marked?:string}){
 const [view,setView]=useState<'dungeon'|'shop'>(entries.some(e=>e.kind==='dungeon')||!entries.length?'dungeon':'shop');
 const shown=entries.filter(e=>e.kind===view);
 return <div className="player-trade town-board" role="region" aria-label="Harbor notice board" onClick={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose();}}>
  <div className="town-board-head"><h3>Harbor notice board</h3><button autoFocus onClick={onClose}>Step away</button></div>
  <p className="trade-note">Pinned by the people who built them. Figures come from confirmed public records; nothing here is a recommendation.</p>{demo&&<p className="trade-note demo-supply">Local demo: the first buildings, stock and runs were set up by demo characters as demonstration supply, from seeded goods. They are not organic player activity.</p>}
  <div className="town-board-tabs" role="tablist">{(['dungeon','shop'] as const).map(k=><button key={k} role="tab" aria-selected={view===k} onClick={()=>setView(k)}>{k==='dungeon'?'Dungeons':'Shops'} ({entries.filter(e=>e.kind===k).length})</button>)}</div>
  <Pages items={shown} size={3} label={view==='dungeon'?'Player dungeons':'Player shops'} empty={view==='dungeon'?'No player has opened a dungeon entrance yet. Publish one at the guild, then claim a plot with Build here.':'No player shops yet. Claim a plot with Build here.'} render={e=><article key={e.shopId} className={`board-entry ${e.open?'':'closed'}`}>
   <h4>{e.title}</h4>
   <p>{playerLabel(e.owner)} · {e.districtName} · {e.open?'open':'closed'}</p>
   {e.kind==='dungeon'?(e.dungeon?<><p>{e.dungeon.title}: entry {e.dungeon.fee} coins · {e.dungeon.treasure?`${e.dungeon.funded} funded ${e.dungeon.funded===1?'attempt':'attempts'}`:`${e.dungeon.funded} ${e.dungeon.funded===1?'place':'places'} open now · no treasure`} · {e.dungeon.attempts} settled {e.dungeon.attempts===1?'run':'runs'}{e.dungeon.attempts?` (${e.dungeon.extracted} escaped, ${e.dungeon.died} died)`:''}</p>{e.dungeon.recent.length>0&&<p className="board-recent">Latest: {e.dungeon.recent.map(o=>o==='extracted'?'escaped':o).join(' · ')}</p>}</>:<p>The linked dungeon is no longer listed.</p>)
    :<p>{e.goods?.count?`${e.goods.count} ${e.goods.count===1?'item':'items'} on the shelves · ${e.goods.min===e.goods.max?`${e.goods.min}`:`${e.goods.min}–${e.goods.max}`} coins each`:'Shelves empty right now.'}{e.goods?.sold?` · ${e.goods.sold} sold to ${e.goods.buyers} ${e.goods.buyers===1?'buyer':'buyers'}`:''}</p>}
   {(browsing[e.shopId]?.length??0)>0&&<p className="board-browsing">{browsing[e.shopId].map(playerLabel).join(', ')} {browsing[e.shopId].length===1?'is':'are'} {e.kind==='dungeon'?'in the entrance hall':'browsing'} now</p>}
   <p className="trade-note">{directions(e)}</p>
   <button disabled={marked===e.shopId} onClick={()=>onMark(e)}>{marked===e.shopId?'Marked on your map':'Mark on my map'}</button>
  </article>}/>
 </div>;
}
