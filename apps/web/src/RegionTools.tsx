import React,{useEffect,useMemo,useState} from 'react';
import type {CustomFloor} from '../../../packages/shared/src/custom-layout';
import {builtInStamps,copyRegion,inRect,mirrorStamp,normalRect,pasteStamp,rotateStamp,sealUnreachable,unreachableTiles,type Rect,type Stamp} from '../../../packages/game/src/floor-regions';

type Brush='wall'|'floor'|'spawn'|'exit';
type Options={active:boolean;floor:CustomFloor;floorIndex:number;storageScope:string;tool:unknown;setTool:(t:Brush)=>void;paint:(x:number,y:number)=>void;
 editTiles:(floorIndex:number,tiles:string[])=>void;setNotice:(text:string)=>void;onCursor?:(x:number,y:number)=>void};
const stampKey=(scope:string)=>'saltwake.builder-stamps.v1:'+scope;
function loadStamps(scope:string):Stamp[]{try{const v=JSON.parse(localStorage.getItem(stampKey(scope))??'[]');return Array.isArray(v)?v.filter(s=>s&&typeof s.name==='string'&&Array.isArray(s.tiles)&&s.tiles.every((r:unknown)=>typeof r==='string'&&/^[#. ]*$/.test(r as string))).slice(0,24):[];}catch{return [];}}

/** Region select, copy/paste/rotate/mirror, room stamps and a keyboard cursor for the dungeon grid.
 * The builder routes tile clicks, hovers and keys here first; geometry edits go through its undoable edit. */
export function useRegionTools(o:Options){
 const [mode,setMode]=useState<'off'|'select'|'paste'>('off');
 const [anchor,setAnchor]=useState<{x:number;y:number}|null>(null),[rect,setRect]=useState<Rect|null>(null);
 const [clip,setClip]=useState<Stamp|null>(null),[hover,setHover]=useState<{x:number;y:number}|null>(null),[cursor,setCursor]=useState<{x:number;y:number}|null>(null);
 const [stamps,setStamps]=useState<Stamp[]>(()=>loadStamps(o.storageScope)),[stampName,setStampName]=useState('');
 useEffect(()=>{if(!o.active){setMode('off');setAnchor(null);}},[o.active]);
 useEffect(()=>{setRect(null);setAnchor(null);},[o.floorIndex]);
 const persist=(next:Stamp[])=>{setStamps(next);try{localStorage.setItem(stampKey(o.storageScope),JSON.stringify(next));}catch{o.setNotice('Could not save stamps in this browser.');}};
 const h=o.floor.tiles.length,w=o.floor.tiles[0]?.length??0;
 const cut=useMemo(()=>unreachableTiles(o.floor),[o.floor.tiles,o.floor.spawn.x,o.floor.spawn.y]);
 const stampAt=(x:number,y:number)=>{if(!clip)return;const r=pasteStamp(o.floor,clip,x,y);o.editTiles(o.floorIndex,r.tiles);o.setNotice(`Stamped ${clip.name}: ${r.changed} tiles changed${r.skipped?`, ${r.skipped} kept (outer wall or markers)`:''}. Undo reverses it.`);};
 const pick=(x:number,y:number)=>{if(!anchor){setAnchor({x,y});setRect(normalRect({x,y},{x,y}));o.setNotice('Now click the opposite corner of the area.');}else{const r=normalRect(anchor,{x,y});setRect(r);setAnchor(null);o.setNotice(`Selected ${r.x1-r.x0+1} × ${r.y1-r.y0+1}. Copy it, fill it, or save it as a stamp.`);}};
 const fill=(ch:'#'|'.')=>{if(!rect)return;const s:Stamp={name:ch==='#'?'wall fill':'floor fill',tiles:Array.from({length:rect.y1-rect.y0+1},()=>ch.repeat(rect.x1-rect.x0+1))};const r=pasteStamp(o.floor,s,rect.x0,rect.y0);o.editTiles(o.floorIndex,r.tiles);setRect(null);setMode('off');o.setNotice(`Filled the area with ${ch==='#'?'wall':'floor'}${r.skipped?` (${r.skipped} tiles kept for markers or the outer wall)`:''}.`);};
 const copy=()=>{if(!rect)return;setClip(copyRegion(o.floor,rect,'Copied area'));setMode('paste');o.setNotice('Copied. Click where its top-left corner should go (R rotates, M mirrors, Esc stops).');};
 const choose=(s:Stamp)=>{setClip(s);setMode('paste');o.setNotice(`${s.name}: click to place its top-left corner. R rotates, M mirrors, Esc stops.`);};
 const save=()=>{const source=rect?copyRegion(o.floor,rect):clip;if(!source)return;const name=stampName.trim().slice(0,40)||`Stamp ${stamps.length+1}`;persist([...stamps.filter(s=>s.name!==name),{name,tiles:source.tiles}].slice(-24));setStampName('');o.setNotice(`Saved stamp “${name}”. It is in your stamp list on this device.`);};
 const footprint=(x:number,y:number)=>{if(mode!=='paste'||!clip||!hover)return false;const dx=x-hover.x,dy=y-hover.y;return dy>=0&&dy<clip.tiles.length&&dx>=0&&dx<(clip.tiles[0]?.length??0)&&'#.'.includes(clip.tiles[dy][dx]);};
 const onCellClick=(x:number,y:number)=>{if(!o.active||mode==='off')return false;setCursor({x,y});if(mode==='select')pick(x,y);else stampAt(x,y);return true;};
 const cellClass=(x:number,y:number)=>[rect&&inRect(rect,x,y)?'fb-selected':'',footprint(x,y)?(clip!.tiles[y-hover!.y][x-hover!.x]==='#'?'fb-preview-wall':'fb-preview-floor'):'',cursor&&cursor.x===x&&cursor.y===y?'fb-cursor':'',o.active&&cut.has(`${x},${y}`)?'fb-unreachable':''].join(' ');
 const onHover=(x:number,y:number)=>{if(mode==='paste')setHover({x,y});};
 const onKeyDown=(e:React.KeyboardEvent)=>{
  if(!o.active||e.metaKey||e.ctrlKey||e.altKey)return;const t=e.target as HTMLElement;if(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;
  const dirs:Record<string,[number,number]>={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};const k=e.key;
  const at=cursor??{x:o.floor.spawn.x,y:o.floor.spawn.y};
  if(dirs[k]){e.preventDefault();const n={x:Math.max(0,Math.min(w-1,at.x+dirs[k][0]*(e.shiftKey?5:1))),y:Math.max(0,Math.min(h-1,at.y+dirs[k][1]*(e.shiftKey?5:1)))};setCursor(n);o.onCursor?.(n.x,n.y);if(mode==='paste')setHover(n);return;}
  const map:Record<string,()=>void>={' ':()=>{if(mode==='paste')stampAt(at.x,at.y);else if(mode==='select')pick(at.x,at.y);else o.paint(at.x,at.y);},Enter:()=>map[' '](),
   w:()=>{o.setTool('wall');setMode('off');},f:()=>{o.setTool('floor');setMode('off');},s:()=>{o.setTool('spawn');setMode('off');},e:()=>{o.setTool('exit');setMode('off');},
   v:()=>{setMode(mode==='select'?'off':'select');setAnchor(null);},c:copy,p:()=>{if(clip)setMode('paste');},r:()=>clip&&setClip(rotateStamp(clip)),m:()=>clip&&setClip(mirrorStamp(clip)),
   Escape:()=>{setMode('off');setAnchor(null);setRect(null);}};
  const fn=map[k.length===1?k.toLowerCase():k];if(fn){e.preventDefault();e.stopPropagation();fn();}
 };
 const panel=<fieldset className="region-tools"><legend>Area &amp; stamps</legend>
  <div className="studio-row">
   <button type="button" aria-pressed={mode==='select'} onClick={()=>{setMode(mode==='select'?'off':'select');setAnchor(null);}}>Select area (V)</button>
   <button type="button" disabled={!rect} onClick={copy}>Copy (C)</button>
   <button type="button" disabled={!rect} onClick={()=>fill('#')}>Fill wall</button>
   <button type="button" disabled={!rect} onClick={()=>fill('.')}>Fill floor</button>
  </div>
  <div className="studio-row">
   <button type="button" aria-pressed={mode==='paste'} disabled={!clip} onClick={()=>setMode(mode==='paste'?'off':'paste')}>Paste (P){clip?`: ${clip.name}`:''}</button>
   <button type="button" disabled={!clip} onClick={()=>clip&&setClip(rotateStamp(clip))}>Rotate ↻ (R)</button>
   <button type="button" disabled={!clip} onClick={()=>clip&&setClip(mirrorStamp(clip))}>Mirror ⇋ (M)</button>
  </div>
  {cut.size>0&&<p className="pack-warn">{cut.size} floor {cut.size===1?'tile is':'tiles are'} cut off from arrival (hatched red). Connect them with a corridor, or <button type="button" onClick={()=>{o.editTiles(o.floorIndex,sealUnreachable(o.floor));o.setNotice(`Walled off ${cut.size} unreachable tiles.`);}}>wall them off</button></p>}
  <div className="studio-row"><input aria-label="Stamp name" placeholder="Stamp name" value={stampName} maxLength={40} onChange={e=>setStampName(e.target.value)}/><button type="button" disabled={!rect&&!clip} onClick={save}>Save as stamp</button></div>
  <div className="stamp-list" role="list" aria-label="Room stamps">{[...builtInStamps,...stamps].map((s,i)=><span role="listitem" key={s.name+i} className={clip?.name===s.name?'chosen':''}><button type="button" title={s.tiles.join('\n')} onClick={()=>choose(s)}><StampPreview stamp={s}/>{s.name}</button>{i>=builtInStamps.length&&<button type="button" aria-label={`Delete stamp ${s.name}`} onClick={()=>persist(stamps.filter(x=>x!==s))}>×</button>}</span>)}</div>
  <p className="studio-hint">Keys on the map: arrows move the cursor (Shift jumps 5), Space paints or places, W/F/S/E pick a brush, V select, C copy, P paste, R rotate, M mirror, Esc stop. ⌘Z undoes any of it.</p>
 </fieldset>;
 return {mode,onCellClick,cellClass,onHover,onKeyDown,panel};
}

function StampPreview({stamp}:{stamp:Stamp}){const w=stamp.tiles[0]?.length??1;return <span className="stamp-preview" style={{gridTemplateColumns:`repeat(${w},6px)`}} aria-hidden="true">{stamp.tiles.flatMap((r,y)=>[...r].map((c,x)=><i key={`${x},${y}`} className={c==='#'?'w':c==='.'?'f':''}/>))}</span>;}
