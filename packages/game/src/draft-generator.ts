// Seeded starting drafts for creators (and synthetic practice). The output is an ordinary,
// fully editable draft built only from catalog components; it is never a fixed campaign.
import {validateCustomFloor,floorFormat,type CustomFloor} from '../../shared/src/custom-layout';
import {depthReachable,featureCatalog,featureCost,enemyCost,defaultFeature,type Feature,type EnemyKind,type SupplyKind,type AltarBoon} from '../../shared/src/depth-components';
import {defaultExitRule} from '../../shared/src/exit-rules';
import type {CreatorPlacement} from '../../shared/src/creator-rewards';
import type {Device} from '../../shared/src/mechanisms';
type P={x:number;y:number};type Room={x:number;y:number;w:number;h:number};
function rng(seed:number){let n=(seed>>>0)||1;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export type GeneratedDraft={floors:CustomFloor[];placements:CreatorPlacement[][]};
export type GeneratorOptions={arena?:boolean;vaults?:boolean;floors?:number;width?:number;height?:number;danger?:1|2|3;treasure?:boolean;budget?:FloorBudget};
/** Per-floor caps used to keep generated drafts affordable. */
export type FloorBudget={enemies:number;traps:number;treasure:number;featureCoins:number;tide:boolean};
export type GeneratorPreset='small'|'medium'|'large';
export const generatorPresets:Record<GeneratorPreset,{label:string;options:GeneratorOptions}>={
 small:{label:'Small · 1 floor',options:{floors:1,width:15,height:11,danger:1,budget:{enemies:2,traps:0,treasure:1,featureCoins:2,tide:false}}},
 medium:{label:'Medium · 2 floors',options:{arena:true,vaults:true,floors:2,width:19,height:12,danger:2,budget:{enemies:3,traps:1,treasure:1,featureCoins:7,tide:true}}},
 large:{label:'Large · 3 floors',options:{arena:true,vaults:true,floors:3,danger:2}},
};
/** Placement coins and owned treasure goods a draft needs before it can open. */
export function estimateDraft(d:GeneratedDraft):{coins:number;goods:number}{
 const ps=d.placements.flat();
 return {coins:2+featureCost(d.floors)+ps.reduce((n,p)=>n+enemyCost(p.enemy)+Number(p.trap)+Number(p.reward!==null),0),goods:ps.filter(p=>p.reward!==null).length};
}
/** Largest preset (then fewer treasure spots) whose estimate fits the player's coins and goods. */
export function fitBudget(seed:number,coins:number,goods:number):{preset:GeneratorPreset;draft:GeneratedDraft;treasure:boolean}|null{
 for(const preset of ['large','medium','small'] as GeneratorPreset[])for(const treasure of [true,false]){
  const draft=generateDraft(seed,{...generatorPresets[preset].options,treasure});const e=estimateDraft(draft);
  if(e.coins<=coins&&e.goods<=goods)return {preset,draft,treasure};
 }
 return null;
}
function trimFloor(f:CustomFloor,ps:CreatorPlacement[],b:FloorBudget){
 // Keep cracked walls (they guard reachability of hidden rooms), then the cheapest-first remainder within the coin cap.
 let coins=0;const keep=new Set<string>();
 for(const x of f.features!)if(x.kind==='crack'||x.kind==='lock'||x.kind==='key'||x.kind==='plate'){keep.add(x.id);coins+=featureCatalog[x.kind].cost;}
 for(const x of f.features!)if(x.kind!=='crack'&&coins+featureCatalog[x.kind].cost<=b.featureCoins){keep.add(x.id);coins+=featureCatalog[x.kind].cost;}
 f.features=f.features!.filter(x=>keep.has(x.id));
 let enemies=0,traps=0,treasure=0;const slots:number[]=[];
 ps.forEach((p,i)=>{if(p.enemy!=='none'){if(enemies>=b.enemies)return;enemies++;}if(p.trap){if(traps>=b.traps){if(p.enemy==='none')return;p.trap=false;}else traps++;}
  if(p.reward!==null){if(treasure>=b.treasure){if(p.enemy==='none'&&!p.trap)return;p.reward=null;}else treasure++;}slots.push(i);});
 f.sockets=slots.map(i=>f.sockets[i]);const kept=slots.map(i=>ps[i]);ps.length=0;ps.push(...kept);
 if(!b.tide)delete f.tide;
}
const key=(p:P)=>`${p.x},${p.y}`;
function generateFloor(r:()=>number,depth:number,count:number,W:number,H:number,danger:number,vault=false):{floor:CustomFloor;placements:CreatorPlacement[]}|null{
 const int=(a:number,b:number)=>a+Math.floor(r()*(b-a+1));const pick=<T,>(xs:readonly T[])=>xs[Math.floor(r()*xs.length)];
 const g=Array.from({length:H},()=>Array<string>(W).fill('#'));
 const rooms:Room[]=[];
 for(let tries=0;tries<120&&rooms.length<6;tries++){
  const w=int(3,8),h=int(3,5),x=int(1,W-w-1),y=int(1,H-h-1);
  if(rooms.some(o=>x<=o.x+o.w+1&&o.x<=x+w+1&&y<=o.y+o.h+1&&o.y<=y+h+1))continue;
  rooms.push({x,y,w,h});
 }
 if(rooms.length<3)return null;
 rooms.sort((a,b)=>a.x-b.x);
 for(const m of rooms)for(let y=m.y;y<m.y+m.h;y++)for(let x=m.x;x<m.x+m.w;x++)g[y][x]='.';
 const center=(m:Room)=>({x:m.x+Math.floor(m.w/2),y:m.y+Math.floor(m.h/2)});
 const carve=(a:P,b:P)=>{let {x,y}=a;const horizontalFirst=r()<.5;
  const stepX=()=>{while(x!==b.x){x+=Math.sign(b.x-x);g[y][x]='.';}},stepY=()=>{while(y!==b.y){y+=Math.sign(b.y-y);g[y][x]='.';}};
  if(horizontalFirst){stepX();stepY();}else{stepY();stepX();}};
 // Room shapes: pillared halls and notched corners make cover and chokepoints.
 const shapes:string[]=[];
 for(const [i,m] of rooms.entries()){if(i===0||i===rooms.length-1){shapes.push('plain');continue;}
  const c=center(m);
  if(m.w>=5&&m.h>=5&&r()<.6){shapes.push('pillars');for(let y=m.y+1;y<m.y+m.h-1;y+=2)for(let x=m.x+1;x<m.x+m.w-1;x+=2)if(!(x===c.x&&y===c.y))g[y][x]='#';}
  else if(m.w>=4&&m.h>=4&&r()<.5){shapes.push('notched');for(const [x,y] of [[m.x,m.y],[m.x+m.w-1,m.y],[m.x,m.y+m.h-1],[m.x+m.w-1,m.y+m.h-1]])g[y][x]='#';}
  else shapes.push('plain');}
 for(let i=1;i<rooms.length;i++)carve(center(rooms[i-1]),center(rooms[i]));
 if(rooms.length>3&&r()<.6)carve(center(rooms[0]),center(rooms[rooms.length-1]));
 // Hidden side room behind a cracked wall: solid rock all around except the crack.
 const features:Feature[]=[];let id=0;const fid=()=>`f${depth}-${id++}`;
 let secret:P[]=[];const devices:Device[]=[];const ambushSockets:{p:P;placement:CreatorPlacement}[]=[];const ambush=depth>=1&&r()<(vault?.5:.35);const ambushKeep:P[]=[];
 // Lure vault: a gate held open only by a plate two tiles out along its approach (shove the guard onto it), and a lever-door exit.
 const lureWanted=vault&&!ambush&&r()<.6;let lure:{gate:P;approach:P;line:P;plate:P;exit:P;exitOut:P}|null=null;
 for(let tries=0;tries<60&&!secret.length;tries++){
  const w=int(2,3),h=int(2,3),x=int(2,W-w-2),y=int(2,H-h-2);
  let clear=true;for(let yy=y-1;yy<=y+h;yy++)for(let xx=x-1;xx<=x+w;xx++)if(g[yy]?.[xx]!=='#')clear=false;
  if(!clear)continue;
  const doors:P[]=[];
  for(let xx=x;xx<x+w;xx++){if(g[y-2]?.[xx]==='.')doors.push({x:xx,y:y-1});if(g[y+h+1]?.[xx]==='.')doors.push({x:xx,y:y+h});}
  for(let yy=y;yy<y+h;yy++){if(g[yy][x-2]==='.')doors.push({x:x-1,y:yy});if(g[yy][x+w+1]==='.')doors.push({x:x+w,y:yy});}
  if(!doors.length)continue;
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){g[yy][xx]='.';secret.push({x:xx,y:yy});}
  const door=pick(doors);
  if(lureWanted){
   const outside=(p:P)=>g[p.y]?.[p.x]==='.'&&!secret.some(q=>q.x===p.x&&q.y===p.y);
   const lines=doors.flatMap(d=>{const inner=secret.find(q=>Math.abs(q.x-d.x)+Math.abs(q.y-d.y)===1)!;const v={x:d.x-inner.x,y:d.y-inner.y};const a={x:d.x+v.x,y:d.y+v.y},l={x:a.x+v.x,y:a.y+v.y},pl={x:l.x+v.x,y:l.y+v.y};
    return outside(a)&&outside(l)&&outside(pl)?[{gate:d,approach:a,line:l,plate:pl}]:[];});
   const near=(a:P,b:P)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<=1;
   // Exit hatch: any side wall of the vault whose straight tunnel (up to 3 rock tiles) reaches open floor.
   const ring:{d:P;v:P}[]=[];for(let xx=x;xx<x+w;xx++)ring.push({d:{x:xx,y:y-1},v:{x:0,y:-1}},{d:{x:xx,y:y+h},v:{x:0,y:1}});for(let yy=y;yy<y+h;yy++)ring.push({d:{x:x-1,y:yy},v:{x:-1,y:0}},{d:{x:x+w,y:yy},v:{x:1,y:0}});
   const tunnels=ring.flatMap(({d,v})=>{const path:P[]=[];for(let k=1;k<=4;k++){const t={x:d.x+k*v.x,y:d.y+k*v.y};if(t.x<1||t.y<1||t.x>W-2||t.y>H-2)return [];if(outside(t))return [{door:d,path,out:t}];path.push(t);}return [];});
   const choice=lines.length?pick(lines):null,exits=choice?tunnels.filter(t=>!near(t.door,choice.gate)&&!near(t.out,choice.plate)&&!near(t.out,choice.line)).sort((a,b)=>a.path.length-b.path.length):[];
   if(choice&&exits.length){const e=exits.filter(t=>t.path.length===exits[0].path.length);const t=pick(e);for(const q of t.path)g[q.y][q.x]='.';lure={...choice,exit:t.door,exitOut:t.out};}
  }
  if(lure){
   const ch=`plate${depth}`,out=`vault${depth}`;g[lure.gate.y][lure.gate.x]='.';g[lure.exit.y][lure.exit.x]='.';
   const dist=(p:P)=>Math.abs(p.x-lure!.gate.x)+Math.abs(p.y-lure!.gate.y);const order=[...secret].sort((a,b)=>dist(a)-dist(b));
   devices.push({id:`gate${depth}`,...lure.gate,channel:ch,kind:'door',open_when:true},{id:`hatch${depth}`,...lure.exit,channel:out,kind:'door',open_when:true},{id:`lever${depth}`,...order[order.length-1],channel:out,kind:'switch',mode:'toggle'});
   features.push({...defaultFeature('plate',fid(),lure.plate.x,lure.plate.y),channel:ch} as Feature);
   ambushKeep.push(order[0],lure.approach,lure.line,lure.plate,lure.exitOut);
  }else if(ambush&&secret.length>=4){
   // Ambush stash: an open gate; the first step inside slams it shut; a lever at the back reopens it.
   g[door.y][door.x]='.';const ch=`ambush${depth}`;devices.push({id:`gate${depth}`,x:door.x,y:door.y,channel:ch,kind:'door',open_when:false});
   const dist=(p:P)=>Math.abs(p.x-door.x)+Math.abs(p.y-door.y);const order=[...secret].sort((a,b)=>dist(a)-dist(b));
   // The trip is one step in from the entry tile, so the way back out can step around it (rooms are at least 2 wide).
   devices.push({id:`trip${depth}`,...order[1],channel:ch,kind:'switch',mode:'set'},{id:`lever${depth}`,...order[order.length-1],channel:ch,kind:'switch',mode:'clear'});ambushKeep.push(order[0]);
   ambushSockets.push({p:order[2],placement:{enemy:depth>=2?'brute':'pursuer',trap:false,reward:'random'}});
  }else if(vault){g[door.y][door.x]='.';features.push({...defaultFeature('lock',fid(),door.x,door.y),color:'brass'} as Feature);}
  else features.push(defaultFeature('crack',fid(),door.x,door.y));
 }
 const tiles=g.map(row=>row.join(''));
 const secretKeys=new Set(secret.map(key));
 const floorTiles:P[]=[];tiles.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='.'&&!secretKeys.has(`${x},${y}`))floorTiles.push({x,y});}));
 const spawn=center(rooms[0]),exit=center(rooms[rooms.length-1]);
 const used=new Set([key(spawn),key(exit)]);
 const take=(filter:(p:P)=>boolean=()=>true):P|undefined=>{const options=floorTiles.filter(p=>!used.has(key(p))&&filter(p));if(!options.length)return;const p=pick(options);used.add(key(p));return p;};
 const far=(p:P)=>Math.abs(p.x-spawn.x)+Math.abs(p.y-spawn.y)>=5;
 // Themed rooms: a keg gallery guarded by a sentry, or an oil-slicked hall with a keg at its edge.
 for(const d of [...devices,...ambushKeep])used.add(key(d));for(const a of ambushSockets)used.add(key(a.p));
 const themeSockets:{p:P;placement:CreatorPlacement}[]=[...ambushSockets];
 if(lure){const a=lure.approach,d=(p:P)=>Math.abs(p.x-a.x)+Math.abs(p.y-a.y);const g=take(p=>d(p)>=2&&d(p)<=4&&key(p)!==key(lure!.line));if(!g)return null;themeSockets.unshift({p:g,placement:{enemy:'pursuer',trap:false,reward:null}});}
 const middle=rooms.slice(1,-1).filter(m=>m.w>=4);
 if(middle.length&&r()<.8){
  const m=pick(middle),inside=(p:P)=>tiles[p.y]?.[p.x]==='.'&&!used.has(key(p))&&!secretKeys.has(key(p));
  if(r()<.5){let n=0;for(let x=m.x;x<m.x+m.w&&n<3;x+=2){const p={x,y:m.y};if(inside(p)){used.add(key(p));features.push(defaultFeature('barrel',fid(),p.x,p.y));n++;}}
   const guard=[...Array(m.w).keys()].map(dx=>({x:m.x+dx,y:m.y+m.h-1})).find(inside);if(guard&&n){used.add(key(guard));themeSockets.push({p:guard,placement:{enemy:'archer',trap:false,reward:null}});}}
  else{for(let y=m.y;y<m.y+m.h;y++)for(let x=m.x;x<m.x+m.w;x++){const p={x,y};if(inside(p)&&r()<.45){used.add(key(p));features.push(defaultFeature('oil',fid(),x,y));}}
   const edge=[...Array(m.h).keys()].map(dy=>({x:m.x+m.w-1,y:m.y+dy})).find(inside);if(edge){used.add(key(edge));features.push(defaultFeature('barrel',fid(),edge.x,edge.y));}}
 }
 // Features: secret stash, kegs and oil to exploit, a spring or altar, sometimes a chasm.
 if(features.some(f=>f.kind==='lock')){const k=take(far);if(k)features.push({...defaultFeature('key',fid(),k.x,k.y),color:'brass'} as Feature);else return null;}
 if(secret.length){const s=pick(secret);used.add(key(s));features.push(r()<.5?defaultFeature('cache',fid(),s.x,s.y):{...defaultFeature('fountain',fid(),s.x,s.y),charges:2} as Feature);}
 const supply:SupplyKind=pick(['bomb','dart','flash']);
 const c=take(p=>!far(p)||r()<.3);if(c)features.push({...defaultFeature('cache',fid(),c.x,c.y),supply,count:supply==='bomb'?2:supply==='dart'?3:1} as Feature);
 for(let i=0;i<int(1,2+depth);i++){const k=take(far);if(!k)break;features.push(defaultFeature('barrel',fid(),k.x,k.y));
  for(const n of [{x:k.x+1,y:k.y},{x:k.x-1,y:k.y},{x:k.x,y:k.y+1},{x:k.x,y:k.y-1}])if(r()<.35&&tiles[n.y]?.[n.x]==='.'&&!used.has(key(n))&&!secretKeys.has(key(n))){used.add(key(n));features.push(defaultFeature('oil',fid(),n.x,n.y));}}
 if(depth>0||r()<.4){const a=take(far);if(a)features.push({...defaultFeature(depth%2?'altar':'fountain',fid(),a.x,a.y),...(depth%2?{boon:pick(['might','ward','sight'] as AltarBoon[]),cost:int(2,4)}:{})} as Feature);}
 if(r()<.5){const p=take(q=>far(q)&&[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>tiles[q.y+dy]?.[q.x+dx]==='.').length>=3);if(p)features.push(defaultFeature('pit',fid(),p.x,p.y));}
 // Encounters scale with depth and danger.
 const pool:EnemyKind[][]=[['pursuer','bomber','archer'],['pursuer','charger','archer','bomber','nest'],['charger','archer','bomber','brute','nest','pursuer']];
 const sockets:P[]=themeSockets.map(t=>t.p),placements:CreatorPlacement[]=themeSockets.map(t=>t.placement);
 const enemies=Math.min(16,placements.length+1+depth+danger)-placements.length;
 for(let i=0;i<enemies;i++){const p=take(far);if(!p)break;sockets.push(p);const kind=pick(pool[Math.min(depth,2)]);placements.push({enemy:kind==='nest'&&placements.some(q=>q.enemy==='nest')?'pursuer':kind,trap:false,reward:i<1+depth?'random':null});}
 for(let i=0;i<int(0,1+depth)&&sockets.length<16;i++){const p=take(far);if(!p)break;sockets.push(p);placements.push({enemy:'none',trap:true,reward:null});}
 if(secret.length&&sockets.length<16){const s=secret.find(p=>!used.has(key(p)));if(s){used.add(key(s));sockets.push(s);placements.push({enemy:'none',trap:false,reward:'random'});}}
 // Kegs must never be the only way through: drop any keg whose tile is needed to reach other floor.
 const blocked=()=>{const kegs=new Set(features.filter(f=>f.kind==='barrel'||f.kind==='pit').map(key));const asWalls=depthReachable(tiles.map((row,y)=>[...row].map((c,x)=>kegs.has(`${x},${y}`)?'#':c).join('')),spawn,features.filter(f=>f.kind==='crack'));return asWalls.missing>0;};
 for(const k of features.filter(f=>f.kind==='barrel')){if(!blocked())break;features.splice(features.indexOf(k),1);}
 const last=depth===count-1;
 const floor:CustomFloor={tiles,spawn,exit,sockets,tuning:[],devices,exit_rule:{...defaultExitRule,require_clear:false},features,...(depth>0?{tide:{turns:Math.max(35,Math.round(tiles.join('').split('.').length*0.8)),damage:Math.min(3,depth)}}:{})};
 if(last)floor.exit_rule={extract:true,require_clear:false};
 if(validateCustomFloor(floor,floorFormat(floor)).length)return null;
 if(lure){
  // With the vault sealed, the rest of the floor must still connect (the vault is never the only way through).
  const sealedTiles=tiles.map((row,y)=>[...row].map((c,x)=>secretKeys.has(`${x},${y}`)||(x===lure!.gate.x&&y===lure!.gate.y)||(x===lure!.exit.x&&y===lure!.exit.y)?'#':c).join(''));
  if(depthReachable(sealedTiles,spawn,features).missing)return null;
  if(!lureSolvable(floor,lure,sockets[0]))return null;
 }
 return {floor,placements};
}
/** Lure vaults on a floor: a gate whose channel is driven only by a plate in line with its approach, and the guard nearest it. */
export function lureRooms(floor:CustomFloor,placements:readonly CreatorPlacement[]):{gate:P;approach:P;guard:P}[]{
 return (floor.features??[]).flatMap(f=>{if(f.kind!=='plate')return [];const gate=(floor.devices??[]).find(d=>d.kind==='door'&&d.channel===f.channel);if(!gate)return [];
  const dx=Math.sign(f.x-gate.x),dy=Math.sign(f.y-gate.y);if(dx&&dy)return [];const approach={x:gate.x+dx,y:gate.y+dy};
  const guards=floor.sockets.filter((_,i)=>placements[i]?.enemy==='pursuer').sort((a,b)=>Math.abs(a.x-approach.x)+Math.abs(a.y-approach.y)-Math.abs(b.x-approach.x)-Math.abs(b.y-approach.y));
  return guards.length?[{gate:{x:gate.x,y:gate.y},approach,guard:guards[0]}]:[];});
}
/** Proof for a generated lure vault: from the approach, with only its guard present, a shove onto the plate gets the player
 * through the gate (exact play rules, bounded search); and from inside, the lever-door leads back to the stairs. */
export function lureSolvable(floor:CustomFloor,lure:{gate:P;approach:P},guard:P):{entry:SolveResult;exit:SolveResult}|null{
 const base={...floor,tuning:[],exit_rule:{extract:true,require_clear:false}};delete (base as {tide?:unknown}).tide;delete base.links;
 const inner={x:2*lure.gate.x-lure.approach.x,y:2*lure.gate.y-lure.approach.y};
 const enter=authoredRehearsal([{...base,sockets:[guard]}],[{id:'guard',room:0,slot:0,enemy:'pursuer',trap:false,reward:null}],'club');enter.player.x=lure.approach.x;enter.player.y=lure.approach.y;
 const entry=solveReach(enter,inner,6000,24);if(!entry.solved)return null;
 const leave=authoredRehearsal([{...base,sockets:[]}],[],'club');leave.player.x=inner.x;leave.player.y=inner.y;
 const exit=solveReach(leave,floor.exit,6000,80);return exit.solved?{entry,exit}:null;
}
/** Generate a seeded multi-floor starting draft: rooms, a hidden stash, hazards and mixed enemies. */
export function generateDraft(seed:number,options:GeneratorOptions={}):GeneratedDraft{
 const count=Math.max(1,Math.min(4,options.floors??3)),W=Math.max(13,Math.min(31,options.width??21)),H=Math.max(9,Math.min(31,options.height??13)),danger=options.danger??2;
 const r=rng(seed);const floors:CustomFloor[]=[],placements:CreatorPlacement[][]=[];
 for(let depth=0;depth<count;depth++){
  let made:ReturnType<typeof generateFloor>=null;
  for(let attempt=0;attempt<40&&!made;attempt++)made=generateFloor(r,depth,count,W,H,danger,!!options.vaults&&depth>=1);
  if(!made)throw Error('Could not generate a valid floor; try another seed.');
  if(options.budget)trimFloor(made.floor,made.placements,options.budget);
  floors.push(made.floor);placements.push(options.treasure===false?made.placements.map(p=>({...p,reward:null})):made.placements);
 }
 // Drawn after the main floors so their layouts do not change: sometimes a one-way drop into a sealed arena.
 if(options.arena&&count>=2&&r()<.45){
  const from=Math.floor(r()*count);
  for(let attempt=0;attempt<20;attempt++){
   const arena=arenaFloor(r,from,count,danger);if(!arena)continue;
   if(options.budget)trimFloor(arena.floor,arena.placements,{...options.budget,enemies:Math.max(3,options.budget.enemies),treasure:Math.max(1,options.budget.treasure)});
   const linked=linkArena(floors,from,arena.floor,r);if(!linked)break;
   floors.splice(0,floors.length,...linked);placements.push(options.treasure===false?arena.placements.map(p=>({...p,reward:null})):arena.placements);break;
  }
 }
 return {floors,placements};
}
type ArenaFloor={floor:CustomFloor;placements:CreatorPlacement[]};
/** A sealed arena: one open hall with pillars, a pack, and an exit that opens only once every enemy is down. */
function arenaFloor(r:()=>number,from:number,count:number,danger:number):ArenaFloor|null{
 const int=(a:number,b:number)=>a+Math.floor(r()*(b-a+1));const pick=<T,>(xs:readonly T[])=>xs[Math.floor(r()*xs.length)];
 const W=int(11,15),H=int(9,11);const g=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>x===0||y===0||x===W-1||y===H-1?'#':'.'));
 const spawn={x:2,y:Math.floor(H/2)},exit={x:W-2,y:Math.floor(H/2)};
 for(const [x,y] of [[4,2],[4,H-3],[W-5,2],[W-5,H-3]])if(r()<.75)g[y][x]='#';
 if(W>=13&&r()<.5)g[Math.floor(H/2)][Math.floor(W/2)]='#';
 const tiles=g.map(row=>row.join(''));const used=new Set([key(spawn),key(exit),key({x:exit.x,y:exit.y-1})]);
 const open:P[]=[];tiles.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='.')open.push({x,y});}));
 const take=(f:(p:P)=>boolean)=>{const xs=open.filter(p=>!used.has(key(p))&&f(p));if(!xs.length)return;const p=pick(xs);used.add(key(p));return p;};
 const depth=Math.min(2,from+1),far=(p:P)=>Math.abs(p.x-spawn.x)+Math.abs(p.y-spawn.y)>=5;
 // A pack that comes to you: no crossbow sentries (they kite, and the hall only opens once everything is down).
 const pool:EnemyKind[][]=[['pursuer','charger'],['pursuer','charger','bomber'],['charger','bomber','brute','pursuer']];
 const sockets:P[]=[],placements:CreatorPlacement[]=[];
 for(let i=0;i<1+danger+Math.min(1,from);i++){const p=take(far);if(!p)return null;sockets.push(p);placements.push({enemy:pick(pool[depth]),trap:false,reward:i<2?'random':null});}
 const features:Feature[]=[];let n=0;
 for(let i=0;i<int(1,2);i++){const p=take(q=>q.y===1||q.y===H-2);if(p)features.push(defaultFeature('barrel',`arena-${n++}`,p.x,p.y));}
 const floor:CustomFloor={tiles,spawn,exit,sockets,tuning:[],devices:[],exit_rule:{extract:true,require_clear:true},features,links:[]};
 return validateCustomFloor(floor,floorFormat(floor)).length?null:{floor,placements};
}
/** Turn a linear draft into connected floors: stairs passages beside each exit, a one-way drop into the arena,
 * and (when floors remain below) a passage onward from the arena that opens once it is cleared. */
function linkArena(floors:CustomFloor[],from:number,arena:CustomFloor,r:()=>number):CustomFloor[]|null{
 const out=floors.map(f=>structuredClone(f));const arenaIndex=out.length;
 const blocked=(f:CustomFloor)=>new Set([f.spawn,f.exit,...f.sockets,...(f.devices??[]),...(f.features??[]),...(f.links??[])].map(key));
 // Tiles the arrival reaches without opening anything (closed gates, cracks, locks, kegs and chasms stay shut).
 const reach=(f:CustomFloor,extra?:P)=>{const stop=new Set([...(extra?[key(extra)]:[]),...(f.devices??[]).filter(d=>d.kind==='door').map(key),...(f.features??[]).filter(x=>['crack','lock','barrel','pit'].includes(x.kind)).map(key)]);
  const seen=new Map([[key(f.spawn),0]]);const q=[f.spawn];for(const p of q)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(f.tiles[n.y]?.[n.x]==='.'&&!stop.has(key(n))&&!seen.has(key(n))){seen.set(key(n),seen.get(key(p))!+1);q.push(n);}}return seen;};
 // A passage tile must never be a chokepoint: walking onto it travels, so everything else must stay reachable around it.
 const aside=(f:CustomFloor,p:P,seen:Map<string,number>)=>reach(f,p).size===seen.size-1;
 const beside=(f:CustomFloor,p:P)=>{const b=blocked(f),seen=reach(f);return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).find(n=>seen.has(key(n))&&!b.has(key(n))&&aside(f,n,seen));};
 for(const [i,f] of out.entries()){f.links=[];if(i<floors.length-1){const p=beside(f,f.exit);if(!p)return null;f.links.push({id:`down${i}`,...p,to:i+1,require_clear:false});}}
 const f=out[from],b=blocked(f),seen=reach(f);
 const spots=[...seen].filter(([k,d])=>d>=6&&!b.has(k)&&Math.abs(Number(k.split(',')[0])-f.exit.x)+Math.abs(Number(k.split(',')[1])-f.exit.y)>2).map(([k])=>{const [x,y]=k.split(',').map(Number);return {x,y};});
 const open=spots.filter(p=>aside(f,p,seen));if(!open.length)return null;const drop=open[Math.floor(r()*open.length)];
 f.links!.push({id:'drop',...drop,to:arenaIndex,require_clear:false});
 const a=structuredClone(arena);a.links=[];
 if(from+1<floors.length){const p=beside(a,a.exit);if(!p)return null;a.links.push({id:'onward',...p,to:from+1,require_clear:true});}
 out.push(a);return out;
}
/** Proof for a generated arena: no passage leads back, and once its enemies are gone the exit is reachable (exact play rules). */
export function arenaSolvable(floors:readonly CustomFloor[],arenaIndex:number):SolveResult|null{
 const a=floors[arenaIndex];if(!a||a.exit_rule?.require_clear!==true||!a.exit_rule.extract)return null;
 if((a.links??[]).some(l=>(floors[l.to].links??[]).some(back=>back.to===arenaIndex)))return null;
 const s=authoredRehearsal([{...a,links:undefined,sockets:[],tuning:[]} as CustomFloor],[],'club');
 const r=solveReach(s,a.exit,6000,80);return r.solved?r:null;
}
import {creatorRehearsal,authoredRehearsal,type RehearsalKit} from './authored-layout';
import {solveReach,type SolveResult} from './solver';
/** Synthetic practice on a generated draft. Nothing is funded and nothing carries home. */
export function depthPractice(seed:number,kit:RehearsalKit='club'){
 const d=generateDraft(seed);const s=creatorRehearsal(d.floors,d.placements,kit,'tonic');
 s.expeditionSeed=seed>>>0;s.log=['Practice descent on a generated layout. Supplies, springs and altars are part of the floor; nothing carries home.','Every floor allows escape. Deeper floors flood after a while: decide when to leave.'];return s;
}
