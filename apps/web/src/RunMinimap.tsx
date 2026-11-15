import React from 'react';
import type {RunState} from '../../../packages/game/src/state';
import {isDescent} from '../../../packages/game/src/level-map';
import type {RoomMapInfo} from '../../../packages/game/src/room-map';

type P={x:number;y:number};
export type GridCell={index:number;col:number;row:number};
export type GridLink={from:number;to:number;locked?:boolean};
/** Rooms as squares on a grid with the passages between neighbours drawn as short bars. Cells sit on even tracks,
 * connectors on the odd tracks between them. `extras` are things that occupy an empty cell (an "add room" button). */
export function GridMap({cells,links,cellPx,render,extras,className}:{cells:GridCell[];links:GridLink[];cellPx:number;render:(index:number)=>React.ReactNode;extras?:{col:number;row:number;node:React.ReactNode}[];className?:string}){
 const all=[...cells,...(extras??[])];if(!all.length)return null;
 const c0=Math.min(...all.map(c=>c.col)),r0=Math.min(...all.map(c=>c.row));
 const cols=Math.max(...all.map(c=>c.col))-c0+1,rows=Math.max(...all.map(c=>c.row))-r0+1;
 const at=new Map(cells.map(c=>[c.index,c]));const gap=Math.max(8,Math.round(cellPx/6));
 const track=(n:number)=>Array.from({length:2*n-1},(_,i)=>i%2===0?`${cellPx}px`:`${gap}px`).join(' ');
 const pos=(c:{col:number;row:number})=>({gridColumn:2*(c.col-c0)+1,gridRow:2*(c.row-r0)+1});
 const drawn=new Set<string>();
 return <div className={`grid-map ${className??''}`} style={{gridTemplateColumns:track(cols),gridTemplateRows:track(rows)}}>
  {cells.map(c=><div key={c.index} className="gm-cell" style={pos(c)}>{render(c.index)}</div>)}
  {(extras??[]).map((e,i)=><div key={`x${i}`} className="gm-extra" style={pos(e)}>{e.node}</div>)}
  {links.map(l=>{const a=at.get(l.from),b=at.get(l.to);if(!a||!b)return null;const dc=b.col-a.col,dr=b.row-a.row;if(Math.abs(dc)+Math.abs(dr)!==1)return null;
   const k=[l.from,l.to].sort((x,y)=>x-y).join('-');if(drawn.has(k))return null;drawn.add(k);
   return <i key={k} className={`gm-link ${dc?'h':'v'} ${l.locked?'locked':''}`} style={{gridColumn:2*(a.col-c0)+1+dc,gridRow:2*(a.row-r0)+1+dr}} aria-hidden="true"/>;})}
 </div>;
}

/** Minimap of the level you are on: rooms as squares on a grid joined by their passages. The room you are in shows
 * its explored tiles, rooms you have been in show what you remember, rooms a seen passage leads to are dashed until
 * you go there. Reads the same fog-safe data the board reads, so it never shows anything the fog hides. */
export function RunMinimap({s,map,exit}:{s:RunState;map?:RoomMapInfo[];exit?:P}){
 const fog=!!s.roguelike;const explored=new Set(s.explored??[]);
 const links=s.connections??[];const down=links.filter(l=>isDescent(l.id)).map(l=>l.to);
 const here=map?.[s.roomIndex];
 if(!map||!here){
  return <div className="run-minimap" aria-label="Minimap"><div className="mm-room current"><Thumb tiles={s.room} room={s.roomIndex} explored={explored} fog={fog} me={s.player} exit={exit} links={links} width={96}/></div>
   <small>{s.layout?`Level ${s.roomIndex+1} of ${s.layout.length}`:`Level ${s.roomIndex+1}`}</small></div>;
 }
 const level=here.cell.level;
 const known=new Set<number>([s.roomIndex,...links.map(l=>l.to)]);map.forEach((m,i)=>{if(m.tiles){known.add(i);for(const l of m.links??[])known.add(l.to);}});
 const cells=map.map((m,i)=>({index:i,...m.cell})).filter(c=>c.level===level&&known.has(c.index));
 const glinks:GridLink[]=[...map.flatMap((m,i)=>(m.links??[]).filter(l=>!isDescent(l.id)).map(l=>({from:i,to:l.to,locked:l.require_clear}))),...links.filter(l=>!isDescent(l.id)).map(l=>({from:s.roomIndex,to:l.to,locked:l.require_clear}))];
 const span=Math.max(...cells.map(c=>c.col))-Math.min(...cells.map(c=>c.col))+1;const cellPx=cells.length<=1?96:span>=3?48:64;
 const mates=map.map((m,i)=>m.cell.level===level?i:-1).filter(i=>i>=0);const letter=String.fromCharCode(65+mates.indexOf(s.roomIndex));
 return <div className="run-minimap" aria-label="Minimap">
  <GridMap cells={cells} links={glinks} cellPx={cellPx} render={i=>{const current=i===s.roomIndex;const tiles=current?s.room:map[i].tiles;
   return <div className={`mm-room ${current?'current':''} ${tiles?'':'unknown'}`} title={current?`Room ${letter}: you are here`:tiles?`Room ${i+1}: remembered`:`Room ${i+1}: not yet visited`}>
    {tiles?<Thumb tiles={tiles} room={i} explored={explored} fog={fog} me={current?s.player:undefined} exit={current?exit:undefined} links={current?links:(map[i].links??[])} width={cellPx-4}/>:<span aria-hidden="true">?</span>}
   </div>;}}/>
  <small>{`Level ${level+1}`}{mates.length>1?` · room ${letter} of ${mates.length}`:''}{down.length?' · stairs ↓':''}</small>
 </div>;
}
function Thumb({tiles,room,explored,fog,me,exit,links,width}:{tiles:string[];room:number;explored:Set<string>;fog:boolean;me?:P;exit?:P;links:readonly P[];width:number}){
 const w=tiles[0].length;
 return <span className="mm-grid" style={{gridTemplateColumns:`repeat(${w},1fr)`,aspectRatio:`${w}/${tiles.length}`,width:`min(${width}px,20vw)`}}>
  {tiles.flatMap((row,y)=>[...row].map((c,x)=>{const seen=!fog||explored.has(`${room}:${x},${y}`);
   const cls=!seen?'u':me&&me.x===x&&me.y===y?'me':exit&&exit.x===x&&exit.y===y?'e':links.some(l=>l.x===x&&l.y===y)?'l':c==='#'?'w':'f';
   return <i key={`${x},${y}`} className={cls}/>;}))}
 </span>;
}
