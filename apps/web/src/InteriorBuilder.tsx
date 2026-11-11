import {BuilderStudio,StudioTabs,IssuePager,StudioStatus} from './BuilderStudio';
import {TileArt,TilesetPanel} from './tileset';
import React,{useState,useRef} from 'react';
import {defaultInterior,roomFixtures,validateInterior,type InteriorLayout} from '../../../packages/game/src/interiors';
import type {PlaceId} from '../../../packages/game/src/town';
import {Interior} from './Interior';
import './interior-builder.css';
const tools=['floor','wall','arrival','door','service','wallet','bed','shelves','barrel','chest','erase'] as const;
type Tool=typeof tools[number];
export const interiorKey=(place:PlaceId)=>`saltwake-interior:v1:${place}`;
export function readInterior(place:PlaceId):InteriorLayout{
 try{const raw=localStorage.getItem(interiorKey(place));if(raw){const value=JSON.parse(raw);if(!validateInterior(value).length)return value;}}catch{}
 return defaultInterior(place);
}
export function InteriorBuilder({place,initial,onApply,onCancel,persist=true,saveLabel="Save room",returnLabel="Close builder"}:{place:PlaceId;initial:InteriorLayout;onApply:(layout:InteriorLayout)=>void|Promise<void>;onCancel:(draft?:InteriorLayout)=>void;persist?:boolean;saveLabel?:string;returnLabel?:string}){
 const savingRef=useRef(false);
 const [saving,setSaving]=useState(false);
 const [draft,setDraft]=useState(()=>structuredClone(initial)),[tool,setTool]=useState<Tool>('wall'),[history,setHistory]=useState<InteriorLayout[]>([]),[future,setFuture]=useState<InteriorLayout[]>([]),[preview,setPreview]=useState(false),[notice,setNotice]=useState('');
 const [tab,setTab]=useState<'Layout'|'Art'|'Check'>('Layout');
 const errors=validateInterior(draft);
 function change(next:InteriorLayout){setFuture([]);setHistory(h=>[...h.slice(-39),draft]);setDraft(next);setNotice('');}
 function paint(x:number,y:number){
  const next=structuredClone(draft),rows=next.tiles.map(r=>r.split(''));const edge=x===0||x===10||y===0||y===8;
  if(tool==='door'){
   if(y!==8||x<1||x>9){setNotice('The door belongs in the south wall.');return;}
   rows[next.exit.y][next.exit.x]='#';next.exit={x,y};rows[y][x]='.';
  }else{
   if(edge){setNotice('Outer walls are fixed. Use Door to move the exit along the south wall.');return;}
   if(tool==='arrival'){next.entry={x,y};rows[y][x]='.';}
   else if(tool==='wall'||tool==='floor'){rows[y][x]=tool==='wall'?'#':'.';}
   else if(tool==='erase'){next.fixtures=next.fixtures.filter(f=>f.x!==x||f.y!==y);rows[y][x]='.';}
   else{
    const service=roomFixtures(place).find(f=>f.id===tool);
    const furniture:Record<string,[string,string]>={bed:['Guest bed','▰'],shelves:['Stock shelves','▤'],barrel:['Ingredient barrels','◉'],chest:['Supply chest','▣']};
    next.fixtures=next.fixtures.filter(f=>(f.x!==x||f.y!==y)&&(!service||f.id!==service.id));
    next.fixtures.push(service?{...service,x,y}:{id:`decor-${crypto.randomUUID()}`,name:furniture[tool][0],glyph:furniture[tool][1],x,y});rows[y][x]='.';
   }
  }
  next.tiles=rows.map(r=>r.join(''));change(next);
 }
 async function save(){if(errors.length||savingRef.current)return;savingRef.current=true;setSaving(true);try{if(persist)localStorage.setItem(interiorKey(place),JSON.stringify(draft));await onApply(structuredClone(draft));}catch(e){setNotice(e instanceof Error?e.message:'Save failed. Your draft is still open.');}finally{savingRef.current=false;setSaving(false);}}

 return <BuilderStudio title="House workshop" locked={saving} closeLabel={returnLabel} returnFocus="[data-builder-launch=interior]" onClose={()=>onCancel(draft)}><section className="interior-builder studio-editor" aria-label="Interior builder"><fieldset disabled={saving} style={{display:'contents'}}>
 {preview?<div className="studio-room-preview"><Interior place={place} busy={false} editable={false} layoutOverride={draft} onExit={()=>setPreview(false)} wallet={<p>The account book opens your wallet after saving.</p>}><p>This counter opens the house services after saving.</p></Interior></div>:<>
 <div className="studio-page integrated-workspace">
<div className="studio-drawing"><div className="studio-row"><label>Paint <select aria-label="Interior tool" value={tool} onChange={e=>setTool(e.target.value as Tool)}>{tools.map(t=><option key={t} value={t}>{t==='arrival'?'Arrival tile':t==='service'?'Service counter':t==='wallet'?'Account book':t}</option>)}</select></label><span className="studio-hint">Choose a tool, then a tile.</span></div>
 <div className="studio-map-area"><div className="interior-paint-grid" role="group" aria-label="Interior painting grid">{draft.tiles.flatMap((row,y)=>[...row].map((tile,x)=>{const f=draft.fixtures.find(f=>f.x===x&&f.y===y),entry=x===draft.entry.x&&y===draft.entry.y,exit=x===draft.exit.x&&y===draft.exit.y;return <button type="button" key={`${x},${y}`} className={`tile paint-cell ${tile==='#'?'paint-wall':''}`} aria-label={`Paint ${x}, ${y}: ${entry?'arrival':exit?'door':f?.name??(tile==='#'?'wall':'floor')}`} onClick={()=>paint(x,y)}><TileArt wall={tile==='#'}/><span>{entry?'⇥':exit?'⇩':f?.glyph??''}</span></button>;}))}</div></div><p className="studio-hint">Door: south wall · Arrival: inside · Counters need a clear approach.</p></div><aside className="builder-inspector"><label>Inspector <select aria-label="Interior inspector" value={tab} onChange={e=>setTab(e.target.value as typeof tab)}><option>Layout</option><option>Art</option><option>Check</option></select></label><div className="studio-art" hidden={tab!=='Art'}><TilesetPanel embedded/></div>{tab!=='Art'&&<><h3>{tab==='Check'?'Check your room':'Arrange the house'}</h3><p>Use the map to place furniture and service counters. Save when you are ready to move in.</p><IssuePager issues={errors}/><button type="button" onClick={()=>change(defaultInterior(place))}>Restore default draft</button></>}</aside></div>
 <div className="studio-actions"><button type="button" disabled={!history.length} onClick={()=>{setFuture(f=>[draft,...f]);setDraft(history.at(-1)!);setHistory(h=>h.slice(0,-1));setNotice('');}}>Undo</button><button type="button" disabled={!future.length} onClick={()=>{setHistory(h=>[...h,draft]);setDraft(future[0]);setFuture(f=>f.slice(1));}}>Redo</button><button type="button" disabled={!!errors.length} onClick={()=>setPreview(true)}>Walk preview</button><button type="button" className="primary" disabled={!!errors.length} onClick={()=>void save()}>{saving?'Confirming…':saveLabel}</button></div>
 <StudioStatus text={notice||(errors.length?`${errors.length} issues — open Check to review.`:'All floors, stations and the door are reachable. Changes are not saved yet.')}/>
 </>}
 </fieldset></section></BuilderStudio>;
}
