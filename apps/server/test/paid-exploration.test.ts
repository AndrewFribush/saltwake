import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {KeyPairSigner,type KeyPairString} from 'near-api-js';import {extendedFixture} from '../../../tests/contract/extended-fixture';import {starterTownCommands} from '../../../packages/shared/src/starter-town';import type {Action} from '../../../packages/game/src/actions';import type {Point,RunState} from '../../../packages/game/src/state';import {Store} from '../src/db';import {Outbox} from '../src/outbox';import {NearChain} from '../src/chain';import {Runs} from '../src/runs';
function nextStep(s:RunState,target:Point){const queue:Point[]=[s.player];const paths=new Map<string,Point[]>([[`${s.player.x},${s.player.y}`,[]]]);for(const p of queue){const path=paths.get(`${p.x},${p.y}`)!;if(p.x===target.x&&p.y===target.y)return path[0];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+dx,y:p.y+dy},key=`${q.x},${q.y}`;if(s.room[q.y]?.[q.x]==='.'&&!paths.has(key)){paths.set(key,[...path,q]);queue.push(q);}}}return undefined;}
test('a bought tonic and funded rewards survive a played, fog-limited two-floor expedition',{timeout:90000},async()=>{
 const f=await extendedFixture();const dir=mkdtempSync(join(tmpdir(),'paid-explore-'));const db=new Store(join(dir,'db'));const box=new Outbox(db,new NearChain(f.provider,KeyPairSigner.fromSecretKey(f.genesis.privateKey as KeyPairString),f.contractId,f.contractId));const runs=new Runs(db,box);
 try{
 for(const {id,command} of starterTownCommands(Number(await f.view('clock_ms'))))await f.apply(id,command);
 box.enqueue('buy',{actor:'buyer',action:{type:'buy',listing_id:'listing-0',item_ids:['maker-tonic-4'],expected_unit_price:'3'}});await box.recover();assert.equal(db.operation('buy')?.status,'Applied');
 box.enqueue('admit',{actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'2',loadout_ids:['buyer-club','maker-tonic-4'],seed:'42'}});await box.recover();const row=runs.materialize('admit',await f.view());let view=runs.view(row.id,'buyer');const visited=new Map<string,number>();
 for(let n=0;n<350&&!view.terminal;n++){
  const s=view.state,p=s.player;const near=(q:Point)=>Math.abs(q.x-p.x)+Math.abs(q.y-p.y);const goods=Object.values(s.items);const here=goods.filter(i=>i.location.kind==='floor'&&i.location.x===p.x&&i.location.y===p.y);const potion=goods.find(i=>['tonic','fineTonic'].includes(i.type)&&(i.location.kind==='bag'||here.includes(i)));
  let action:Action|undefined;
  if(p.hp<=8&&potion)action={type:'use',itemId:potion.id};
  else if(s.enemies.some(e=>near(e)===1))action={type:'attack',enemyId:s.enemies.find(e=>near(e)===1)!.id};
  else if(here.some(i=>i.type==='sword')&&p.weapon!=='sword')action={type:'equip',itemId:here.find(i=>i.type==='sword')!.id};
  else if(here.length)action={type:'pickup',itemId:here[0].id};
  else if(view.canExtract)action={type:view.hasNextRoom?'continue':'extract'};
  else{
   const targets:Point[]=[...s.enemies,...goods.flatMap(i=>i.location.kind==='floor'?[i.location]:[])];
   if(!targets.length){for(let y=1;y<s.room.length-1;y++)for(let x=1;x<s.room[y].length-1;x++)if(s.room[y][x]==='.'&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>s.room[y+dy]?.[x+dx]==='?'))targets.push({x,y});}
   targets.sort((a,b)=>(visited.get(`${s.roomIndex}:${a.x},${a.y}`)??0)-(visited.get(`${s.roomIndex}:${b.x},${b.y}`)??0)||near(a)-near(b));
   const step=[...targets,view.exit].map(t=>nextStep(s,t)).find(Boolean);assert.ok(step,'exploration has a reachable next step');action={type:'move',...step};
  }
  visited.set(`${s.roomIndex}:${p.x},${p.y}`,(visited.get(`${s.roomIndex}:${p.x},${p.y}`)??0)+1);
  assert.ok(action);view=runs.action(row.id,'buyer','turn-'+view.seq,view.seq,action);
 }
 assert.equal(view.terminal,'extracted',`ended ${view.terminal}, hp ${view.state.player.hp}, turn ${view.seq}`);assert.equal(view.state.roomIndex,1);await box.recover();const world=await f.view();assert.equal(world.runs[0].status,'extracted');assert.equal(world.credits.buyer,'5');assert.equal(world.credits.maker,'94');assert.equal(world.items.find((i:any)=>i.id==='maker-sword-0').location.kind,'owned');assert.equal(world.items.find((i:any)=>i.id==='maker-tonic-4').location.kind,'consumed');console.log('Fog-limited paid expedition extracted after',view.seq,'turns; bought tonic consumed; funded sword owned.');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});await f.close();}
});
