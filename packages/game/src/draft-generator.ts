// Seeded starting drafts for creators (and synthetic practice). The output is an ordinary,
// fully editable draft built only from catalog components; it is never a fixed campaign.
import {validateCustomFloor,type CustomFloor} from '../../shared/src/custom-layout';
import {defaultFeature,type Feature,type EnemyKind,type SupplyKind,type AltarBoon} from '../../shared/src/depth-components';
import {defaultExitRule} from '../../shared/src/exit-rules';
import type {CreatorPlacement} from '../../shared/src/creator-rewards';
type P={x:number;y:number};type Room={x:number;y:number;w:number;h:number};
function rng(seed:number){let n=(seed>>>0)||1;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export type GeneratedDraft={floors:CustomFloor[];placements:CreatorPlacement[][]};
export type GeneratorOptions={floors?:number;width?:number;height?:number;danger?:1|2|3;treasure?:boolean};
const key=(p:P)=>`${p.x},${p.y}`;
function generateFloor(r:()=>number,depth:number,count:number,W:number,H:number,danger:number):{floor:CustomFloor;placements:CreatorPlacement[]}|null{
 const int=(a:number,b:number)=>a+Math.floor(r()*(b-a+1));const pick=<T,>(xs:readonly T[])=>xs[Math.floor(r()*xs.length)];
 const g=Array.from({length:H},()=>Array<string>(W).fill('#'));
 const rooms:Room[]=[];
 for(let tries=0;tries<80&&rooms.length<5;tries++){
  const w=int(3,6),h=int(3,4),x=int(1,W-w-1),y=int(1,H-h-1);
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
 for(let i=1;i<rooms.length;i++)carve(center(rooms[i-1]),center(rooms[i]));
 if(rooms.length>3&&r()<.6)carve(center(rooms[0]),center(rooms[rooms.length-1]));
 // Hidden side room behind a cracked wall: solid rock all around except the crack.
 const features:Feature[]=[];let id=0;const fid=()=>`f${depth}-${id++}`;
 let secret:P[]=[];
 for(let tries=0;tries<60&&!secret.length;tries++){
  const w=int(2,3),h=int(2,3),x=int(2,W-w-2),y=int(2,H-h-2);
  let clear=true;for(let yy=y-1;yy<=y+h;yy++)for(let xx=x-1;xx<=x+w;xx++)if(g[yy]?.[xx]!=='#')clear=false;
  if(!clear)continue;
  const doors:P[]=[];
  for(let xx=x;xx<x+w;xx++){if(g[y-2]?.[xx]==='.')doors.push({x:xx,y:y-1});if(g[y+h+1]?.[xx]==='.')doors.push({x:xx,y:y+h});}
  for(let yy=y;yy<y+h;yy++){if(g[yy][x-2]==='.')doors.push({x:x-1,y:yy});if(g[yy][x+w+1]==='.')doors.push({x:x+w,y:yy});}
  if(!doors.length)continue;
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){g[yy][xx]='.';secret.push({x:xx,y:yy});}
  const door=pick(doors);features.push(defaultFeature('crack',fid(),door.x,door.y));
 }
 const tiles=g.map(row=>row.join(''));
 const secretKeys=new Set(secret.map(key));
 const floorTiles:P[]=[];tiles.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='.'&&!secretKeys.has(`${x},${y}`))floorTiles.push({x,y});}));
 const spawn=center(rooms[0]),exit=center(rooms[rooms.length-1]);
 const used=new Set([key(spawn),key(exit)]);
 const take=(filter:(p:P)=>boolean=()=>true):P|undefined=>{const options=floorTiles.filter(p=>!used.has(key(p))&&filter(p));if(!options.length)return;const p=pick(options);used.add(key(p));return p;};
 const far=(p:P)=>Math.abs(p.x-spawn.x)+Math.abs(p.y-spawn.y)>=5;
 // Features: secret stash, kegs and oil to exploit, a spring or altar, sometimes a chasm.
 if(secret.length){const s=pick(secret);used.add(key(s));features.push(r()<.5?defaultFeature('cache',fid(),s.x,s.y):{...defaultFeature('fountain',fid(),s.x,s.y),charges:2} as Feature);}
 const supply:SupplyKind=pick(['bomb','dart','flash']);
 const c=take(p=>!far(p)||r()<.3);if(c)features.push({...defaultFeature('cache',fid(),c.x,c.y),supply,count:supply==='bomb'?2:supply==='dart'?3:1} as Feature);
 for(let i=0;i<int(1,2+depth);i++){const k=take(far);if(!k)break;features.push(defaultFeature('barrel',fid(),k.x,k.y));
  for(const n of [{x:k.x+1,y:k.y},{x:k.x-1,y:k.y},{x:k.x,y:k.y+1},{x:k.x,y:k.y-1}])if(r()<.35&&tiles[n.y]?.[n.x]==='.'&&!used.has(key(n))&&!secretKeys.has(key(n))){used.add(key(n));features.push(defaultFeature('oil',fid(),n.x,n.y));}}
 if(depth>0||r()<.4){const a=take(far);if(a)features.push({...defaultFeature(depth%2?'altar':'fountain',fid(),a.x,a.y),...(depth%2?{boon:pick(['might','ward','sight'] as AltarBoon[]),cost:int(2,4)}:{})} as Feature);}
 if(r()<.5){const p=take(q=>far(q)&&[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>tiles[q.y+dy]?.[q.x+dx]==='.').length>=3);if(p)features.push(defaultFeature('pit',fid(),p.x,p.y));}
 // Encounters scale with depth and danger.
 const pool:EnemyKind[][]=[['pursuer','bomber','archer'],['pursuer','charger','archer','bomber','nest'],['charger','archer','bomber','brute','nest','pursuer']];
 const sockets:P[]=[],placements:CreatorPlacement[]=[];
 const enemies=Math.min(16,1+depth+danger);
 for(let i=0;i<enemies;i++){const p=take(far);if(!p)break;sockets.push(p);const kind=pick(pool[Math.min(depth,2)]);placements.push({enemy:kind==='nest'&&placements.some(q=>q.enemy==='nest')?'pursuer':kind,trap:false,reward:i<1+Math.floor(depth/2)?'random':null});}
 for(let i=0;i<int(0,1+depth)&&sockets.length<16;i++){const p=take(far);if(!p)break;sockets.push(p);placements.push({enemy:'none',trap:true,reward:null});}
 if(secret.length&&sockets.length<16){const s=secret.find(p=>!used.has(key(p)));if(s){used.add(key(s));sockets.push(s);placements.push({enemy:'none',trap:false,reward:'random'});}}
 const last=depth===count-1;
 const floor:CustomFloor={tiles,spawn,exit,sockets,tuning:[],devices:[],exit_rule:{...defaultExitRule,require_clear:false},features,...(depth>0?{tide:{turns:Math.max(25,60-depth*10),damage:Math.min(3,depth)}}:{})};
 if(last)floor.exit_rule={extract:true,require_clear:false};
 return validateCustomFloor(floor,'depth').length?null:{floor,placements};
}
/** Generate a seeded multi-floor starting draft: rooms, a hidden stash, hazards and mixed enemies. */
export function generateDraft(seed:number,options:GeneratorOptions={}):GeneratedDraft{
 const count=Math.max(1,Math.min(4,options.floors??3)),W=Math.max(13,Math.min(31,options.width??21)),H=Math.max(9,Math.min(31,options.height??13)),danger=options.danger??2;
 const r=rng(seed);const floors:CustomFloor[]=[],placements:CreatorPlacement[][]=[];
 for(let depth=0;depth<count;depth++){
  let made:ReturnType<typeof generateFloor>=null;
  for(let attempt=0;attempt<40&&!made;attempt++)made=generateFloor(r,depth,count,W,H,danger);
  if(!made)throw Error('Could not generate a valid floor; try another seed.');
  floors.push(made.floor);placements.push(options.treasure===false?made.placements.map(p=>({...p,reward:null})):made.placements);
 }
 return {floors,placements};
}
import {creatorRehearsal,type RehearsalKit} from './authored-layout';
/** Synthetic practice on a generated draft. Nothing is funded and nothing carries home. */
export function depthPractice(seed:number,kit:RehearsalKit='club'){
 const d=generateDraft(seed);const s=creatorRehearsal(d.floors,d.placements,kit,'tonic');
 s.expeditionSeed=seed>>>0;s.log=['Practice descent on a generated layout. Supplies, springs and altars are part of the floor; nothing carries home.','Every floor allows escape. Deeper floors flood after a while: decide when to leave.'];return s;
}
