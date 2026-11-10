import React,{useState} from 'react';
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
export function InteriorBuilder({place,initial,onApply,onCancel}:{place:PlaceId;initial:InteriorLayout;onApply:(layout:InteriorLayout)=>void;onCancel:()=>void}){
 const [draft,setDraft]=useState(()=>structuredClone(initial)),[tool,setTool]=useState<Tool>('wall'),[history,setHistory]=useState<InteriorLayout[]>([]),[preview,setPreview]=useState(false),[notice,setNotice]=useState('');
 const errors=validateInterior(draft);
 function change(next:InteriorLayout){setHistory(h=>[...h.slice(-39),draft]);setDraft(next);setNotice('');}
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
 function save(){if(errors.length)return;try{localStorage.setItem(interiorKey(place),JSON.stringify(draft));onApply(structuredClone(draft));}catch{setNotice('This browser could not save the room. Your draft is still open; storage may be full or disabled.');}}
 if(preview)return <section><p className="builder-note">Interior preview · changes are not saved yet. Counters are demonstrations.</p><Interior place={place} busy={false} editable={false} layoutOverride={draft} onExit={()=>setPreview(false)} wallet={<p>This tile opens the real wallet after you save the room.</p>}><p>This station opens this building’s real services after you save the room.</p></Interior></section>;
 return <section className="interior-builder" aria-label="Interior builder"><div className="builder-title"><div><h2>Arrange this house</h2><p>Paint walls and floors, move the door and counters, then walk through your design.</p></div><button onClick={onCancel}>Cancel edits</button></div>
 <p className="builder-note">Saved to this browser for this house, across demo characters. Furniture is decorative and costs no game coins. This does not change inventory or ownership.</p>
 <div className="builder-tools" aria-label="Interior tools">{tools.map(t=><button key={t} aria-pressed={tool===t} onClick={()=>setTool(t)}>{t==='arrival'?'Arrival tile':t==='service'?'Service counter':t==='wallet'?'Account book':t[0].toUpperCase()+t.slice(1)}</button>)}</div>
 <div className="interior-paint-grid" role="group" aria-label="Interior painting grid">{draft.tiles.flatMap((row,y)=>[...row].map((tile,x)=>{const f=draft.fixtures.find(f=>f.x===x&&f.y===y),entry=x===draft.entry.x&&y===draft.entry.y,exit=x===draft.exit.x&&y===draft.exit.y;return <button key={`${x},${y}`} className={`tile paint-cell ${tile==='#'?'paint-wall':''}`} aria-label={`Paint ${x}, ${y}: ${entry?'arrival':exit?'door':f?.name??(tile==='#'?'wall':'floor')}`} onClick={()=>paint(x,y)}><span>{entry?'⇥':exit?'⇩':f?.glyph??''}</span></button>;}))}</div>
 <p role="status">{notice||`Tool: ${tool}. Click a tile to place it.`}</p>
 {errors.length?<ul className="builder-errors">{errors.map(e=><li key={e}>{e}</li>)}</ul>:<p>All open floors, stations and the door are reachable.</p>}
 <div className="builder-tools"><button disabled={!history.length} onClick={()=>{setDraft(history.at(-1)!);setHistory(h=>h.slice(0,-1));setNotice('');}}>Undo</button><button onClick={()=>change(defaultInterior(place))}>Restore default draft</button><button disabled={!!errors.length} onClick={()=>setPreview(true)}>Walk through preview</button><button className="primary" disabled={!!errors.length} onClick={save}>Save and enter room</button></div>
 </section>;
}
