import React from 'react';
import type {RunState} from '../../../packages/game/src/state';
import {isDescent} from '../../../packages/game/src/level-map';

type P={x:number;y:number};
/** Minimap for the current level: the room you are in (explored tiles only), the rooms its passages lead to (a
 * remembered thumbnail, or a dashed box until you have been there), and where the stairs go. Reads the same state
 * the board reads, so it never shows anything the fog hides. */
export function RunMinimap({s,roomCount,exit}:{s:RunState;roomCount?:number;exit?:P}){
 const fog=!!s.roguelike;const explored=new Set(s.explored??[]);
 const links=s.connections??[];
 const side=links.filter(l=>!isDescent(l.id)).map(l=>l.to),down=links.filter(l=>isDescent(l.id)).map(l=>l.to);
 const rooms=[...new Set([s.roomIndex,...side])].sort((a,b)=>a-b);
 const tilesOf=(i:number)=>i===s.roomIndex?s.room:s.roomMemory?.[i]?.tiles;
 const total=roomCount??s.layout?.length;
 return <div className="run-minimap" aria-label="Minimap">
  <div className="run-minimap-rooms">
   {rooms.map(i=>{const tiles=tilesOf(i);const current=i===s.roomIndex;
    return <div key={i} className={`mm-room ${current?'current':''} ${tiles?'':'unknown'}`} title={current?`Room ${i+1}: you are here`:tiles?`Room ${i+1}: remembered`:`Room ${i+1}: not yet visited`}>
     {tiles?<Thumb tiles={tiles} room={i} explored={explored} fog={fog} me={current?s.player:undefined} exit={current?exit:undefined} links={current?links:[]}/>:<span aria-hidden="true">?</span>}
    </div>;})}
  </div>
  <small>{total?`Room ${s.roomIndex+1} of ${total}`:`Room ${s.roomIndex+1}`}{rooms.length>1?` · ${rooms.length} on this level`:''}{down.length?` · stairs ↓ to ${down.map(i=>i+1).join(', ')}`:''}</small>
 </div>;
}
function Thumb({tiles,room,explored,fog,me,exit,links}:{tiles:string[];room:number;explored:Set<string>;fog:boolean;me?:P;exit?:P;links:readonly P[]}){
 const w=tiles[0].length;
 return <span className="mm-grid" style={{gridTemplateColumns:`repeat(${w},1fr)`,aspectRatio:`${w}/${tiles.length}`}}>
  {tiles.flatMap((row,y)=>[...row].map((c,x)=>{const seen=!fog||explored.has(`${room}:${x},${y}`);
   const cls=!seen?'u':me&&me.x===x&&me.y===y?'me':exit&&exit.x===x&&exit.y===y?'e':links.some(l=>l.x===x&&l.y===y)?'l':c==='#'?'w':'f';
   return <i key={`${x},${y}`} className={cls}/>;}))}
 </span>;
}
