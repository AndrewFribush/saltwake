import type {Point,RoomLayout} from './state';

export type FundedFloor={layout:RoomLayout;slots:Point[]};
type Chamber={left:number;right:number;top:number;bottom:number;children?:[Chamber,Chamber];axis?:'x'|'y';wall?:number};
// Geometry only: paid inventory and encounters must come from confirmed economic records.
// Hash every digit of the u64 seed, rather than losing precision through Number(seed).
export function fundedLayout(seed:string,modules:readonly string[]):FundedFloor[]{
 if(!/^\d+$/.test(seed)||BigInt(seed)>18446744073709551615n)throw Error('Invalid economic seed');
 if(modules.length<2||modules.length>4||modules.some(id=>!['cellar','gauntlet'].includes(id)))throw Error('Unsupported funded modules');
 let n=2166136261;
 for(const c of BigInt(seed).toString())n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;
 const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 return modules.map((id,index)=>{
  const tiles=Array.from({length:9},()=>Array<string>(13).fill('#'));
  const root:Chamber={left:1,right:11,top:1,bottom:7};
  const leaves=[root];
  const pick=<T>(values:T[])=>values[Math.floor(random()*values.length)];
  const axes=(r:Chamber)=>[...(r.right-r.left>=6?['x' as const]:[]),...(r.bottom-r.top>=4?['y' as const]:[])];
  const count=2+Math.floor(random()*3);
  // Split into 2–4 rectangular chambers separated by solid walls. Minimum
  // interiors are 3 columns by 2 rows; corner spawn/exit tiles are never cut.
  while(leaves.length<count){
   const r=pick(leaves.filter(r=>axes(r).length));
   const axis=pick(axes(r));
   const low=axis==='x'?r.left+3:r.top+2;
   const high=axis==='x'?r.right-3:r.bottom-2;
   const wall=low+Math.floor(random()*(high-low+1));
   const a:Chamber={left:r.left,right:r.right,top:r.top,bottom:r.bottom};
   const b:Chamber={...a};
   if(axis==='x'){a.right=wall-1;b.left=wall+1;}else{a.bottom=wall-1;b.top=wall+1;}
   r.children=[a,b];r.axis=axis;r.wall=wall;
   leaves.splice(leaves.indexOf(r),1,a,b);
  }
  for(const r of leaves)for(let y=r.top;y<=r.bottom;y++)for(let x=r.left;x<=r.right;x++)tiles[y][x]='.';
  // Join each partition exactly once, after its children are connected. Each
  // one-tile corridor is a genuine chokepoint, not a decorative wall opening.
  const corridors=new Set<string>();
  const connect=(r:Chamber)=>{
   if(!r.children)return;
   r.children.forEach(connect);
   const candidates:Point[]=[];
   if(r.axis==='x'){
    for(let y=r.top;y<=r.bottom;y++)if(tiles[y][r.wall!-1]==='.'&&tiles[y][r.wall!+1]==='.'&&!corridors.has(`${r.wall!-1},${y}`)&&!corridors.has(`${r.wall!+1},${y}`))candidates.push({x:r.wall!,y});
   }else{
    for(let x=r.left;x<=r.right;x++)if(tiles[r.wall!-1][x]==='.'&&tiles[r.wall!+1][x]==='.'&&!corridors.has(`${x},${r.wall!-1}`)&&!corridors.has(`${x},${r.wall!+1}`))candidates.push({x,y:r.wall!});
   }
   const door=pick(candidates);tiles[door.y][door.x]='.';corridors.add(`${door.x},${door.y}`);
  };
  connect(root);
  let candidates:Point[]=[];
  for(let y=1;y<8;y++)for(let x=1;x<12;x++)if(tiles[y][x]==='.'&&x+y>7&&!(x===11&&y===7))candidates.push({x,y});
  const slots:Point[]=[];
  for(let i=0;i<4;i++){
   const p=pick(candidates);slots.push(p);
   candidates=candidates.filter(q=>Math.abs(p.x-q.x)+Math.abs(p.y-q.y)>=2);
  }
  return {slots,layout:{id,title:`${id==='cellar'?'The candle cellars':'The drowned gauntlet'} — floor ${index+1}`,tiles:tiles.map(row=>row.join('')),spawn:{x:1,y:1},exit:{x:11,y:7},enemies:[],traps:[]}};
 });
}
