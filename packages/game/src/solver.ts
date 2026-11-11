// Bounded breadth-first search over real game states (the same deterministic engine as play):
// can a player reach a goal tile on the current floor? Used to check puzzle rooms.
import {act,type Action} from './actions';
import type {RunState,Point} from './state';
export type SolveResult={solved:boolean;actions:Action[];explored:number;truncated:boolean};
const stateKey=(s:RunState)=>JSON.stringify([s.roomIndex,s.player.x,s.player.y,s.enemies.map(e=>[e.id,e.x,e.y,e.stunned??0,e.recovering?1:0]),s.signals??{},(s.features??[]).map(f=>[f.spent?1:0,(f as {fuse?:number}).fuse??0]),s.keys??[],(s.devices??[]).length,(s.features??[]).some(f=>f.kind==='clock')?(s.floorTurn??0)%27720:0]);
/** Moves, shoves and waits only; enemies and hazards resolve exactly as in play. */
export function solveReach(start:RunState,goal:Point,maxStates=20000,maxDepth=60):SolveResult{
 const seen=new Set([stateKey(start)]);let frontier:{s:RunState;path:Action[]}[]=[{s:start,path:[]}];let explored=0;
 for(let depth=0;depth<maxDepth&&frontier.length;depth++){
  const next:typeof frontier=[];
  for(const {s,path} of frontier){
   const options:Action[]=[{type:'wait'}];
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=s.player.x+dx,y=s.player.y+dy;const e=s.enemies.find(e=>e.x===x&&e.y===y);options.push(e?{type:'shove',enemyId:e.id}:{type:'move',x,y});}
   for(const a of options){
    const n=act(s,a);if(n===s||n.status!=='active')continue;
    if(n.player.x===goal.x&&n.player.y===goal.y&&n.roomIndex===s.roomIndex)return {solved:true,actions:[...path,a],explored,truncated:false};
    const k=stateKey(n);if(seen.has(k))continue;seen.add(k);explored++;
    if(explored>=maxStates)return {solved:false,actions:[],explored,truncated:true};
    next.push({s:n,path:[...path,a]});
   }
  }
  frontier=next;
 }
 return {solved:false,actions:[],explored,truncated:frontier.length>0};
}
