import {distance,walkable,type RunState,type Point} from './state';
const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y;
// Intents are locked before the player's action. Movement never retargets a hit.
export function resolveEnemies(s:RunState,guard:boolean){
 for(const e of [...s.enemies].sort((a,b)=>a.id.localeCompare(b.id))){
  if(s.player.hp<=0)break;
  if(distance(e,e.intent)===1&&same(e.intent,s.player)){
   const raw=Math.max(1,3-(s.player.armor?1:0));const hit=guard?Math.ceil(raw/2):raw;guard=false;
   s.player.hp=Math.max(0,s.player.hp-hit);s.log.push(`${e.id} hits for ${hit}.`);
  }else if(walkable(s,e.intent)&&!same(e.intent,s.player)&&!s.enemies.some(other=>other.id!==e.id&&same(other,e.intent))){e.x=e.intent.x;e.y=e.intent.y;}
 }
 if(s.player.hp===0)s.status='died';
 revealIntents(s);
 s.log=s.log.slice(-8);
}
export function revealIntents(s:RunState){
 // Breadth-first distances prevent the greedy back-and-forth at wall corners.
 const key=(p:Point)=>`${p.x},${p.y}`;
 const neighbors=(p:Point)=>[{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1}];
 const distances=new Map<string,number>([[key(s.player),0]]);
 const queue:Point[]=[s.player];
 for(let i=0;i<queue.length;i++){
  const p=queue[i];
  for(const next of neighbors(p))if(walkable(s,next)&&!distances.has(key(next))){
   distances.set(key(next),distances.get(key(p))!+1);queue.push(next);
  }
 }
 for(const e of s.enemies){
  const choices=neighbors(e).filter(p=>walkable(s,p)&&distances.has(key(p)));
  choices.sort((a,b)=>distances.get(key(a))!-distances.get(key(b))!);
  e.intent=choices[0]??{x:e.x,y:e.y};
 }
}
