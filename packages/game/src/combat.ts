import {armorReduction} from '../../shared/src/equipment';
import {encounterRules} from './component-catalog';
import {distance,walkable,type RunState,type Point} from './state';
export const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y;
// A mutable turn-local guard is shared by enemies and hazards: only one hit is halved.
export function resolveEnemies(s:RunState,guard:boolean){
 const hitPlayer=(damage:number,source:string)=>{
  const raw=Math.max(1,damage-(s.player.armor?armorReduction:0));const hit=guard?Math.ceil(raw/2):raw;guard=false;
  s.player.hp=Math.max(0,s.player.hp-hit);s.log.push(`${source} hits for ${hit}.`);
 };
 for(const e of [...s.enemies].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
  if(s.player.hp<=0)break;
  if(e.hp<=0)continue;
  if(s.roguelike&&!e.alerted){if(distance(e,s.player)>(e.alertRadius??5))continue;e.alerted=true;}
  if(e.recovering){e.recovering=false;continue;}
  // Displacement cannot teleport an enemy onto its old committed action.
  if(s.rulesVersion===4&&distance(e,e.lane?.[0]??e.intent)>1)continue;
  if(e.kind==='charger'&&e.lane?.length){
   for(const tile of e.lane){
    if(!walkable(s,tile))break;
    if(same(tile,s.player)){hitPlayer(e.damage??encounterRules.charger.damage,e.id);break;}
    const other=s.enemies.find(other=>other.id!==e.id&&other.hp>0&&same(other,tile));
    if(other){const damage=e.damage??4;other.hp-=damage;s.log.push(`${e.id} strikes ${other.id} for ${damage}.`);break;}
    e.x=tile.x;e.y=tile.y;
   }
   e.recovering=true;
  }else if(distance(e,e.intent)===1&&same(e.intent,s.player)){
   hitPlayer(e.damage??encounterRules.pursuer.damage,e.id);
  }else if(walkable(s,e.intent)&&!same(e.intent,s.player)&&!s.enemies.some(other=>other.id!==e.id&&other.hp>0&&same(other,e.intent))){e.x=e.intent.x;e.y=e.intent.y;}
 }
 for(const trap of s.traps){
  if(trap.armed){
   if(same(trap,s.player)&&s.player.hp>0)hitPlayer(trap.damage??encounterRules.spikes.damage,'Spikes');
   for(const e of s.enemies)if(e.hp>0&&same(trap,e)){const damage=trap.damage??3;e.hp-=damage;s.log.push(`Spikes hit ${e.id} for ${damage}.`);}
  }
  if(trap.period!==undefined){trap.phase=((trap.phase??0)+1)%trap.period;trap.armed=trap.phase<(trap.activeTurns??1);}else trap.armed=!trap.armed;
 }
 s.enemies=s.enemies.filter(e=>e.hp>0);
 if(s.player.hp===0)s.status='died';
 revealIntents(s);
}
export function revealIntents(s:RunState){
 const key=(p:Point)=>`${p.x},${p.y}`;
 const neighbors=(p:Point)=>[{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1}];
 const distances=new Map<string,number>([[key(s.player),0]]);const queue:Point[]=[s.player];
 for(let i=0;i<queue.length;i++)for(const next of neighbors(queue[i]))if(walkable(s,next)&&!distances.has(key(next))){distances.set(key(next),distances.get(key(queue[i]))!+1);queue.push(next);}
 for(const e of s.enemies){
  e.lane=[];
  if(s.roguelike&&!e.alerted&&distance(e,s.player)>(e.alertRadius??5)){e.intent={x:e.x,y:e.y};continue;}
  if(e.recovering){e.intent={x:e.x,y:e.y};continue;}
  if(e.kind==='charger'&&(e.x===s.player.x||e.y===s.player.y)){
   const dx=Math.sign(s.player.x-e.x),dy=Math.sign(s.player.y-e.y);
   if(dx||dy){let p={x:e.x+dx,y:e.y+dy};while(walkable(s,p)){e.lane.push(p);p={x:p.x+dx,y:p.y+dy};}}
   if(e.lane.some(p=>same(p,s.player))){e.intent=e.lane[0];continue;}e.lane=[];
  if(s.roguelike&&!e.alerted&&distance(e,s.player)>(e.alertRadius??5)){e.intent={x:e.x,y:e.y};continue;}
  }
  const choices=neighbors(e).filter(p=>walkable(s,p)&&distances.has(key(p))&&!s.enemies.some(other=>other.id!==e.id&&same(other,p)));
  choices.sort((a,b)=>distances.get(key(a))!-distances.get(key(b))!);
  e.intent=choices[0]??{x:e.x,y:e.y};
 }
}
