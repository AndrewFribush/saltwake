import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {depthPractice} from '../../../packages/game/src/draft-generator';
import {act} from '../../../packages/game/src/actions';
import {roomMap} from '../../../packages/game/src/room-map';
import {roomGrid,linkSide} from '../../../packages/game/src/level-map';
import {RunMinimap} from '../src/RunMinimap';

test('practice levels are grids of connected rooms and the minimap draws the squares and the bars between them',()=>{
 const s=depthPractice(17);const cells=roomGrid(s.layout!);
 const level1=cells.filter(c=>c.level===0);assert.ok(level1.length>=3,'level 1 has the arrival room plus side rooms');
 assert.equal(new Set(level1.map(c=>`${c.col},${c.row}`)).size,level1.length,'one room per cell');
 for(const [i,f] of s.layout!.entries())for(const l of f.links??[]){if(/^(down|stairs|drop)/.test(l.id))continue;const a=cells[i],b=cells[l.to];assert.equal(Math.abs(a.col-b.col)+Math.abs(a.row-b.row),1,`passage ${l.id} joins grid neighbours`);
  const [dx,dy]={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]}[linkSide(f,l)];assert.deepEqual([b.col-a.col,b.row-a.row],[dx,dy],`${l.id} leaves by the wall it points to`);}
 const html=renderToStaticMarkup(React.createElement(RunMinimap,{s,map:roomMap(s)}));
 assert.ok(html.includes('grid-map'));assert.ok((html.match(/gm-cell/g)??[]).length>=1);assert.ok(html.includes('Level 1'));
});
test('walking through a passage arrives just inside the matching door of the next room, and the known neighbour shows on the map',()=>{
 let s=depthPractice(17);const here=s.layout![0];const door=here.links!.find(l=>!/^down/.test(l.id))!;
 // Teleport beside the door and step on it (test shortcut: play rules would walk there).
 const side=linkSide(here,door);
 s={...s,player:{...s.player,x:door.x-(side==='E'?1:side==='W'?-1:0),y:door.y-(side==='S'?1:side==='N'?-1:0)},enemies:[]};
 const n=act(s,{type:'move',x:door.x,y:door.y});assert.equal(n.roomIndex,door.to,'passage travelled');
 const target=s.layout![door.to];const ret=target.links!.find(l=>l.to===0)!;
 assert.equal(Math.abs(n.player.x-ret.x)+Math.abs(n.player.y-ret.y),1,'arrival is one step inside the door back');
 const html=renderToStaticMarkup(React.createElement(RunMinimap,{s:n,map:roomMap(n)}));
 assert.ok((html.match(/gm-cell/g)??[]).length>=2,'current room and the room you came from are on the map');assert.ok(html.includes('gm-link'),'the passage between them is drawn');
});
