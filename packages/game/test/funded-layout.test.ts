import test from 'node:test';
import assert from 'node:assert/strict';
import {fundedLayout} from '../src/funded-layout';

test('funded geometry is deterministic, uses full economic seed and contains no generated rewards',()=>{
 const seed='18446744073709551615';
 const a=fundedLayout(seed,['cellar','gauntlet']);
 assert.deepEqual(a,fundedLayout(seed,['cellar','gauntlet']));
 assert.notDeepEqual(a,fundedLayout('18446744073709551614',['cellar','gauntlet']));
 for(const {layout,slots} of a){assert.equal(layout.enemies.length,0);assert.equal(layout.traps.length,0);assert.equal(slots.length,4);assert.deepEqual(Object.keys(layout).sort(),['enemies','exit','id','spawn','tiles','title','traps']);}
 assert.throws(()=>fundedLayout('18446744073709551616',['cellar','gauntlet']));
});
test('all floor tiles, four unique sockets and exits are reachable across 100 seeds and 2–4 floors',()=>{
 for(let seed=0;seed<100;seed++)for(const {layout:r,slots} of fundedLayout(String(seed),Array.from({length:2+seed%3},()=> 'cellar'))){
  assert.equal(r.tiles.length,9);assert.ok(r.tiles.every(row=>row.length===13));
  const queue=[r.spawn],seen=new Set([`${r.spawn.x},${r.spawn.y}`]);
  for(const p of queue)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+dx,y:p.y+dy},key=`${q.x},${q.y}`;if(r.tiles[q.y]?.[q.x]==='.'&&!seen.has(key)){seen.add(key);queue.push(q);}}
  assert.equal(seen.size,r.tiles.join('').split('').filter(c=>c==='.').length);
  assert.equal(new Set(slots.map(p=>`${p.x},${p.y}`)).size,4);
  for(const p of [...slots,r.exit]){assert.ok(seen.has(`${p.x},${p.y}`));assert.notDeepEqual(p,r.spawn);}
  for(const p of slots)assert.notDeepEqual(p,r.exit);
 }
});

test('seeded floors have 2–4 substantial chambers joined by narrow chokepoints, with varied geometry',()=>{
 const geometries=new Set<string>(),roomCounts=new Set<number>();
 for(let seed=0;seed<500;seed++)for(const {layout:r,slots} of fundedLayout(String(seed),['cellar','gauntlet'])){
  geometries.add(r.tiles.join('\n'));
  assert.deepEqual(r.spawn,{x:1,y:1});assert.deepEqual(r.exit,{x:11,y:7});
  assert.ok(r.tiles[0].split('').every(t=>t==='#')&&r.tiles[8].split('').every(t=>t==='#'));
  assert.ok(r.tiles.every(row=>row[0]==='#'&&row[12]==='#'));
  const doors=new Set<string>();
  for(let y=1;y<8;y++)for(let x=1;x<12;x++)if(r.tiles[y][x]==='.'){
   const horizontal=r.tiles[y][x-1]==='.'&&r.tiles[y][x+1]==='.'&&r.tiles[y-1][x]==='#'&&r.tiles[y+1][x]==='#';
   const vertical=r.tiles[y-1][x]==='.'&&r.tiles[y+1][x]==='.'&&r.tiles[y][x-1]==='#'&&r.tiles[y][x+1]==='#';
   if(horizontal||vertical)doors.add(`${x},${y}`);
  }
  assert.ok(doors.size>=1&&doors.size<=3,'one to three narrow corridors');
  const seen=new Set<string>(doors),chambers:{x:number;y:number}[][]=[];
  for(let y=1;y<8;y++)for(let x=1;x<12;x++)if(r.tiles[y][x]==='.'&&!seen.has(`${x},${y}`)){
   const chamber=[{x,y}];seen.add(`${x},${y}`);
   for(const p of chamber)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const q={x:p.x+dx,y:p.y+dy},k=`${q.x},${q.y}`;
    if(r.tiles[q.y]?.[q.x]==='.'&&!seen.has(k)){seen.add(k);chamber.push(q);}
   }
   chambers.push(chamber);
  }
  assert.equal(chambers.length,doors.size+1,'corridors must separate actual chambers');
  roomCounts.add(chambers.length);
  for(const chamber of chambers){
   const width=Math.max(...chamber.map(p=>p.x))-Math.min(...chamber.map(p=>p.x))+1;
   const height=Math.max(...chamber.map(p=>p.y))-Math.min(...chamber.map(p=>p.y))+1;
   assert.ok(width>=3&&height>=2);assert.equal(chamber.length,width*height,'solid rectangular chamber');
  }
  for(const p of slots){
   assert.ok(Math.abs(p.x-1)+Math.abs(p.y-1)>=6,'socket away from spawn');
   for(const q of slots)if(q!==p)assert.ok(Math.abs(p.x-q.x)+Math.abs(p.y-q.y)>=2,'sockets not adjacent');
  }
 }
 assert.deepEqual([...roomCounts].sort(),[2,3,4]);
 assert.ok(geometries.size>=100,`expected geometry variety, got ${geometries.size}`);
});
