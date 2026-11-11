import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/db';
import {Outbox} from '../src/outbox';
import {Runs} from '../src/runs';
import {terms} from '../../../tests/contract/helpers';
import type {EconomySnapshot,EconomicRun,Command} from '../../../packages/shared/src/types';
import {commandHash} from '../../../packages/shared/src/protocol';
const er:EconomicRun={id:'run-1',edition:'edition-1',player:'buyer',fee:'2',deadline_ms:'999999',seed:'42',loadout_ids:['club'],assignments:[{socket:'sword',item_id:'sword',source_pool:'fixed:sword'},{socket:'tonic-a',item_id:'tonic',source_pool:'fixed:tonic'},{socket:'tonic-b',item_id:'hidden',source_pool:'fixed:tonic'}],status:'active',terminal_reason:null};
function setup(){const dir=mkdtempSync(join(tmpdir(),'runs-'));const db=new Store(join(dir,'db'));const box=new Outbox(db,{} as any);const cmd:Command={actor:'buyer',action:{type:'admit',edition_id:'edition-1',expected_version:'1',expected_fee:'2',loadout_ids:['club'],seed:'42'}};
 const op=box.enqueue('admit',cmd);op.status='Applied';op.receipt={status:'Applied',op_id:'admit',payload_hash:commandHash(cmd),result:'run-1',run:er};db.putOperation(op);
 const snapshot={editions:[{id:'edition-1',terms:terms(1000)}],items:[{id:'club',item_type:'club'},{id:'sword',item_type:'sword'},{id:'tonic',item_type:'tonic'},{id:'hidden',item_type:'tonic'}]} as unknown as EconomySnapshot;
 return {dir,db,box,snapshot,close(){db.close();rmSync(dir,{recursive:true,force:true});}};
}
test('only applied admissions materialize; hidden seed/rewards absent from run view',()=>{const f=setup();try{const runs=new Runs(f.db,f.box,()=>1000);const op=f.db.operation('admit')!;op.status='Pending';f.db.putOperation(op);assert.throws(()=>runs.materialize('admit',f.snapshot),/confirmed/);op.status='Applied';f.db.putOperation(op);runs.materialize('admit',f.snapshot);const view=JSON.stringify(runs.view('run-1','buyer'));assert.ok(!view.includes('hidden'));assert.ok(!view.includes('seed'));assert.throws(()=>runs.view('run-1','p2'),/owner/);}finally{f.close();}});
test('actions commit once, survive restart, reject stale sequence and expire once',()=>{const f=setup();try{let clock=1000;const runs=new Runs(f.db,f.box,()=>clock);runs.materialize('admit',f.snapshot);const a=runs.action('run-1','buyer','move1',0,{type:'move',x:2,y:1});const retry=runs.action('run-1','buyer','move1',0,{type:'move',x:2,y:1});assert.deepEqual(retry,a);assert.throws(()=>runs.action('run-1','buyer','move1',0,{type:'wait'}),/conflict/);assert.throws(()=>runs.action('run-1','buyer','stale',0,{type:'wait'}),/sequence/);
 f.db.close();const db=new Store(join(f.dir,'db'));try{const restarted=new Runs(db,new Outbox(db,{} as any),()=>clock);assert.equal(restarted.view('run-1','buyer').seq,1);clock=1000000;restarted.expire();restarted.expire();assert.equal(db.operations().length,2);assert.equal(db.operation('terminal-run-1')?.command.action.type,'settle');assert.throws(()=>restarted.action('run-1','buyer','late',1,{type:'wait'}),/terminal/);}finally{db.close();}
 }finally{f.close();}});
test('terminal view redacts receipt seed/assignments and expiry retries replay consistently',()=>{const f=setup();try{const runs=new Runs(f.db,f.box,()=>1000000);runs.materialize('admit',f.snapshot);const first=runs.action('run-1','buyer','expired',0,{type:'wait'});assert.deepEqual(runs.action('run-1','buyer','expired',0,{type:'wait'}),first);const op=f.db.operation('terminal-run-1')!;op.status='Rejected';op.receipt={status:'Rejected',op_id:op.id,payload_hash:op.hash,result:'PrematureExpiry',run:er};f.db.putOperation(op);runs.retryExpiry(999998);assert.equal(f.db.operations().length,2);runs.retryExpiry(1000000);runs.retryExpiry(1000000);assert.equal(f.db.operations().length,3);assert.equal(f.db.get<any>('run','run-1').settlement,'expiry-retry-run-1');const view=JSON.stringify(runs.view('run-1','buyer'));assert.ok(!view.includes('seed'));assert.ok(!view.includes('assignments'));}finally{f.close();}});
test('consumed potion and exact retry response survive process restart',()=>{const f=setup();try{const runs=new Runs(f.db,f.box,()=>1000);runs.materialize('admit',f.snapshot);const row=f.db.get<any>('run','run-1');row.state.player.x=1;row.state.player.y=3;row.state.player.hp=7;row.state.enemies=[];f.db.put('run',row.id,row);const first=runs.action('run-1','buyer','drink',0,{type:'use',itemId:'tonic'});assert.equal(first.state.items.tonic.location.kind,'consumed');assert.equal(first.state.player.hp,11);f.db.close();const db=new Store(join(f.dir,'db'));try{const restarted=new Runs(db,new Outbox(db,{} as any),()=>1000);assert.deepEqual(restarted.action('run-1','buyer','drink',0,{type:'use',itemId:'tonic'}),first);assert.equal(restarted.view('run-1','buyer').state.player.hp,11);}finally{db.close();}}finally{f.close();}});

test('v2 materializes exact funded goods; hides geometry, encounters, IDs and survives restart',()=>{
 const f=setup();try{
  f.snapshot.editions[0].terms={...f.snapshot.editions[0].terms,rules_version:2};
  const runs=new Runs(f.db,f.box,()=>1000),row=runs.materialize('admit',f.snapshot);
  assert.equal(row.state.roguelike,true);
  assert.deepEqual(Object.keys(row.state.items).sort(),['club','hidden','sword','tonic']);
  assert.equal(row.state.layout!.length,2);
  assert.ok(row.state.layout!.every(r=>r.tiles.length===9&&r.tiles.every(line=>line.length===13)));
  const first=runs.view(row.id,'buyer');
  assert.deepEqual(first.exit,{x:11,y:7});assert.equal(first.canExtract,false);assert.equal(first.hasNextRoom,true);
  assert.ok(first.state.room.some(line=>line.includes('?')));
  assert.deepEqual(Object.keys(first.state.items),['club']);assert.deepEqual(first.state.reservedItemIds,[]);
  assert.deepEqual(first.state.enemies,[]);assert.deepEqual(first.state.traps,[]);
  assert.equal(first.state.layout,undefined);assert.equal(first.state.expeditionSeed,undefined);
  assert.ok(!JSON.stringify(first).includes('hidden'));
  const persisted=structuredClone(row);
  assert.deepEqual(runs.materialize('admit',{...f.snapshot,items:[]}),persisted);
  f.db.close();const db=new Store(join(f.dir,'db'));try{
   const restarted=new Runs(db,new Outbox(db,{} as any),()=>1000);
   assert.deepEqual(restarted.get(row.id,'buyer'),persisted);assert.deepEqual(restarted.view(row.id,'buyer'),first);
   const moved=restarted.action(row.id,'buyer','step-v2',0,{type:'move',x:2,y:1});
   assert.deepEqual(restarted.action(row.id,'buyer','step-v2',0,{type:'move',x:2,y:1}),moved);
  }finally{db.close();}
 }finally{f.close();}
});

test('v2 visible items and lanes redact correctly; shrine/continuation never invent goods; settlement hides unseen returns',()=>{
 const f=setup();try{
  f.snapshot.editions[0].terms={...f.snapshot.editions[0].terms,rules_version:2};
  const runs=new Runs(f.db,f.box,()=>1000),row=runs.materialize('admit',f.snapshot);
  const sword=row.state.items.sword.location;assert.equal(sword.kind,'floor');if(sword.kind!=='floor')throw Error('Expected floor');
  row.state.player.x=sword.x;row.state.player.y=sword.y;
  // Show exactly one current-floor good; distant/future assigned IDs stay private.
  row.state.items.tonic.location={kind:'floor',room:0,x:1,y:1};
  row.state.enemies=[{id:'visible',x:sword.x,y:sword.y,hp:4,intent:{x:1,y:1},lane:[{x:sword.x,y:sword.y},{x:1,y:1}]}];
  row.state.log=['tonic-b strikes sword for 4.','Entered cellar.'];
  f.db.put('run',row.id,row);
  const visible=runs.view(row.id,'buyer');assert.ok(visible.state.items.sword);assert.ok(!visible.state.items.hidden);assert.ok(!visible.state.items.tonic);
  assert.deepEqual(visible.state.reservedItemIds,['sword']);assert.equal(visible.state.enemies[0].lane!.length,1);assert.deepEqual(visible.state.enemies[0].intent,{x:sword.x,y:sword.y});assert.deepEqual(visible.state.log,['Entered cellar.']);
  row.state.enemies=[];Object.assign(row.state.player,row.state.layout![0].exit);f.db.put('run',row.id,row);
  assert.equal(runs.view(row.id,'buyer').canExtract,true);
  const goods=structuredClone(row.state.items);
  runs.action(row.id,'buyer','boon-v2',0,{type:'boon',choice:'edge'});
  assert.deepEqual(runs.get(row.id,'buyer').state.items,goods);
  const next=runs.action(row.id,'buyer','next-v2',1,{type:'continue'});
  assert.equal(next.state.roomIndex,1);assert.equal(next.hasNextRoom,false);assert.equal(next.canExtract,false);
  assert.ok(!next.state.items.hidden);assert.deepEqual(runs.get(row.id,'buyer').state.items,goods);
  runs.finish(runs.get(row.id,'buyer'),'expired');
  const op=f.db.operation('terminal-run-1')!;op.status='Applied';f.db.putOperation(op);
  assert.ok(!JSON.stringify(runs.view(row.id,'buyer')).includes('hidden'));
  const report=runs.view(row.id,'buyer').settlement;assert.ok((report?.withheldCounts?.dungeon_returned??0)>0);
  assert.equal(runs.view(row.id,'buyer').canExtract,false);
 }finally{f.close();}
});

test('v2 no-reward admission with empty loadout stays empty across shrine and three-floor descent',()=>{
 const f=setup();try{
  f.snapshot.editions[0].terms={...f.snapshot.editions[0].terms,rules_version:2,sockets:[],no_reward:true,modules:['cellar','gauntlet','cellar']};
  const op=f.db.operation('admit')!;
  if(op.receipt?.status!=='Applied'||!op.receipt.run)throw Error('Missing receipt');
  op.receipt.run={...op.receipt.run,loadout_ids:[],assignments:[]};f.db.putOperation(op);
  const runs=new Runs(f.db,f.box,()=>1000),row=runs.materialize('admit',f.snapshot);
  assert.deepEqual(row.state.items,{});assert.deepEqual(row.state.originalTownIds,[]);assert.deepEqual(row.state.reservedItemIds,[]);
  assert.equal(row.state.layout!.length,3);assert.ok(row.state.layout!.every(r=>r.enemies.length===0&&r.traps.length===0));
  Object.assign(row.state.player,row.state.layout![0].exit);f.db.put('run',row.id,row);
  runs.action(row.id,'buyer','empty-boon',0,{type:'boon',choice:'rest'});
  runs.action(row.id,'buyer','empty-next',1,{type:'continue'});
  assert.deepEqual(runs.get(row.id,'buyer').state.items,{});
 }finally{f.close();}
});

test('v3 authored geometry, funded positions, fog and settlement survive restart',async()=>{
 const {encodeCustomModule}=await import('../../../packages/shared/src/custom-layout');
 const floor={tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:2,y:2},exit:{x:10,y:7},sockets:[{x:9,y:6},{x:10,y:6},{x:9,y:7},{x:11,y:7}]};
 const f=setup();try{
  f.snapshot.editions[0].terms={...f.snapshot.editions[0].terms,rules_version:3,modules:[encodeCustomModule(floor),encodeCustomModule({...floor,spawn:{x:3,y:2}})]};
  const runs=new Runs(f.db,f.box,()=>1000),row=runs.materialize('admit',f.snapshot);
  assert.deepEqual(row.state.layout![0].tiles,floor.tiles);assert.deepEqual(row.state.layout![0].spawn,floor.spawn);assert.deepEqual(row.state.layout![0].exit,floor.exit);
  assert.deepEqual({x:row.state.player.x,y:row.state.player.y},floor.spawn);
  assert.deepEqual(Object.keys(row.state.items).sort(),['club','hidden','sword','tonic']);
  assert.deepEqual(row.state.items.sword.location,{kind:'floor',room:0,...floor.sockets[0]});
  assert.deepEqual(row.state.items.tonic.location,{kind:'floor',room:0,...floor.sockets[1]});
  assert.deepEqual(row.state.items.hidden.location,{kind:'floor',room:1,...floor.sockets[0]});
  assert.equal(row.state.layout![1].enemies[0].x,floor.sockets[0].x);assert.equal(row.state.layout![1].traps[0].y,floor.sockets[0].y);
  const view=runs.view(row.id,'buyer');assert.ok(view.state.room.some(r=>r.includes('?')));assert.deepEqual(Object.keys(view.state.items),['club']);assert.deepEqual(view.state.enemies,[]);assert.equal(view.state.layout,undefined);
  f.db.close();const db=new Store(join(f.dir,'db'));try{
   const restarted=new Runs(db,new Outbox(db,{} as any),()=>1000);
   assert.deepEqual(restarted.get(row.id,'buyer'),row);assert.deepEqual(restarted.view(row.id,'buyer'),view);
   assert.deepEqual(restarted.materialize('admit',{...f.snapshot,editions:[]}),row);
   const move=restarted.action(row.id,'buyer','custom-step',0,{type:'move',x:3,y:2});assert.deepEqual(restarted.action(row.id,'buyer','custom-step',0,{type:'move',x:3,y:2}),move);
   restarted.finish(restarted.get(row.id,'buyer'),'abandoned');const op=db.operation('terminal-run-1')!;
   assert.equal(op.command.action.type,'settle');if(op.command.action.type!=='settle')throw Error('Expected settlement');
   assert.deepEqual([...op.command.action.disposition.dungeon_returned].sort(),['hidden','sword','tonic']);
   op.status='Applied';db.putOperation(op);const terminal=restarted.view(row.id,'buyer');assert.equal(terminal.settlement?.withheldCounts?.dungeon_returned,3);assert.ok(!JSON.stringify(terminal).includes('hidden'));
  }finally{db.close();}
 }finally{f.close();}
});

test('run timing persists once and expiry excludes delayed worker/settlement time',()=>{
 const f=setup();try{let now=1000;const runs=new Runs(f.db,f.box,()=>now);const row=runs.materialize('admit',f.snapshot);assert.equal(row.startedAtMs,1000);now=2000;assert.equal(runs.materialize('admit',f.snapshot).startedAtMs,1000);
 now=1005000;runs.expire();const done=runs.get(row.id,'buyer');assert.equal(done.finishedAtMs,Number(er.deadline_ms));now=2000000;runs.expire();assert.equal(runs.get(row.id,'buyer').finishedAtMs,done.finishedAtMs);
 }finally{f.close();}
});

test('run projection shows incoming charge warning inside sight while hiding offscreen source',()=>{const f=setup();try{const runs=new Runs(f.db,f.box,()=>1000),row=runs.materialize('admit',f.snapshot);row.state.roguelike=true;row.state.explored=[];row.state.player.x=1;row.state.player.y=1;row.state.room=['#########','#.......#','#.......#','#.......#','#.......#','#.......#','#########'];row.state.enemies=[{id:'unseen-charger',kind:'charger',hp:6,x:6,y:1,intent:{x:6,y:1},alerted:false}];row.state.layout![0].enemies=structuredClone(row.state.enemies);f.db.put('run',row.id,row);const view=runs.action(row.id,'buyer','wake',0,{type:'wait'});assert.deepEqual(view.state.enemies,[]);assert.ok(view.state.incomingDanger?.some(p=>p.x===1&&p.y===1));assert.ok(view.state.incomingDanger?.every(p=>p.x<=5));assert.ok(!JSON.stringify(view).includes('unseen-charger'));assert.equal(runs.action(row.id,'buyer','hit',1,{type:'wait'}).state.player.hp,8);}finally{f.close();}});

for(const duration of [60000,3600000])test(`v8 ${duration}ms receipt deadline survives restart and expires exactly once`,async()=>{
 const {encodeCustomModule}=await import('../../../packages/shared/src/custom-layout');const f=setup();try{
 const floor={tiles:['#####','#...#','#...#','#...#','#####'],spawn:{x:1,y:1},exit:{x:3,y:3},sockets:[],tuning:[]};
 f.snapshot.editions[0].terms={...f.snapshot.editions[0].terms,rules_version:8,modules:[encodeCustomModule(floor,'tuned'),encodeCustomModule(floor,'tuned')],sockets:[],no_reward:true,run_duration_ms:String(duration),max_runs:1};
 const op=f.db.operation('admit')!;assert.equal(op.receipt?.status,'Applied');if(op.receipt?.status!=='Applied')throw Error('fixture');op.receipt.run={...er,assignments:[],deadline_ms:String(1000+duration)};f.db.putOperation(op);
 let clock=1000;const runs=new Runs(f.db,f.box,()=>clock);runs.materialize('admit',f.snapshot);f.db.close();const db=new Store(join(f.dir,'db'));try{
 const restarted=new Runs(db,new Outbox(db,{} as any),()=>clock);assert.equal(restarted.view('run-1','buyer').deadline,String(1000+duration));clock=999+duration;restarted.expire();assert.equal(restarted.get('run-1','buyer').terminal,undefined);clock++;restarted.expire();restarted.expire();assert.equal(restarted.get('run-1','buyer').terminal,'expired');assert.equal(db.operations().filter(o=>o.command.action.type==='settle').length,1);
 }finally{db.close();}
 }finally{f.close();}
});

test('combat history keeps lines about enemies the player has seen, even after they die or step out of view',()=>{
 const f=setup();try{
  f.snapshot.editions[0].terms={...f.snapshot.editions[0].terms,rules_version:2};
  const runs=new Runs(f.db,f.box,()=>1000);let row=runs.materialize('admit',f.snapshot);
  row.state.enemies=[{id:'brute-1',x:row.state.player.x,y:row.state.player.y,hp:4,intent:{x:row.state.player.x,y:row.state.player.y}}];
  row.state.log=['Entered cellar.'];f.db.put('run',row.id,row);
  runs.view(row.id,'buyer');
  row=runs.get(row.id,'buyer');assert.deepEqual(row.seenEnemies,['brute-1']);
  const dormant=row.state.layout!.flatMap(r=>r.enemies).find(e=>e.id!=='brute-1')!;assert.ok(dormant,'fixture has a layout enemy');
  row.state.enemies=[];row.state.log=['You hit brute-1 for 4.',`${dormant.id} strikes the wall for 4.`];f.db.put('run',row.id,row);
  assert.deepEqual(runs.view(row.id,'buyer').state.log,['You hit brute-1 for 4.'],'seen enemy stays nameable; a never-seen one stays hidden');
 }finally{f.close();}
});
