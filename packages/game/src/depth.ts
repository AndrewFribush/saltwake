// Rules v12 run mechanics: kegs, fire, cracked walls, chasms, springs, altars, supplies,
// the tide and the four depth enemies. Deterministic: rehearsal and paid play share it.
import {armorReduction} from '../../shared/src/equipment';
import {bombDamage,dartDamage,flashRadius,flashTurns,maxSupplies,nestAlive,nestPeriod,nestTotal,ratHp,supplyCatalog,type SupplyKind} from '../../shared/src/depth-components';
import {distance,walkable,seeThrough,featureAt,type RunState,type Enemy,type Point,type FeatureState} from './state';
export type Ctx={s:RunState;guard:boolean;late:boolean;exploded:Set<string>;hitPlayer:(damage:number,source:string)=>void};
export function makeCtx(s:RunState,guard:boolean):Ctx{
 const ctx:Ctx={s,guard,late:false,exploded:new Set(),hitPlayer:(damage,source)=>{
  if(s.player.hp<=0)return;
  const raw=Math.max(1,damage-(s.player.armor?armorReduction:0)-(s.buffs?.ward??0));const hit=ctx.guard?Math.ceil(raw/2):raw;ctx.guard=false;
  s.player.hp=Math.max(0,s.player.hp-hit);s.log.push(`${source} hits for ${hit}.`);
 }};
 return ctx;
}
export const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y;
export const chebyshev=(a:Point,b:Point)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
export const square=(c:Point)=>{const out:Point[]=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)out.push({x:c.x+dx,y:c.y+dy});return out;};
const neighbors4=(p:Point)=>[{x:p.x,y:p.y-1},{x:p.x+1,y:p.y},{x:p.x,y:p.y+1},{x:p.x-1,y:p.y}];
/** Readable log name for depth runs, e.g. "powder crab #1" or "rat #2.3". */
export const who=(e:Enemy)=>`${enemyName(e)} #${e.id.replace(/^floor-\d+-slot-/,'').replace(/-rat/,'.')}`;
export const enemyName=(e:Enemy)=>e.minion?'rat':e.kind==='archer'?'sentry':e.kind==='bomber'?'powder crab':e.kind==='brute'?'brute':e.kind==='nest'?'nest':e.kind==='charger'?'charger':'pursuer';
/** Light a keg. Every lit keg bursts during the next enemy phase: lights before the keg step wait one extra decrement. */
export function light(ctx:Ctx|undefined,f:FeatureState){if(f.kind!=='barrel'||f.spent||f.fuse)return;f.fuse=ctx?.late?1:2;(ctx?.s??null)?.log.push('A powder keg fizzes.');}
/** Damage an enemy. A powder crab killed by anything but a plain melee blow bursts. */
export function hurt(ctx:Ctx,e:Enemy,damage:number,source:string,chain=true){
 if(e.hp<=0)return;e.hp-=damage;ctx.s.log.push(`${source} hit${source==='You'?'':'s'} ${who(e)} for ${damage}.`);
 if(e.hp<=0&&e.kind==='bomber'&&chain)explodeBomber(ctx,e);
}
export function explodeBomber(ctx:Ctx,e:Enemy){if(ctx.exploded.has(e.id))return;ctx.exploded.add(e.id);e.hp=Math.min(e.hp,0);e.primed=false;ctx.s.log.push(`${who(e)} bursts!`);blast(ctx,e,e.damage??5,who(e));}
export function blast(ctx:Ctx,center:Point,damage:number,source:string){
 const s=ctx.s;s.blasts??=[];
 for(const p of square(center)){
  if(!s.room[p.y]?.[p.x])continue;
  if(!s.blasts.some(b=>same(b,p)))s.blasts.push(p);
  for(const f of (s.features??[]).filter(f=>!f.spent&&same(f,p))){
   if(f.kind==='barrel')light(ctx,f);
   else if(f.kind==='crack'){f.spent=true;s.room[p.y]=s.room[p.y].slice(0,p.x)+'.'+s.room[p.y].slice(p.x+1);s.log.push('A cracked wall collapses.');}
   else if(f.kind==='oil'&&!f.burning){f.burning=3;s.log.push('Oil catches fire.');}
  }
  if(same(p,s.player))ctx.hitPlayer(damage,`${source} blast`);
  for(const e of s.enemies)if(e.hp>0&&same(e,p))hurt(ctx,e,damage,`${source} blast`);
 }
}
/** Enemy-phase hazards after creatures act. Only depth content reaches these steps. */
export function depthHazards(ctx:Ctx,traps:()=>void){
 const s=ctx.s,features=s.features??[];
 const ready:FeatureState[]=[];for(const f of features)if(f.kind==='barrel'&&!f.spent&&f.fuse){f.fuse--;if(f.fuse<=0)ready.push(f);}
 ctx.late=true;
 for(const f of ready){f.spent=true;delete f.fuse;s.log.push('A powder keg bursts!');blast(ctx,f,f.kind==='barrel'?f.damage:5,'Keg');}
 traps();
 const burning=features.filter(f=>f.kind==='oil'&&!f.spent&&f.burning);
 for(const f of burning){
  if(same(f,s.player))ctx.hitPlayer(2,'Fire');
  for(const e of s.enemies)if(e.hp>0&&same(e,f))hurt(ctx,e,2,'Fire');
  for(const n of neighbors4(f))for(const g of features.filter(g=>!g.spent&&same(g,n))){if(g.kind==='oil'&&!g.burning)g.burning=3;if(g.kind==='barrel')light(ctx,g);}
  f.burning!--;if(!f.burning){f.spent=true;delete f.burning;}
 }
 if(s.tide&&s.player.hp>0){s.tideTurns=(s.tideTurns??0)+1;if(s.tideTurns>s.tide.turns){s.player.hp=Math.max(0,s.player.hp-s.tide.damage);s.log.push(`The tide hits for ${s.tide.damage}.`);}else if(s.tideTurns===s.tide.turns)s.log.push('The tide is at the door: next turn it floods this floor.');}
 for(const nest of s.enemies.filter(e=>e.kind==='nest'&&e.hp>0)){
  if(s.roguelike&&!nest.alerted)continue;
  nest.timer=(nest.timer??nestPeriod)-1;if(nest.timer>0)continue;nest.timer=nestPeriod;
  const alive=s.enemies.filter(e=>e.hp>0&&e.id.startsWith(nest.id+'-rat')).length,spawned=nest.spawned??0;
  const at=hatchTile(s,nest);if(!at||alive>=nestAlive||spawned>=nestTotal)continue;
  nest.spawned=spawned+1;s.enemies.push({id:`${nest.id}-rat${spawned+1}`,kind:'pursuer',minion:true,x:at.x,y:at.y,hp:ratHp,damage:nest.damage??1,intent:{...at},alerted:true});s.log.push(`A rat crawls out of ${who(nest)}.`);
 }
}
export function hatchTile(s:RunState,nest:Enemy):Point|undefined{return neighbors4(nest).find(p=>walkable(s,p)&&!same(p,s.player)&&!s.enemies.some(e=>e.hp>0&&same(e,p)));}
/** Straight line from `from` toward `dir` up to `range` tiles; stops after a keg or before a wall. */
export function lineFrom(s:RunState,from:Point,dir:Point,range:number):Point[]{
 const out:Point[]=[];let p={x:from.x+dir.x,y:from.y+dir.y};
 for(let i=0;i<range;i++){if(featureAt(s,p,'barrel')){out.push(p);break;}if(!seeThrough(s,p))break;out.push(p);p={x:p.x+dir.x,y:p.y+dir.y};}
 return out;
}
/** First creature or keg along a precomputed line takes the hit. */
export function strikeLine(ctx:Ctx,line:Point[],damage:number,source:string){
 const s=ctx.s;
 for(const p of line){
  if(same(p,s.player)){ctx.hitPlayer(damage,source);return;}
  const e=s.enemies.find(e=>e.hp>0&&same(e,p));if(e){hurt(ctx,e,damage,source);return;}
  const keg=featureAt(s,p,'barrel');if(keg){light(ctx,keg);return;}
 }
}
export function supplyTargetError(s:RunState,kind:SupplyKind,target:Point|undefined,visible:Set<string>):string{
 if(!(s.supplies?.[kind]))return 'none left';
 if(kind==='flash')return '';
 if(!target||!Number.isInteger(target.x)||!Number.isInteger(target.y))return 'needs a target';
 if(kind==='bomb')return distance(s.player,target)<1||distance(s.player,target)>supplyCatalog.bomb.range||!visible.has(`${target.x},${target.y}`)||s.room[target.y]?.[target.x]!=='.'?'target a visible floor tile within 4':'';
 const dx=Math.sign(target.x-s.player.x),dy=Math.sign(target.y-s.player.y);
 return (dx&&dy)||(!dx&&!dy)||distance(s.player,target)>supplyCatalog.dart.range?'aim along a row or column within 5':'';
}
/** Apply a validated supply use. Returns false when nothing is applied. */
export function useSupply(ctx:Ctx,kind:SupplyKind,target:Point|undefined):boolean{
 const s=ctx.s;s.supplies![kind]!--;
 if(kind==='bomb'){s.log.push('You throw a powder bomb.');blast(ctx,target!,bombDamage,'Bomb');}
 else if(kind==='dart'){const dir={x:Math.sign(target!.x-s.player.x),y:Math.sign(target!.y-s.player.y)};s.log.push('You throw a dart.');strikeLine(ctx,lineFrom(s,s.player,dir,supplyCatalog.dart.range),dartDamage,'Dart');}
 else{let n=0;for(const e of s.enemies)if(e.hp>0&&distance(e,s.player)<=flashRadius){e.stunned=Math.max(e.stunned??0,flashTurns);e.primed=false;e.aim=false;e.lane=[];n++;}s.log.push(`Flash powder! ${n} stunned.`);}
 return true;
}
export function collectCache(s:RunState){
 const cache=featureAt(s,s.player,'cache');if(cache?.kind!=='cache')return;
 s.supplies??={};const have=s.supplies[cache.supply]??0,add=Math.min(cache.count,maxSupplies-have);
 if(add<=0){s.log.push(`Your ${supplyCatalog[cache.supply].name} pouch is full.`);return;}
 s.supplies[cache.supply]=have+add;cache.spent=true;s.log.push(`Collected ${add} × ${supplyCatalog[cache.supply].name}.`);
}
/** Spring draught or altar pact on the player's tile. Returns false when not allowed. */
export function interact(s:RunState):boolean{
 const f=featureAt(s,s.player);
 if(f?.kind==='fountain'){if(s.player.hp>=12)return false;s.player.hp=Math.min(12,s.player.hp+f.heal);f.charges--;if(f.charges<=0)f.spent=true;s.log.push(`You drink from the salt spring (+${f.heal}).${f.spent?' It runs dry.':''}`);return true;}
 if(f?.kind==='altar'){if(s.player.hp<=f.cost)return false;s.player.hp-=f.cost;f.spent=true;s.buffs??={};
  if(f.boon==='might')s.buffs.might=(s.buffs.might??0)+1;else if(f.boon==='ward')s.buffs.ward=(s.buffs.ward??0)+1;
  else{const all:string[]=[];s.room.forEach((row,y)=>[...row].forEach((_,x)=>all.push(`${s.roomIndex}:${x},${y}`)));s.explored=[...new Set([...(s.explored??[]),...all])];}
  s.log.push(`Blood pact (${f.boon}): paid ${f.cost} health.`);return true;}
 return false;
}
/** Bumping a keg lights it; bumping a cracked wall chips it. */
export function bumpFeature(s:RunState,p:Point):boolean{
 const f=featureAt(s,p);
 if(f?.kind==='barrel'){if(f.fuse)return false;light(undefined,f);s.log.push('You knock the keg: it fizzes. It bursts after the next turn.');return true;}
 if(f?.kind==='crack'){f.hp--;if(f.hp<=0){f.spent=true;s.room[p.y]=s.room[p.y].slice(0,p.x)+'.'+s.room[p.y].slice(p.x+1);s.log.push('The cracked wall gives way.');}else s.log.push(`You chip the cracked wall (${f.hp} left).`);return true;}
 return false;
}
/** Depth shove: any weapon, one tile, costs the target its next action. Chasms swallow. */
export function shoveTarget(s:RunState,e:Enemy):{to:Point;fall:boolean}|null{
 if(e.kind==='brute'||e.kind==='nest')return null;
 const to={x:e.x+(e.x-s.player.x),y:e.y+(e.y-s.player.y)};
 if(featureAt(s,to,'pit'))return {to,fall:true};
 if(!walkable(s,to)||s.enemies.some(o=>o.hp>0&&same(o,to)))return null;
 return {to,fall:false};
}
// Intent planning for depth enemies; returns true when handled.
export function planDepthEnemy(s:RunState,e:Enemy,distances:Map<string,number>):boolean{
 const key=(p:Point)=>`${p.x},${p.y}`;e.aim=false;
 if(e.stunned){e.intent={x:e.x,y:e.y};e.lane=[];return true;}
 if(e.kind==='nest'){e.intent={x:e.x,y:e.y};e.hatch=(e.timer??nestPeriod)<=1?hatchTile(s,e):undefined;return true;}
 if(e.kind==='bomber'){if(e.primed||chebyshev(e,s.player)<=1){e.primed=true;e.intent={x:e.x,y:e.y};e.lane=square(e).filter(p=>s.room[p.y]?.[p.x]==='.');return true;}return false;}
 if(e.kind==='brute'){
  if(e.resting){e.intent={x:e.x,y:e.y};return true;}
  if(distance(e,s.player)===1){const dx=s.player.x-e.x,dy=s.player.y-e.y;e.intent={x:e.x,y:e.y};e.lane=[{x:s.player.x,y:s.player.y},{x:s.player.x+dy,y:s.player.y+dx},{x:s.player.x-dy,y:s.player.y-dx}].filter(p=>s.room[p.y]?.[p.x]==='.');return true;}
  return false;
 }
 if(e.kind==='archer'){
  const range=6;
  if(e.x===s.player.x||e.y===s.player.y){
   const dir={x:Math.sign(s.player.x-e.x),y:Math.sign(s.player.y-e.y)},line=lineFrom(s,e,dir,range);
   const reach=line.findIndex(p=>same(p,s.player));
   if(reach>=1&&!line.slice(0,reach).some(p=>s.enemies.some(o=>o.hp>0&&same(o,p))||featureAt(s,p,'barrel'))){e.aim=true;e.lane=line;e.intent={x:e.x,y:e.y};return true;}
  }
  const free=neighbors4(e).filter(p=>walkable(s,p)&&!same(p,s.player)&&!s.enemies.some(o=>o.id!==e.id&&same(o,p)));
  if(distance(e,s.player)===1){
   const away=free.filter(p=>(distances.get(key(p))??0)>1).sort((a,b)=>(distances.get(key(b))??0)-(distances.get(key(a))??0))[0];
   e.intent=away??{x:s.player.x,y:s.player.y};return true;
  }
  const aligned=free.find(p=>(p.x===s.player.x||p.y===s.player.y)&&distance(p,s.player)>=2&&distance(p,s.player)<=range&&lineFrom(s,p,{x:Math.sign(s.player.x-p.x),y:Math.sign(s.player.y-p.y)},range).some(q=>same(q,s.player)));
  if(aligned){e.intent=aligned;return true;}
  return false;
 }
 return false;
}
/** Enemy-phase action for depth enemies; returns true when handled. */
export function actDepthEnemy(ctx:Ctx,e:Enemy):boolean{
 const s=ctx.s;
 if(e.stunned){e.stunned--;return true;}
 if(e.kind==='nest')return true;
 if(e.kind==='bomber'&&e.primed){explodeBomber(ctx,e);return true;}
 if(e.kind==='archer'&&e.aim&&e.lane?.length){s.log.push(`${who(e)} fires.`);strikeLine(ctx,e.lane,e.damage??3,who(e));e.aim=false;e.recovering=true;return true;}
 if(e.kind==='brute'){
  if(e.resting){e.resting=false;return true;}
  e.resting=true;
  if(e.lane?.length){s.log.push(`${who(e)} smashes.`);for(const p of e.lane){if(same(p,s.player))ctx.hitPlayer(e.damage??5,who(e));for(const o of s.enemies)if(o.id!==e.id&&o.hp>0&&same(o,p))hurt(ctx,o,e.damage??5,who(e));const keg=featureAt(s,p,'barrel');if(keg)light(ctx,keg);}return true;}
  return false;
 }
 return false;
}
export function depthThreatTiles(s:RunState):Point[]{
 const out:Point[]=[];
 for(const f of s.features??[]){if(f.spent)continue;if(f.kind==='barrel'&&f.fuse)out.push(...square(f).filter(p=>s.room[p.y]?.[p.x]==='.'));if(f.kind==='oil'&&f.burning)out.push({x:f.x,y:f.y});}
 return out;
}
