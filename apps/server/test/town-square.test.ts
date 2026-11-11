import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Store} from '../src/db';import {townSquare} from '../src/town-square';import type {EconomySnapshot} from '../../../packages/shared/src/types';
test('town square highlights come from confirmed records only',t=>{
 const dir=mkdtempSync(join(tmpdir(),'square-'));const db=new Store(join(dir,'db'));t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
 const now=10_000_000;
 const world={editions:[{id:'edition-0',maker:'maker',closed:false,fee:'2',terms:{title:'Old'}},{id:'edition-3',maker:'p3',closed:false,fee:'1',terms:{title:'New hall'}}],
  runs:[{id:'run-0',edition:'edition-0',player:'buyer',status:'extracted'},{id:'run-1',edition:'edition-0',player:'p5',status:'extracted'}],
  items:[{id:'s',item_type:'sword',location:{kind:'owned',profile:'buyer'}},{id:'t',item_type:'tonic',location:{kind:'owned',profile:'p5'}}],
  commissions:[{id:'commission-0',buyer:'maker',item_type:'tonic',unit_price:'6',quantity:2,filled:2,status:'filled'}],shops:[{id:'shop-1',owner:'p3',title:'Hall door',district:'e',interior:JSON.stringify({kind:'dungeon',edition:'edition-3'})},{id:'shop-2',owner:'p4',title:'Barrow',district:'s',interior:'{}'}]} as unknown as EconomySnapshot;
 const settle=(id:string,run:string,ids:string[],status='Applied')=>{db.putOperation({id,hash:'h',status:status as any,command:{actor:'x',action:{type:'settle',run_id:run,outcome:'extracted',disposition:{town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_returned:[],dungeon_extracted:ids},carried_dungeon_ids:ids}}} as any);};
 db.put('run','run-0',{id:'run-0',finishedAtMs:now-1000,settlement:'op-0'});settle('op-0','run-0',['s']);
 db.put('run','run-1',{id:'run-1',finishedAtMs:now-1000,settlement:'op-1'});settle('op-1','run-1',['t'],'Unknown');
 const h=townSquare(world,db,now);
 assert.deepEqual(h.map(x=>x.kind),['dungeon','haul','commission','building']);
 assert.match(h[0].text,/New hall/);assert.equal(h[1].who,'buyer');assert.match(h[1].text,/worth 12/);assert.equal(h[3].who,'p4');
 assert.equal(h[0].district,'e','newest dungeon is placed at its entrance');assert.equal(h[1].district,undefined,'no entrance built for edition-0');assert.equal(h[3].district,'s');
 assert.equal(townSquare(world,db,now+2*86_400_000).some(x=>x.kind==='haul'),false,'only today');
});
