import React from 'react';
import {playerLabel} from './presence-names';
import {useTownSquare,type Highlight} from './TownLife';
const icon:Record<Highlight['kind'],string>={dungeon:'▼',haul:'✦',commission:'✎',building:'⌂'};
/** Town-square highlights from confirmed public records (newest dungeon, biggest haul today, a filled commission,
 * newest building). Read-only. */
export function TownSquare(){
 const h=useTownSquare();
 if(!h.length)return null;
 return <ul className="town-square" aria-label="Town square highlights">{h.map(x=><li key={x.kind} className={`square-${x.kind}`}><span aria-hidden="true">{icon[x.kind]}</span> {x.text}{x.who?` · ${playerLabel(x.who)}`:''}</li>)}</ul>;
}
