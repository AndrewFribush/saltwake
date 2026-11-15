import React,{useState} from 'react';
import type {CustomFloor} from '../../../packages/shared/src/custom-layout';
import {roomLabel,roomLevels,roomGrid,levelCount,isDescent,dirs,dirName,type Dir} from '../../../packages/game/src/level-map';
import {GridMap,type GridLink} from './RunMinimap';

type Placement={enemy:string;trap:boolean;reward:unknown};
/** Every room at a glance. Top: each level as a grid of rooms joined by their passages, with "+" on the free sides of
 * the room being edited to add a neighbour there. Below: the floor list with drag (or buttons) to reorder. */
export function FloorOverview({floors,placements,current,onPick,onMove,onAddRoom}:{floors:CustomFloor[];placements:Placement[][];current:number;onPick:(i:number)=>void;onMove:(from:number,to:number)=>void;onAddRoom?:(from:number,dir:Dir)=>void}){
 const [drag,setDrag]=useState<number|null>(null),[over,setOver]=useState<number|null>(null);const levels=roomLevels(floors);
 const cells=roomGrid(floors);const here=cells[current];
 const glinks:GridLink[]=floors.flatMap((f,i)=>(f.links??[]).filter(l=>!isDescent(l.id)).map(l=>({from:i,to:l.to,locked:l.require_clear})));
 const taken=new Set(cells.map(c=>`${c.level}:${c.col},${c.row}`));
 return <div className="floor-overview">
  <div className="overview-levels" aria-label="Level map">
   {Array.from({length:levelCount(floors)},(_,L)=>{
    const mine=cells.map((c,index)=>({index,...c})).filter(c=>c.level===L);if(!mine.length)return null;
    const extras=onAddRoom&&here?.level===L?(Object.keys(dirs) as Dir[]).map(d=>({d,col:here.col+dirs[d][0],row:here.row+dirs[d][1]})).filter(c=>!taken.has(`${L}:${c.col},${c.row}`)).map(c=>({col:c.col,row:c.row,node:<button type="button" className="gm-add" title={`Add a room to the ${dirName[c.d]}`} aria-label={`Add a room to the ${dirName[c.d]}`} onClick={()=>onAddRoom(current,c.d)}>+</button>})):[];
    return <section key={L} className="overview-level"><h4>Level {L+1}</h4>
     <GridMap cells={mine} links={glinks} cellPx={72} extras={extras} render={i=><button type="button" className={`overview-map ${i===current?'current':''}`} onClick={()=>onPick(i)} aria-label={`Edit ${roomLabel(floors,i,levels)}`} title={roomLabel(floors,i,levels)}><MiniMap floor={floors[i]}/>{(floors[i].links??[]).some(l=>isDescent(l.id))||floors[i].links===undefined&&i<floors.length-1?<b className="gm-down" aria-hidden="true">↓</b>:null}</button>}/>
    </section>;})}
  </div>
  <p className="studio-hint">Click a room to edit it. "+" adds a room on that side, joined by a passage each way. Drag a floor onto another below to reorder; stairs (E) lead to the next floor in that order.</p>
  <ol>{floors.map((f,i)=>{const ps=placements[i]??[],enemies=ps.filter(p=>p.enemy!=='none').length,rewards=ps.filter(p=>p.reward!==null).length,rule=(f as {exit_rule?:{extract:boolean;require_clear:boolean}}).exit_rule;
   return <li key={i} draggable onDragStart={()=>setDrag(i)} onDragEnd={()=>{setDrag(null);setOver(null);}} onDragOver={e=>{e.preventDefault();setOver(i);}} onDrop={e=>{e.preventDefault();if(drag!==null&&drag!==i)onMove(drag,i);setDrag(null);setOver(null);}} className={`${i===current?'current':''} ${over===i&&drag!==i?'drop':''}`}>
    <button type="button" className="overview-map" onClick={()=>onPick(i)} aria-label={`Edit floor ${i+1}`}><MiniMap floor={f}/></button>
    <div className="overview-info"><b>{roomLabel(floors,i,levels)}</b> <small>floor {i+1}</small><small>{f.tiles[0].length}×{f.tiles.length} · {enemies} {enemies===1?'enemy':'enemies'} · {rewards} treasure</small>
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
