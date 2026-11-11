import React from 'react';
import {Pages} from './GamePanels';
import {districts} from '../../../packages/game/src/town-districts';
import {readBuildingUse} from '../../../packages/game/src/town-spaces';
import {landRules,plotsOwned} from '../../../packages/shared/src/land';
import type {Shopfront} from '../../../packages/shared/src/types';
/** Where your plots are. Information only: you still walk there; nothing here moves you. */
export function MyBuildings({shops,profile,editions}:{shops:Shopfront[];profile:string;editions:{id:string;terms:{title:string}}[]}){
 const mine=shops.filter(s=>s.owner===profile);
 return <><p>Plots: {plotsOwned(shops,profile)} of {landRules.maxPlotsPerOwner} used ({landRules.version}). Use “Build here” in any district to place a shop or a dungeon entrance.</p>
 <Pages items={mine} label="Your buildings" empty="You have not built anything yet." render={s=>{const use=readBuildingUse(s.interior);const d=districts.find(d=>d.id===s.district);return <article key={s.id}><h3>{s.title}</h3><p>{use.kind==='dungeon'?`Dungeon entrance · ${editions.find(e=>e.id===use.edition)?.terms.title??use.edition}`:'Shop'} · {s.open?'open':'closed'}</p><p>{d?.name??s.district}, door at tile {s.x+1}, {s.y+1}</p></article>;}}/></>;
}
