// Headless balance harness: plays generated dungeons per preset with simple bot policies
// through the real rules engine (creator rehearsal state, synthetic kit; no economy).
// Usage: npx tsx scripts/depth-sim.ts [seeds=80] [kit=club]
import {generateDraft,generatorPresets,estimateDraft,type GeneratorPreset} from '../packages/game/src/draft-generator';
import {creatorRehearsal,type RehearsalKit} from '../packages/game/src/authored-layout';
import {act,type Action} from '../packages/game/src/actions';
import {canContinue,canExtract,hasNextRoom} from '../packages/game/src/generation';
import {visibleThreatTiles} from '../packages/game/src/telegraph';
import {depthThreatTiles} from '../packages/game/src/depth';
import {visibleTiles} from '../packages/game/src/roguelike';
import {walkable,featureAt,type RunState,type Point} from '../packages/game/src/state';

export type Policy='cautious'|'greedy'|'reckless';
const key=(p:Point)=>`${p.x},${p.y}`;
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const nb=(p:Point)=>dirs.map(([dx,dy])=>({x:p.x+dx,y:p.y+dy}));
const lootHere=(s:RunState)=>Object.values(s.items).filter(i=>i.location.kind==='floor'&&i.location.room===s.roomIndex&&i.location.x===s.player.x&&i.location.y===s.player.y);
const carried=(s:RunState)=>Object.values(s.items).filter(i=>i.origin==='dungeon'&&['bag','weapon','armor'].includes(i.location.kind)).length;

/** Breadth-first step toward the nearest goal tile, avoiding marked danger; cracks count as passable (bumped open). */
function stepToward(s:RunState,goals:Set<string>,avoid:Set<string>,bumpKegs:boolean):Point|null{
 const explored=new Set((s.explored??[]).filter(k=>k.startsWith(s.roomIndex+':')).map(k=>k.slice(k.indexOf(':')+1)));
 const lock=(p:Point)=>{const f=featureAt(s,p,'lock');return f?.kind==='lock'&&!!s.keys?.includes(f.color);};
 const passable=(p:Point)=>(walkable(s,p)||!!featureAt(s,p,'crack')||lock(p)||bumpKegs&&!!featureAt(s,p,'barrel'))&&explored.has(key(p));
 const prev=new Map<string,string|null>([[key(s.player),null]]);const q:Point[]=[s.player];
 for(const p of q){
  if(goals.has(key(p))&&key(p)!==key(s.player)){let k=key(p);while(prev.get(k)!==key(s.player)&&prev.get(k)!==null)k=prev.get(k)!;const [x,y]=k.split(',').map(Number);return {x,y};}
  for(const n of nb(p))if(!prev.has(key(n))&&(passable(n)||goals.has(key(n))&&explored.has(key(n)))&&(!avoid.has(key(n))||goals.has(key(n)))){prev.set(key(n),key(p));if(!s.enemies.some(e=>e.x===n.x&&e.y===n.y))q.push(n);else if(goals.has(key(n)))q.push(n);}
 }
 return null;
}
function frontier(s:RunState):Set<string>{
 const explored=new Set((s.explored??[]).filter(k=>k.startsWith(s.roomIndex+':')).map(k=>k.slice(k.indexOf(':')+1)));const out=new Set<string>();
 for(const k of explored){const [x,y]=k.split(',').map(Number);if(!walkable(s,{x,y}))continue;if(nb({x,y}).some(n=>!explored.has(key(n))&&s.room[n.y]?.[n.x]!==undefined))out.add(k);}
 return out;
}
export function choose(s:RunState,policy:Policy,floorTurns:number):Action{
 // Area threats only (bolts, blasts, sweeps, charges, fire); plain melee intents are fought, not fled.
 const danger=new Set([...depthThreatTiles(s),...s.enemies.filter(e=>e.kind&&e.kind!=='pursuer'&&e.lane?.length).flatMap(e=>e.lane!)].map(key));const here=key(s.player);void visibleThreatTiles;
 const exit=s.layout![s.roomIndex].exit;const vis=visibleTiles(s);
 const deeper=hasNextRoom(s);const last=!deeper;
 // Leaving decisions.
 const loot=carried(s);
 const exitDist=(()=>{const seen=new Map([[key(s.player),0]]);const q:Point[]=[s.player];for(const p of q){if(p.x===exit.x&&p.y===exit.y)return seen.get(key(p))!;for(const n of nb(p))if(!seen.has(key(n))&&(walkable(s,n)||featureAt(s,n,'crack')||s.enemies.some(e=>e.x===n.x&&e.y===n.y))){seen.set(key(n),seen.get(key(p))!+1);q.push(n);}}return 2*(Math.abs(exit.x-s.player.x)+Math.abs(exit.y-s.player.y));})();
 const tideClose=!!s.tide&&s.tide.turns-(s.tideTurns??0)<=exitDist+6;
 const wantsOut=policy==='reckless'?last:policy==='cautious'?(loot>=1||s.player.hp<=6||floorTurns>60||tideClose):(s.player.hp<=5||tideClose);
 const wantsDeeper=policy==='reckless'?deeper:policy==='greedy'?deeper&&s.player.hp>6:false;
 if(s.player.x===exit.x&&s.player.y===exit.y){
  const pending=Object.values(s.items).some(i=>i.location.kind==='floor'&&i.location.room===s.roomIndex&&s.explored?.includes(`${s.roomIndex}:${i.location.x},${i.location.y}`))||frontier(s).size>0;
  if(wantsDeeper&&canContinue(s)&&(policy==='reckless'||!pending||tideClose)&&!(policy!=='reckless'&&wantsOut&&canExtract(s)&&!tideClose))return {type:'continue'};
  if(canExtract(s)&&(wantsOut||policy==='reckless'||!pending&&(!deeper||policy==='cautious')))return {type:'extract'};
  if(canContinue(s))return {type:'continue'};
 }
 const tonic=Object.values(s.items).find(i=>(i.type==='tonic'||i.type==='fineTonic')&&i.location.kind==='bag');
 if(tonic&&s.player.hp<=(policy==='reckless'?3:5))return {type:'use',itemId:tonic.id};
 const spring=featureAt(s,s.player,'fountain');if(spring&&s.player.hp<12)return {type:'interact'};
 const take=lootHere(s)[0];if(take&&Object.values(s.items).filter(i=>i.location.kind==='bag').length<6)return {type:'pickup',itemId:take.id};
 const adj=s.enemies.filter(e=>Math.abs(e.x-s.player.x)+Math.abs(e.y-s.player.y)===1&&!(e.kind==='bomber'&&e.primed));
 if(adj.length){const t=adj.sort((a,b)=>a.hp-b.hp)[0];return {type:'attack',enemyId:t.id};}
 // Throw a bomb at a visible enemy that is not next to us.
 if(policy!=='reckless'&&(s.supplies?.bomb??0)>0){const e=s.enemies.find(e=>vis.has(key(e))&&Math.max(Math.abs(e.x-s.player.x),Math.abs(e.y-s.player.y))>=2&&Math.abs(e.x-s.player.x)+Math.abs(e.y-s.player.y)<=4);if(e)return {type:'supply',supply:'bomb',x:e.x,y:e.y};}
 // Goals: exit when leaving, else loot/caches/springs in sight, else unexplored frontier, else exit.
 const goals=new Set<string>();const exitKnown=!!s.explored?.includes(`${s.roomIndex}:${key(exit)}`);
 if((wantsOut||policy==='reckless')&&exitKnown)goals.add(key(exit));
 else if(wantsOut||policy==='reckless'){for(const k of frontier(s))goals.add(k);}
 else{
  for(const i of Object.values(s.items))if(i.location.kind==='floor'&&i.location.room===s.roomIndex&&s.explored?.includes(`${s.roomIndex}:${i.location.x},${i.location.y}`))goals.add(`${i.location.x},${i.location.y}`);
  for(const f of s.features??[])if(!f.spent&&(f.kind==='cache'||f.kind==='crack'||f.kind==='key'||(f.kind==='lock'&&s.keys?.includes(f.color))||(f.kind==='fountain'&&s.player.hp<9))&&s.explored?.includes(`${s.roomIndex}:${f.x},${f.y}`))goals.add(key(f));
  if(!goals.size)for(const k of frontier(s))goals.add(k);
  if(!goals.size)goals.add(key(exit));
 }
 if(policy!=='reckless'&&danger.has(here)){
  // Dodge to a safe neighbor, preferring the one that keeps progress toward the goal.
  const dist=new Map<string,number>();const q=[...goals].map(k=>{const [x,y]=k.split(',').map(Number);dist.set(k,0);return {x,y};});
  for(const p of q)for(const n of nb(p))if(!dist.has(key(n))&&walkable(s,n)){dist.set(key(n),dist.get(key(p))!+1);q.push(n);}
  const safe=nb(s.player).filter(p=>walkable(s,p)&&!danger.has(key(p))&&!s.enemies.some(e=>e.x===p.x&&e.y===p.y)).sort((a,b)=>(dist.get(key(a))??999)-(dist.get(key(b))??999))[0];
  const pressOn=s.player.hp>4&&(!safe||(dist.get(key(safe))??999)>=(dist.get(here)??999))&&!s.enemies.some(e=>e.kind==='bomber'&&e.primed||e.kind==='brute'&&e.lane?.length)&&!depthThreatTiles(s).some(p=>key(p)===here);
  if(!pressOn)return safe?{type:'move',...safe}:{type:'guard'};
 }
 const avoid=policy==='reckless'||danger.has(here)?new Set<string>():danger;
 const step=stepToward(s,goals,avoid,policy==='reckless')??stepToward(s,goals,new Set(),true)??stepToward(s,frontier(s),new Set(),true);
 if(step){const e=s.enemies.find(e=>e.x===step.x&&e.y===step.y);return e?{type:'attack',enemyId:e.id}:{type:'move',...step};}
 // Blocked: step toward the nearest visible enemy to fight through.
 const foe=s.enemies.filter(e=>vis.has(key(e))).sort((a,b)=>Math.abs(a.x-s.player.x)+Math.abs(a.y-s.player.y)-Math.abs(b.x-s.player.x)-Math.abs(b.y-s.player.y))[0];
 if(foe){const st=stepToward(s,new Set([key(foe)]),new Set(),true);if(st){const e=s.enemies.find(e=>e.x===st.x&&e.y===st.y);return e?{type:'attack',enemyId:e.id}:{type:'move',...st};}}
 return {type:'wait'};
}
export type Result={status:RunState['status'];killedBy?:string;turns:number;floor:number;extracted:number;used:number;funded:number;tideDeath:boolean};
export function simulate(seed:number,preset:GeneratorPreset,policy:Policy,kit:RehearsalKit='club'):Result{
 const d=generateDraft(seed,generatorPresets[preset].options);let s=creatorRehearsal(d.floors,d.placements,kit,'tonic');
 let floorTurns=0,room=0;
 for(let i=0;i<600&&s.status==='active';i++){
  const a=choose(s,policy,floorTurns);let n=act(s,a);
  if(n===s)n=act(s,{type:'wait'});
  s=n;if(s.roomIndex!==room){room=s.roomIndex;floorTurns=0;}else floorTurns++;
 }
 return {status:s.status,killedBy:s.killedBy,turns:s.turn,floor:s.roomIndex+1,extracted:s.status==='extracted'?carried(s):0,used:Object.values(s.items).filter(i=>i.origin==='dungeon'&&i.location.kind==='consumed').length,funded:estimateDraft(d).goods,tideDeath:s.killedBy==='the rising tide'};
}
const cause=(k?:string)=>!k?'?':k.replace(/ #[\d.]+/,'').replace(/ blast$/,' (blast)');
export function report(seeds:number,kit:RehearsalKit='club'){
 const rows:string[]=[];
 for(const preset of Object.keys(generatorPresets) as GeneratorPreset[])for(const policy of ['cautious','greedy','reckless'] as Policy[]){
  const rs=Array.from({length:seeds},(_,i)=>simulate(i+1,preset,policy,kit));
  const died=rs.filter(r=>r.status==='died'),out=rs.filter(r=>r.status==='extracted');
  const causes=new Map<string,number>();for(const r of died)causes.set(cause(r.killedBy),(causes.get(cause(r.killedBy))??0)+1);
  const pct=(n:number)=>`${Math.round(100*n/rs.length)}%`;
  rows.push(`${preset.padEnd(6)} ${policy.padEnd(8)} died ${pct(died.length).padStart(4)} out ${pct(out.length).padStart(4)} stalled ${pct(rs.length-died.length-out.length).padStart(4)} · loot out ${(rs.reduce((n,r)=>n+r.extracted,0)/rs.length).toFixed(2)} + drunk ${(rs.reduce((n,r)=>n+r.used,0)/rs.length).toFixed(2)} of ${(rs.reduce((n,r)=>n+r.funded,0)/rs.length).toFixed(1)} funded · turns ${Math.round(rs.reduce((n,r)=>n+r.turns,0)/rs.length)} · floor ${(rs.reduce((n,r)=>n+r.floor,0)/rs.length).toFixed(1)} · tide ${died.filter(r=>r.tideDeath).length} · causes ${[...causes].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`${k} ${v}`).join(', ')}`);
 }
 return rows;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const seeds=Number(process.argv[2]??80),kit=(process.argv[3]??'club') as RehearsalKit;
 console.log(`Saltwake depth simulation · ${seeds} seeds per preset × policy · kit ${kit}`);
 for(const row of report(seeds,kit))console.log(row);
}
