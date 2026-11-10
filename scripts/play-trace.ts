import {practiceRun} from '../packages/game/src/generation';
import {act,type Action} from '../packages/game/src/actions';
import {distance,walkable,type Point} from '../packages/game/src/state';
import {writeFileSync} from 'node:fs';
let s=practiceRun();const actions:Action[]=[];
function step(a:Action){const n=act(s,a);if(n===s)throw Error('Rejected '+JSON.stringify(a));actions.push(a);s=n;}
function pathTo(target:Point){
 const queue=[{p:{x:s.player.x,y:s.player.y},path:[] as Point[]}];const seen=new Set<string>();
 while(queue.length){const {p,path}=queue.shift()!;if(p.x===target.x&&p.y===target.y)return path;for(const d of [[1,0],[0,1],[-1,0],[0,-1]]){const n={x:p.x+d[0],y:p.y+d[1]};const k=`${n.x},${n.y}`;if(walkable(s,n)&&!seen.has(k)&&!s.enemies.some(e=>e.x===n.x&&e.y===n.y)){seen.add(k);queue.push({p:n,path:[...path,n]});}}}throw Error('No path');
}
function go(p:Point){for(const tile of pathTo(p))step({type:'move',...tile});}
step({type:'pickup',itemId:'cache-tonic'});step({type:'wait'});step({type:'wait'});step({type:'attack',enemyId:'rat-1'});step({type:'attack',enemyId:'rat-1'});
go({x:1,y:3});step({type:'equip',itemId:'cache-armor'});go({x:2,y:3});step({type:'equip',itemId:'cache-sword'});
go({x:7,y:5});console.log('First exit',s.player.hp,'health',s.turn,'turns');step({type:'continue'});
for(let i=0;s.enemies.length&&s.status==='active'&&i<35;i++){
 const e=s.enemies[0];
 if(distance(e,s.player)===1&&e.hp<=3){step({type:'attack',enemyId:e.id});continue;}
 if(e.lane?.length&&e.lane.some(p=>p.x===s.player.x&&p.y===s.player.y)){
  const safe=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dy])=>({x:s.player.x+dx,y:s.player.y+dy})).find(p=>walkable(s,p)&&!e.lane!.some(t=>t.x===p.x&&t.y===p.y)&&!s.enemies.some(t=>t.x===p.x&&t.y===p.y));
  if(safe){step({type:'move',...safe});continue;}
 }
 if(distance(e,s.player)===1){step({type:'attack',enemyId:e.id});continue;}
 const neighbors=[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).filter(p=>walkable(s,p));
 const path=neighbors.map(pathTo).sort((a,b)=>a.length-b.length)[0];if(path.length)step({type:'move',...path[0]});else step({type:'wait'});
}
if(s.status!=='active'||s.enemies.length){console.log(JSON.stringify({player:s.player,enemies:s.enemies,last:actions.slice(-15)},null,2));throw Error('trace failed');}
go({x:7,y:4});step({type:'pickup',itemId:'deep-fine'});go({x:7,y:5});step({type:'pickup',itemId:'deep-iron'});step({type:'extract'});
console.log('Extracted',s.player.hp,'health',s.turn,'turns');writeFileSync('docs/play-trace.json',JSON.stringify({actions,final:{health:s.player.hp,status:s.status,turn:s.turn}},null,2)+'\n');
