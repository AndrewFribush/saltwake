import React,{useState} from 'react';
import type {CustomFloor} from '../../../packages/shared/src/custom-layout';

type Placement={enemy:string;trap:boolean;reward:unknown};
/** Every floor at a glance: shape, arrival/stairs, encounters and passages, with drag (or buttons) to reorder. */
export function FloorOverview({floors,placements,current,onPick,onMove}:{floors:CustomFloor[];placements:Placement[][];current:number;onPick:(i:number)=>void;onMove:(from:number,to:number)=>void}){
 const [drag,setDrag]=useState<number|null>(null),[over,setOver]=useState<number|null>(null);
 return <div className="floor-overview">
  <p className="studio-hint">Drag a floor onto another to reorder, or use the arrows. Click a floor to edit it. Stairs (E) lead to the next floor in this order; passages (↪) go where they point.</p>
  <ol>{floors.map((f,i)=>{const ps=placements[i]??[],enemies=ps.filter(p=>p.enemy!=='none').length,rewards=ps.filter(p=>p.reward!==null).length,rule=(f as {exit_rule?:{extract:boolean;require_clear:boolean}}).exit_rule;
   return <li key={i} draggable onDragStart={()=>setDrag(i)} onDragEnd={()=>{setDrag(null);setOver(null);}} onDragOver={e=>{e.preventDefault();setOver(i);}} onDrop={e=>{e.preventDefault();if(drag!==null&&drag!==i)onMove(drag,i);setDrag(null);setOver(null);}} className={`${i===current?'current':''} ${over===i&&drag!==i?'drop':''}`}>
    <button type="button" className="overview-map" onClick={()=>onPick(i)} aria-label={`Edit floor ${i+1}`}><MiniMap floor={f}/></button>
    <div className="overview-info"><b>Floor {i+1}</b><small>{f.tiles[0].length}×{f.tiles.length} · {enemies} {enemies===1?'enemy':'enemies'} · {rewards} treasure</small>
     <small>{rule?.extract===false?'No extraction here':'Can escape here'}{rule?.require_clear?' · stairs need a cleared floor':''}</small>
     <small>{i<floors.length-1?`Stairs → floor ${i+2}`:'Last floor'}{(f.links??[]).length?` · ${(f.links??[]).map(l=>`↪ ${l.to+1}`).join(' ')}`:''}</small>
     <span className="studio-row"><button type="button" aria-label={`Move floor ${i+1} earlier`} disabled={i===0} onClick={()=>onMove(i,i-1)}>↑</button><button type="button" aria-label={`Move floor ${i+1} later`} disabled={i===floors.length-1} onClick={()=>onMove(i,i+1)}>↓</button></span></div>
   </li>;})}</ol>
 </div>;
}
function MiniMap({floor}:{floor:CustomFloor}){
 const w=floor.tiles[0].length,mark=(x:number,y:number)=>floor.spawn.x===x&&floor.spawn.y===y?'s':floor.exit.x===x&&floor.exit.y===y?'e':floor.sockets.some(p=>p.x===x&&p.y===y)?'k':(floor.links??[]).some(p=>p.x===x&&p.y===y)?'l':'';
 return <span className="mini-map" style={{gridTemplateColumns:`repeat(${w},1fr)`,aspectRatio:`${w}/${floor.tiles.length}`}}>{floor.tiles.flatMap((r,y)=>[...r].map((c,x)=><i key={`${x},${y}`} className={`${c==='#'?'w':'f'} ${mark(x,y)}`}/>))}</span>;
}
