import {createRun,walkable,seeThrough,type RunState,type RoomLayout,type Point} from './state';
import {enterRoom} from './generation';import {addItem} from './inventory';
function random(seed:number){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
const key=(p:Point)=>`${p.x},${p.y}`;
export function visibleTiles(s:RunState):Set<string>{
 if(!s.roguelike)return new Set(s.room.flatMap((row,y)=>[...row].map((_,x)=>`${x},${y}`)));
 const seen=new Set<string>([key(s.player)]);const queue:(Point & {d:number})[]=[{x:s.player.x,y:s.player.y,d:0}];
 for(const p of queue){if(p.d>=(s.depth?6:4))continue;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy,d:p.d+1};if(!s.room[n.y]?.[n.x]||seen.has(key(n)))continue;seen.add(key(n));if(seeThrough(s,n))queue.push(n);}}
 return seen;
}
export function explore(s:RunState){if(s.roguelike)s.explored=[...new Set([...(s.explored??[]),...[...visibleTiles(s)].map(k=>s.roomIndex+':'+k)])];}
function connected(tiles:string[][]){const queue=[{x:1,y:1}];const seen=new Set(['1,1']);for(const p of queue)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(tiles[n.y]?.[n.x]==='.'&&!seen.has(key(n))){seen.add(key(n));queue.push(n);}}return seen.size===tiles.flat().filter(c=>c==='.').length;}
export function roguelikeRun(seed:number,armored=false):RunState{
 const rng=random(seed);const pick=<T>(xs:T[])=>xs[Math.floor(rng()*xs.length)];const s=createRun();s.roguelike=true;s.expeditionSeed=seed>>>0;s.explored=[];
 s.layout=[0,1].map(index=>{
  const tiles=Array.from({length:9},(_,y)=>Array.from({length:13},(_,x)=>x===0||x===12||y===0||y===8?'#':'.'));
  for(let i=0;i<23;i++){const x=2+Math.floor(rng()*9),y=2+Math.floor(rng()*5);if(tiles[y][x]==='#')continue;tiles[y][x]='#';if(!connected(tiles))tiles[y][x]='.';}
  const candidates:Point[]=[];for(let y=1;y<8;y++)for(let x=1;x<12;x++)if(tiles[y][x]==='.'&&x+y>7&&!(x===11&&y===7))candidates.push({x,y});
  const take=()=>candidates.splice(Math.floor(rng()*candidates.length),1)[0];
  const enemies=[0,1].map(n=>{const p=take();return {...p,id:index?`vault-${n}`:`scavenger-${n}`,kind:index&&n===0?'charger' as const:'pursuer' as const,hp:index&&n===0?6:4,intent:{...p},alerted:false};});
  const traps=index?[{...take(),id:'vault-spikes',armed:true},{...take(),id:'vault-spikes-2',armed:false}]:[];
  const r:RoomLayout={id:'seeded-'+index,title:index?pick(['The drowned vault','The broken treasury','The bone gallery']):pick(['The candle cellars','The smuggler tunnels','The forgotten kitchens']),tiles:tiles.map(row=>row.join('')),spawn:{x:1,y:1},exit:{x:11,y:7},enemies,traps};
  const rewards=index?['fineTonic','iron','sword'] as const:[pick(['sword','armor'] as const),'tonic'] as const;
  for(let n=0;n<rewards.length;n++)addItem(s,{id:`find-${index}-${n}`,type:rewards[n],origin:'dungeon',location:{kind:'floor',room:index,...take()}});
  return r;
 });
 if(armored){s.player.armor=true;addItem(s,{id:'town-armor',type:'armor',origin:'town',location:{kind:'armor'}});}else addItem(s,{id:'town-tonic',type:'tonic',origin:'town',location:{kind:'bag'}});
 enterRoom(s,0);s.log=['A new descent. Explore cautiously; unseen creatures wake when you approach.','Find the stairs. You may leave after clearing this floor, or risk your finds below.'];explore(s);return s;
}
