import {practiceRun} from '../packages/game/src/generation';
import {act,type Action} from '../packages/game/src/actions';
import {distance,walkable,type Point} from '../packages/game/src/state';
import {writeFileSync} from 'node:fs';
const results=[];
for(const armor of [false,true]){
 let s=practiceRun(armor);const trace:Action[]=[];
 function step(a:Action){const n=act(s,a);if(n!==s){trace.push(a);s=n;}}
 step({type:'move',x:2,y:1});step({type:'move',x:3,y:1});step({type:'attack',enemyId:'rat-1'});step({type:'attack',enemyId:'rat-1'});
 // A direct route deliberately skips the detour for new equipment.
 for(const p of [{x:4,y:1},{x:5,y:1},{x:6,y:1},{x:7,y:1},{x:7,y:2},{x:7,y:3},{x:7,y:4},{x:7,y:5}])step({type:'move',...p});
 const atExit=s.player.hp;step({type:'continue'});
 for(let turn=0;turn<30&&s.status==='active'&&s.enemies.length;turn++){
  const e=s.enemies[0];if(distance(s.player,e)===1){step({type:'attack',enemyId:e.id});continue;}
  const choices=[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:s.player.x+dx,y:s.player.y+dy})).filter(p=>walkable(s,p)&&!s.enemies.some(e=>distance(p,e)===0));
  choices.sort((a,b)=>distance(a,e)-distance(b,e));step({type:'move',...choices[0]});
 }
 results.push({loadout:armor?'club + armor':'club only',policy:'rush cellar, skip found gear and potion use, close distance and attack without dodging',healthAtFirstExit:atExit,finalHealth:s.player.hp,status:s.status,enemiesLeft:s.enemies.length,turns:s.turn,trace});
}
writeFileSync('docs/loadout-comparison.json',JSON.stringify(results,null,2)+'\n');console.log(results.map(({trace,...r})=>r));
