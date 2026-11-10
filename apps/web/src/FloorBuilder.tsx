import React, {useRef, useState} from 'react';
import {catalog} from '../../../packages/shared/src/catalog';
import type {EditionTerms, Item, ItemType, Socket} from '../../../packages/shared/src/types';
import {type CustomFloor, validateCustomFloor, encodeCustomModule} from '../../../packages/shared/src/custom-layout';
import {createRun, type RunState, type RoomLayout} from '../../../packages/game/src/state';
import {act} from '../../../packages/game/src/actions';
import {addItem} from '../../../packages/game/src/inventory';
import {enterRoom, atClearedExit, hasNextRoom, roomExit} from '../../../packages/game/src/generation';
import {explore} from '../../../packages/game/src/roguelike';
import {Run} from './Run';
import './floor-builder.css';

export type FloorBuilderProps={world:any;busy:boolean;selected:string[];command:(action:any)=>Promise<void>;refresh:()=>Promise<void>;onBusyChange?:(busy:boolean)=>void};
type Placement={enemy:Socket['enemy'];trap:boolean;reward:ItemType|null};
type Draft={id:string;title:string;fee:string;floors:CustomFloor[];placements:Placement[][]};
type Tool='wall'|'floor'|'spawn'|'exit'|0|1|2|3;
const freshFloor=():CustomFloor=>({tiles:Array.from({length:9},(_,y)=>y===0||y===8?'#############':'#...........#'),spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[{x:3,y:2},{x:8,y:2},{x:3,y:5},{x:8,y:5}]});
const emptyPlacements=():Placement[]=>Array.from({length:4},()=>({enemy:'none',trap:false,reward:null}));
const freshDraft=():Draft=>({id:crypto.randomUUID(),title:'My catacombs',fee:'0',floors:[freshFloor(),freshFloor()],placements:[emptyPlacements(),emptyPlacements()]});
const itemTypes=Object.keys(catalog) as ItemType[];
const message=(e:unknown)=>(e instanceof Error?e.message:String(e)).slice(0,600);
// Shape checks intentionally allow unfinished geometry to be saved and repaired.
function isDraft(d:any):d is Draft {
 const point=(p:any)=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<13&&p.y>=0&&p.y<9;
 return !!d&&typeof d.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.id)&&typeof d.title==='string'&&d.title.length<=160&&typeof d.fee==='string'&&d.fee.length<=16&&Array.isArray(d.floors)&&d.floors.length>=2&&d.floors.length<=4&&d.floors.every((f:any)=>f&&Array.isArray(f.tiles)&&f.tiles.length===9&&f.tiles.every((r:any)=>typeof r==='string'&&/^[#.]{13}$/.test(r))&&point(f.spawn)&&point(f.exit)&&Array.isArray(f.sockets)&&f.sockets.length===4&&f.sockets.every(point))&&Array.isArray(d.placements)&&d.placements.length===d.floors.length&&d.placements.every((ps:any)=>Array.isArray(ps)&&ps.length===4&&ps.every((p:any)=>p&&['none','pursuer','charger'].includes(p.enemy)&&typeof p.trap==='boolean'&&(p.reward===null||itemTypes.includes(p.reward))));
}
function loadDrafts(key:string):{drafts:Draft[];error:string;active?:string} {
 try {
  const raw=localStorage.getItem(key);if(!raw)return {drafts:[freshDraft()],error:''};
  if(raw.length>500_000)throw Error('Saved drafts are too large.');
  const data=JSON.parse(raw);
  if(data?.version!==1||!Array.isArray(data.drafts)||!data.drafts.length||data.drafts.length>20||!data.drafts.every(isDraft)||new Set(data.drafts.map((d:Draft)=>d.id)).size!==data.drafts.length)throw Error('Saved draft format is invalid.');
  return {drafts:data.drafts,error:'',active:typeof data.active==='string'&&data.drafts.some((d:Draft)=>d.id===data.active)?data.active:undefined};
 }catch(e){return {drafts:[freshDraft()],error:`Could not load saved drafts: ${message(e)} Existing storage has not been replaced. Save explicitly to replace it.`};}
}
function socketsFor(d:Draft):Socket[]{return d.placements.flatMap((ps,room)=>ps.map((p,slot)=>({...p,id:`floor-${room}-slot-${slot}`,room,slot})));}
function previewFor(d:Draft):RunState {
 const s=createRun();s.items={};s.originalTownIds=[];s.reservedItemIds=[];
 s.roguelike=true;s.explored=[];
 addItem(s,{id:'preview-club',type:'club',origin:'town',location:{kind:'weapon'}});
 s.layout=d.floors.map((f,room):RoomLayout=>({id:`preview-floor-${room}`,title:`${d.title} — floor ${room+1}`,tiles:[...f.tiles],spawn:{...f.spawn},exit:{...f.exit},enemies:d.placements[room].flatMap((p,slot)=>p.enemy==='none'?[]:[{...f.sockets[slot],id:`preview-enemy-${room}-${slot}`,kind:p.enemy,hp:p.enemy==='charger'?6:4,intent:{...f.sockets[slot]},alerted:false}]),traps:d.placements[room].flatMap((p,slot)=>p.trap?[{...f.sockets[slot],id:`preview-trap-${room}-${slot}`,armed:true}]:[])}));
 for(const socket of socketsFor(d))if(socket.reward)addItem(s,{id:`preview-reward-${socket.room}-${socket.slot}`,type:socket.reward,origin:'dungeon',location:{kind:'floor',room:socket.room,...d.floors[socket.room].sockets[socket.slot]}});
 s.log=['Synthetic rehearsal. Nothing carries home.'];enterRoom(s,0);explore(s);return s;
}

/** Remount the entire local session on profile change; drafts and undo never cross accounts. */
export function FloorBuilder(props:FloorBuilderProps){return typeof props.world?.profile==='string'?<BuilderSession key={props.world.profile} {...props}/>:null;}
function BuilderSession({world,busy,selected,command,refresh,onBusyChange}:FloorBuilderProps){
 const storageKey=`dungeon-floor-builder:v1:${encodeURIComponent(world.profile)}`;
 const [loaded]=useState(()=>loadDrafts(storageKey));
 const [drafts,setDrafts]=useState(loaded.drafts);
 const [active,setActive]=useState(loaded.active??loaded.drafts[0].id);
 const [history,setHistory]=useState<Record<string,Draft[]>>({});
 const [floorSelection,setFloorIndex]=useState(0);
 const [tool,setTool]=useState<Tool>('wall');
 const [notice,setNotice]=useState('');
 const [saveError,setSaveError]=useState(loaded.error);
 const [saveStatus,setSaveStatus]=useState('');
 const [working,setWorking]=useState(false);
 const [preview,setPreview]=useState<RunState|null>(null);
 const inflight=useRef(false);
 const draft=drafts.find(d=>d.id===active)!;
 const floorIndex=Math.min(Math.max(0,floorSelection),draft.floors.length-1);
 const floor=draft.floors[floorIndex];
 const locked=busy||working;
 const unresolved=(world.operations??[]).some((o:any)=>['Pending','Unknown'].includes(o.status));
 const placements=socketsFor(draft);
 const geometryErrors=draft.floors.flatMap((f,i)=>validateCustomFloor(f).map(e=>`Floor ${i+1}: ${e}`));
 const formErrors=[...geometryErrors];
 if(!draft.title.trim()||new TextEncoder().encode(draft.title).length>80)formErrors.push('Give the expedition a name of at most 80 bytes.');
 if(!/^\d{1,7}$/.test(draft.fee)||Number(draft.fee)>1_000_000)formErrors.push('Entry fee must be a whole number from 0 to 1,000,000.');
 const cost=placements.reduce((sum,p)=>sum+(p.enemy==='pursuer'?2:p.enemy==='charger'?3:0)+Number(p.trap)+Number(p.reward!==null),2);
 const required:Partial<Record<ItemType,number>>={};
 for(const p of placements)if(p.reward)required[p.reward]=(required[p.reward]??0)+1;
 const funding=[...new Set(selected)];
 const owned=funding.map(id=>(world.items as Item[]).find(i=>i.id===id&&i.location.kind==='owned'&&i.location.profile===world.profile));
 const available:Partial<Record<ItemType,number>>={};
 for(const item of owned)if(item)available[item.item_type]=(available[item.item_type]??0)+1;
 const fundingErrors:string[]=[];
 if(funding.length!==selected.length)fundingErrors.push('Remove duplicate funding selections.');
 if(funding.length>128)fundingErrors.push('Select at most 128 funding items.');
 if(owned.some(i=>!i))fundingErrors.push('Some selected items are no longer owned by this profile. Refresh and select again.');
 if(owned.some(i=>i&&!required[i.item_type]))fundingErrors.push('Deselect items whose type is not used by a reward socket.');
 for(const type of itemTypes)if((available[type]??0)<(required[type]??0))fundingErrors.push(`Select ${required[type]} ${catalog[type].name} for one complete attempt (${available[type]??0} selected).`);
 if(!/^\d+$/.test(String(world.credits))||BigInt(world.credits)<BigInt(cost))fundingErrors.push(`You need ${cost} coins for placement.`);
 const edit=(change:(next:Draft)=>void)=>{
  if(locked||inflight.current||preview)return;
  const next=structuredClone(draft);change(next);
  if(JSON.stringify(next)===JSON.stringify(draft))return;
  setHistory(h=>({...h,[active]:[...(h[active]??[]).slice(-49),draft]}));
  setDrafts(ds=>ds.map(d=>d.id===active?next:d));setSaveStatus('Unsaved changes');setNotice('');
 };
 const paint=(x:number,y:number)=>edit(d=>{
  const f=d.floors[floorIndex];
  if(tool==='wall'||tool==='floor')f.tiles[y]=f.tiles[y].slice(0,x)+(tool==='wall'?'#':'.')+f.tiles[y].slice(x+1);
  else if(tool==='spawn'||tool==='exit')f[tool]={x,y};else f.sockets[tool]={x,y};
 });
 const save=()=>{
  if(locked||inflight.current)return;
  try {localStorage.setItem(storageKey,JSON.stringify({version:1,drafts,active}));setSaveError('');setSaveStatus('All drafts saved on this device.');}
  catch(e){setSaveError(`Save failed: ${message(e)} Keep this page open; your edits remain in memory.`);setSaveStatus('');}
 };
 const execute=async(publish:boolean)=>{
  if(locked||inflight.current||(publish&&(unresolved||formErrors.length||fundingErrors.length)))return;
  inflight.current=true;setWorking(true);onBusyChange?.(true);setNotice('');
  let published=false;
  try {
   if(publish){
    // Read at submission time: cleared receipts must never revive an old publication.
    const saved=sessionStorage.getItem('dungeon-pending-command:'+world.profile);
    const pending=saved?JSON.parse(saved)?.action:undefined;
    const pendingTerms=pending?.type==='publish'?pending.terms:undefined;
    const now=Date.now();const terms:EditionTerms={title:draft.title.trim(),rules_version:3,modules:draft.floors.map(encodeCustomModule),sockets:placements,opens_at_ms:pendingTerms?.opens_at_ms??String(now-1000),closes_at_ms:pendingTerms?.closes_at_ms??String(now+3_600_000),no_reward:placements.every(s=>s.reward===null),difficulty_tag:'standard',style_tag:'combat',run_duration_ms:'900000',max_runs:4};
    // Only IDs resolved against the current owned inventory can cross the command boundary.
    await command({type:'publish',terms,fee:String(Number(draft.fee)),funding:[...funding]});published=true;
   }
   await refresh();setNotice(publish?'Publication submitted. Check your editions and receipts below for confirmation.':'Funding view refreshed.');
  }catch(e){setNotice(`${published?'Publication submitted, but refresh failed. Check receipts before retrying. ':''}${message(e)}`);}
  finally{inflight.current=false;setWorking(false);onBusyChange?.(false);}
 };
 return <section className="floor-builder" aria-label="Dungeon floor builder">
  <h3>Draw your catacombs</h3>
  <p>Carve a route, place the threats, then rehearse it for free. Opening an expedition spends real inventory from this local world.</p>
  <fieldset disabled={locked} className="fb-session">
   <div className="fb-toolbar"><label>Draft <select value={active} disabled={!!preview} onChange={e=>{setActive(e.target.value);setFloorIndex(0);setNotice('');}}>{drafts.map((d,i)=><option key={d.id} value={d.id}>{d.title||`Untitled ${i+1}`}</option>)}</select></label>
    <button type="button" disabled={!!preview||drafts.length>=20} onClick={()=>{const d=freshDraft();setDrafts(ds=>[...ds,d]);setActive(d.id);setFloorIndex(0);setSaveStatus('Unsaved changes');}}>New draft</button>
    <button type="button" onClick={save}>Save drafts</button>
   </div>
   <p role="status">{saveStatus||'Drafts stay in this browser. Save before leaving the guild.'}</p>
   {saveError&&<p className="fb-error" role="alert">{saveError}</p>}
   {preview?<div className="fb-preview">
    <h4>Free rehearsal · synthetic items</h4><p>No fee, no funding consumed, and nothing carries home. You begin with a practice club.</p>
    <div className="fb-toolbar"><button type="button" onClick={()=>setPreview(null)}>Back to editor</button><button type="button" onClick={()=>setPreview(previewFor(draft))}>Restart rehearsal</button></div>
    <Run remote={{state:preview,send:a=>{if(!locked&&!inflight.current)setPreview(s=>s?act(s,a):s);},busy:locked,title:`Rehearsal: ${draft.title}`,roomCount:draft.floors.length,terminal:null,settlement:null,exit:roomExit(preview),canExtract:atClearedExit(preview),hasNextRoom:hasNextRoom(preview)}}/>
    {preview.status!=='active'&&<p role="status">{preview.status==='died'?'You fell.':'You escaped.'} Rehearsal complete. No inventory or coins changed.</p>}
   </div>:<>
    <div className="fb-toolbar"><label>Expedition name <input value={draft.title} maxLength={80} onChange={e=>edit(d=>{d.title=e.target.value;})}/></label><label>Entry fee <input type="number" min="0" max="1000000" step="1" value={draft.fee} onChange={e=>edit(d=>{d.fee=e.target.value;})}/></label></div>
    <div className="fb-toolbar" aria-label="Floor selection">{draft.floors.map((_,i)=><button type="button" key={i} aria-pressed={i===floorIndex} onClick={()=>setFloorIndex(i)}>Floor {i+1}</button>)}<button type="button" disabled={draft.floors.length===4} onClick={()=>{edit(d=>{d.floors.push(freshFloor());d.placements.push(emptyPlacements());});setFloorIndex(draft.floors.length);}}>Add floor</button><button type="button" disabled={draft.floors.length===2} onClick={()=>{edit(d=>{d.floors.splice(floorIndex,1);d.placements.splice(floorIndex,1);});setFloorIndex(Math.max(0,floorIndex-1));}}>Remove floor</button></div>
    <div className="fb-toolbar" aria-label="Painting tools">{(['wall','floor','spawn','exit',0,1,2,3] as Tool[]).map(t=><button type="button" key={t} aria-pressed={tool===t} onClick={()=>setTool(t)}>{typeof t==='number'?`Socket ${t}`:t[0].toUpperCase()+t.slice(1)}</button>)}</div>
    <div className="fb-workspace"><div>
     <p id="fb-paint-help">Choose a tool and click a tile. Tab to a tile and press Enter or Space to paint. S = spawn, E = exit; numbers mark sockets.</p>
     <div className="fb-grid" aria-label={`Floor ${floorIndex+1}, 13 by 9 tiles`} aria-describedby="fb-paint-help">{floor.tiles.flatMap((row,y)=>[...row].map((tile,x)=>{
      const markers=[...(floor.spawn.x===x&&floor.spawn.y===y?['S']:[]),...(floor.exit.x===x&&floor.exit.y===y?['E']:[]),...floor.sockets.flatMap((p,i)=>p.x===x&&p.y===y?[String(i)]:[])];
      return <button type="button" key={`${x},${y}`} className={`tile fb-cell ${tile==='#'?'fb-wall':'fb-ground'} ${markers.length?'fb-marked':''}`} aria-label={`Column ${x}, row ${y}: ${tile==='#'?'wall':'floor'}${markers.length?`, ${markers.map(m=>m==='S'?'spawn':m==='E'?'exit':`socket ${m}`).join(', ')}`:''}`} onClick={()=>paint(x,y)}>{markers.join('/')|| (tile==='#'?'':'·')}</button>;
     }))}</div>
     <div className="fb-toolbar"><button type="button" disabled={!history[active]?.length} onClick={()=>{const h=history[active];setDrafts(ds=>ds.map(d=>d.id===active?h.at(-1)!:d));setHistory(all=>({...all,[active]:h.slice(0,-1)}));setFloorIndex(0);setSaveStatus('Unsaved changes');}}>Undo draft edit</button><button type="button" onClick={()=>edit(d=>{d.floors[floorIndex]=freshFloor();d.placements[floorIndex]=emptyPlacements();})}>Reset this floor</button><button type="button" onClick={()=>edit(d=>{d.floors=[freshFloor(),freshFloor()];d.placements=[emptyPlacements(),emptyPlacements()];setFloorIndex(0);})}>Reset all floors</button></div>
    </div><div className="fb-sockets"><h4>Floor {floorIndex+1} sockets</h4>{draft.placements[floorIndex].map((p,slot)=><fieldset key={slot}><legend>Socket {slot} <span>({floor.sockets[slot].x}, {floor.sockets[slot].y})</span></legend><label>Enemy <select value={p.enemy} onChange={e=>edit(d=>{d.placements[floorIndex][slot].enemy=e.target.value as Placement['enemy'];})}><option value="none">None</option><option value="pursuer">Pursuer · 2 coins</option><option value="charger">Charger · 3 coins</option></select></label><label><input type="checkbox" checked={p.trap} onChange={e=>edit(d=>{d.placements[floorIndex][slot].trap=e.target.checked;})}/> Spike trap · 1 coin</label><label>Reward <select value={p.reward??''} onChange={e=>edit(d=>{d.placements[floorIndex][slot].reward=e.target.value as ItemType||null;})}><option value="">None</option>{itemTypes.map(t=><option value={t} key={t}>{catalog[t].name}</option>)}</select></label></fieldset>)}</div></div>
    {formErrors.length>0&&<div className="fb-error" role="alert"><strong>Before opening</strong><ul>{formErrors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}
    <button type="button" disabled={geometryErrors.length>0} onClick={()=>{try{setPreview(previewFor(draft));setNotice('');}catch(e){setNotice(message(e));}}}>Play free rehearsal</button>
    <div className="fb-funding"><h4>Opening costs {cost} coins</h4><p>Base 2 + pursuer 2 / charger 3 + trap 1 + reward socket 1. Walls and floors are free. Reward goods are funded separately.</p>
     {Object.keys(required).length?<ul>{itemTypes.filter(t=>required[t]).map(t=><li key={t}>{catalog[t].name}: {required[t]} per attempt · {available[t]??0} selected</li>)}</ul>:<p>No rewards: no funding items needed. Deselect all satchel items.</p>}
     <p>{funding.length} selected goods transfer into the expedition. Fund at least one complete attempt; extra matching goods stock later attempts. Unused stock goes to the bank when closed.</p><p>Opens for one hour, with up to 4 concurrent runs of 15 minutes.</p>
     {fundingErrors.length>0&&<ul className="fb-error">{fundingErrors.map(e=><li key={e}>{e}</li>)}</ul>}
     {unresolved&&<p className="fb-error">An operation is unresolved. Refresh before opening another expedition.</p>}
     <div className="fb-toolbar"><button type="button" className="primary" disabled={unresolved||!!formErrors.length||!!fundingErrors.length} onClick={()=>void execute(true)}>Pay {cost} coins & open expedition</button><button type="button" onClick={()=>void execute(false)}>Refresh funding</button></div>
    </div>
   </>}
  </fieldset>
  <p role="status" className={notice?'fb-notice':''}>{working?'Waiting for confirmation…':notice}</p>
 </section>;
}
