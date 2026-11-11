import React,{useState} from 'react';
import {BuilderStudio,StudioStatus} from './BuilderStudio';
import {InteriorBuilder} from './InteriorBuilder';
import {defaultInterior,type BuildingKind,type InteriorLayout} from '../../../packages/game/src/interiors';
import {withBuildingUse} from '../../../packages/game/src/town-spaces';
import {districtPlaces,districts,type DistrictId} from '../../../packages/game/src/town-districts';
import {landRules,plotsOwned} from '../../../packages/shared/src/land';
import type {Shopfront} from '../../../packages/shared/src/types';
export type BuildableEdition={id:string;maker:string;closed:boolean;status:string;terms:{title:string}};
export function ShopBuilder({district:initialDistrict,shops,existing,command,refresh,onClose,onBusyChange,profile,editions=[]}:{district:DistrictId;shops:Shopfront[];existing?:Shopfront;command:(action:any)=>Promise<void>;refresh:()=>Promise<void>;onClose:()=>void;onBusyChange:(busy:boolean)=>void;profile?:string;editions?:BuildableEdition[]}){
 const [district,setDistrict]=useState<DistrictId>(existing?.district as DistrictId??initialDistrict);
 const [point,setPoint]=useState({x:existing?.x??14,y:existing?.y??7}),[title,setTitle]=useState(existing?.title??'My shop'),[room,setRoom]=useState(false),[open,setOpen]=useState(existing?.open??false),[notice,setNotice]=useState('');
 const [initial,setInitial]=useState<InteriorLayout>(()=>existing?JSON.parse(existing.interior):defaultInterior('market'));
 const kind:BuildingKind=initial.kind==='dungeon'?'dungeon':'shop';
 const mine=editions.filter(e=>e.maker===profile&&!e.closed);
 const linked=kind==='dungeon'?editions.find(e=>e.id===initial.edition):undefined;
 const chooseUse=(next:BuildingKind,edition?:string)=>{const layout=withBuildingUse(initial,next,next==='dungeon'?edition??initial.edition??mine[0]?.id:undefined);setInitial(layout);const e=editions.find(e=>e.id===layout.edition);if(next==='dungeon'&&e&&(title==='My shop'||!title.trim()))setTitle(`${e.terms.title} entrance`.slice(0,80));if(next==='dungeon'&&!existing)setOpen(true);if(next==='shop'&&/ entrance$/.test(title))setTitle('My shop');};
 const used=profile?plotsOwned(shops,profile):0,atLimit=!existing&&used>=landRules.maxPlotsPerOwner;
 const buildings=districtPlaces(district,shops.filter(s=>s.id!==existing?.id));
 const blocked=point.x<4||point.x>19||point.y<1||point.y>11||buildings.some(b=>point.x<=b.x+b.width&&point.x+3>=b.x&&point.y<=b.y+b.height&&point.y+2>=b.y)||(point.x<=12&&point.x+3>12&&point.y<=9&&point.y+2>9);
 const badLink=kind==='dungeon'&&(!linked||linked.maker!==profile||linked.closed);
 const invalid=blocked||atLimit||badLink||!title.trim()||new TextEncoder().encode(title).length>80;
 const noun=kind==='dungeon'?'entrance':'shop';
 if(room)return <InteriorBuilder place="market" initial={initial} returnLabel="Back to placement" persist={false} saveLabel={existing?`Confirm ${noun} changes`:`Build ${noun} on chain`} onCancel={draft=>{if(draft)setInitial(draft);setRoom(false);}} onApply={async layout=>{onBusyChange(true);try{const definition={title:title.trim(),district,x:point.x,y:point.y,interior:JSON.stringify(layout),open};await command(existing?{type:'update_shop',shop_id:existing.id,expected_version:existing.version,...definition}:{type:'create_shop',...definition});await refresh();onClose();}finally{onBusyChange(false);}}}/>;
 return <BuilderStudio title={existing?`Edit your ${noun}`:'Place a building'} onClose={onClose}><section className="shop-site-builder"><div className="shop-site-map" role="group" aria-label="Choose building footprint">{Array.from({length:24*16},(_,i)=>{const x=i%24,y=Math.floor(i/24),building=buildings.find(b=>x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height),selected=x>=point.x&&x<point.x+3&&y>=point.y&&y<point.y+2;return <button type="button" className={`${building?'occupied':''} ${selected?'selected':''}`} key={i} aria-label={`Place building at ${x}, ${y}${building?', occupied':''}`} onClick={()=>{setPoint({x,y});setNotice('');}}>{building?'▣':selected?'▧':'·'}</button>;})}</div><aside className="shop-site-settings">
 <label>Building use<select aria-label="Building use" value={kind} onChange={e=>chooseUse(e.target.value as BuildingKind)}><option value="shop">Shop · sell stocked goods</option><option value="dungeon" disabled={!mine.length&&kind!=='dungeon'}>Dungeon entrance{mine.length?'':' · publish a dungeon first'}</option></select></label>
 {kind==='dungeon'&&<label>Opens your dungeon<select aria-label="Linked dungeon" value={initial.edition??''} onChange={e=>chooseUse('dungeon',e.target.value)}>{!linked&&<option value="">Choose an open edition</option>}{linked&&!mine.includes(linked)&&<option value={linked.id}>{linked.terms.title} · closed</option>}{mine.map(e=><option key={e.id} value={e.id}>{e.terms.title} · {e.status}</option>)}</select></label>}
 <label>Building district<select value={district} onChange={e=>setDistrict(e.target.value as DistrictId)}>{districts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Sign over the door<input maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <p>Choose a 3 × 2 footprint. Keep a clear tile around buildings and doors.</p><label><input type="checkbox" checked={open} onChange={e=>setOpen(e.target.checked)}/> Open to visitors</label>
 <p>{point.x}, {point.y} · {blocked?'This footprint is blocked. Choose clear ground.':'Footprint available; the contract checks it again.'}</p>
 <p className="plot-count">Plots: {used} of {landRules.maxPlotsPerOwner} used{existing?' · moving this building keeps its plot':''}{atLimit?' · demolish a building to free a plot':''}</p>
 {badLink&&<p>{linked?.closed?'That edition has closed. Link one of your open dungeons.':'Link one of your own open dungeons. Publish one at the guild drafting table first.'}</p>}
 <button disabled={invalid} onClick={()=>setRoom(true)}>Furnish the interior →</button>
 <p>Owner, position, use and interior are stored on the contract, so every player sees the same building and room. {kind==='dungeon'?'Visitors pay your published fee through the normal admission check; the building grants no extra rights.':'Stock goods separately after building.'} No land price is charged in this prototype.</p><StudioStatus text={notice||'Closing this draft makes no chain changes.'}/></aside></section></BuilderStudio>;
}
