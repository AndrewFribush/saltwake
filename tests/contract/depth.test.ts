import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';

// Hidden 1x2 pocket at x=9..10,y=2 sealed by a wall row; reachable only through the crack at 9,3.
const tiles=['#############','#........##.#','#........#..#','#........##.#',...Array(4).fill('#...........#'),'#############'];
const sealed=['#############','#............#'.slice(0,13),'#.......#####','#.......#...#','#.......#####',...Array(3).fill('#...........#'),'#############'];
const floor=(patch:Record<string,unknown>={})=>({tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[{x:5,y:5}],tuning:[],devices:[],exit_rule:{extract:true,require_clear:false},features:[] as unknown[],...patch});
const mod=(f:unknown,prefix='custom12:')=>prefix+JSON.stringify(f);
const base=(now:number)=>({...terms(now),rules_version:12,modules:[mod(floor())],sockets:[{id:'s0',room:0,slot:0,enemy:'brute',trap:false,reward:null}] as unknown[],no_reward:true,run_duration_ms:'60000',max_runs:1});
const publish=(t:object)=>({actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:[]}});
const call=(f:Awaited<ReturnType<typeof fixture>>,op_id:string,command:object)=>f.account.callFunction<any>({contractId:f.contractId,methodName:'execute',args:{op_id,command},gas:300_000_000_000_000n,waitUntil:'INCLUDED_FINAL'});

test('WASM v12 validates depth features, charges component costs and keeps new enemies out of older rules',{timeout:180000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms')));
  const keg={id:'k',x:3,y:3,kind:'barrel',damage:5},cache={id:'c',x:2,y:5,kind:'cache',supply:'bomb',count:2};
  const bad:[string,object][]=[
   ['v11 brute',{...t,rules_version:11,modules:[mod(floor({features:undefined}),'custom11:')]}],
   ['unknown kind',{...t,modules:[mod(floor({features:[{id:'x',x:3,y:3,kind:'dragon'}]}))]}],
   ['extra field',{...t,modules:[mod(floor({features:[{...keg,extra:1}]}))]}],
   ['range',{...t,modules:[mod(floor({features:[{...keg,damage:13}]}))]}],
   ['on wall',{...t,modules:[mod(floor({features:[{...keg,x:0,y:3}]}))]}],
   ['overlap socket',{...t,modules:[mod(floor({features:[{...keg,x:5,y:5}]}))]}],
   ['crack on floor',{...t,modules:[mod(floor({features:[{id:'w',x:4,y:4,kind:'crack',hp:3}]}))]}],
   ['sealed pocket',{...t,modules:[mod(floor({tiles:sealed}))]}],
   ['tide range',{...t,modules:[mod(floor({tide:{turns:2,damage:1}}))]}],
   ['missing features',{...t,modules:[mod(floor({features:undefined}))]}],
  ];
  for(const [name,terms] of bad){const r=await call(f,'bad-'+name.replace(/\W/g,''),publish(terms));assert.notEqual(r.status,'Applied',name);}
  const before=BigInt((await f.view('snapshot')).credits.maker);
  const good={...t,modules:[mod(floor({tiles,features:[keg,cache,{id:'w',x:9,y:3,kind:'crack',hp:2},{id:'p',x:6,y:6,kind:'pit'}],tide:{turns:30,damage:2}}))]};
  const r=await call(f,'good',publish(good));assert.equal(r.status,'Applied',JSON.stringify(r));
  // base 2 + brute 4 + keg 1 + cache 2 + crack 1 + pit 1
  assert.equal(before-BigInt((await f.view('snapshot')).credits.maker),11n);
  const v11=await call(f,'v11-ok',publish({...t,rules_version:11,sockets:[{id:'s0',room:0,slot:0,enemy:'pursuer',trap:false,reward:null}],modules:[mod(floor({features:undefined}),'custom11:')]}));
  assert.equal(v11.status,'Applied');
 }finally{await f.sandbox.tearDown();}
});

test('WASM v13 accepts keys, locks and plates (with costs) and keeps them out of v12',{timeout:180000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms')));
  const prog=[{id:'k',x:3,y:3,kind:'key',color:'brass'},{id:'l',x:4,y:4,kind:'lock',color:'brass'},{id:'p',x:2,y:6,kind:'plate',channel:'gate'}];
  const gate={id:'g',x:8,y:6,kind:'door',channel:'gate',open_when:true};
  const v13=(features:unknown[],devices:unknown[]=[gate])=>({...t,rules_version:13,modules:[mod(floor({features,devices}),'custom13:')]});
  assert.notEqual((await call(f,'v12-key',publish({...t,modules:[mod(floor({features:prog,devices:[gate]}))]}))).status,'Applied');
  assert.notEqual((await call(f,'v13-lock-only',publish(v13([prog[1]],[])))).status,'Applied');
  assert.notEqual((await call(f,'v13-bad-colour',publish(v13([{...prog[0],color:'9x'},prog[1],prog[2]])))).status,'Applied');
  assert.notEqual((await call(f,'v13-unwired-door',publish(v13([prog[0],prog[1]])))).status,'Applied');
  const before=BigInt((await f.view('snapshot')).credits.maker);
  const r=await call(f,'v13-ok',publish(v13(prog)));assert.equal(r.status,'Applied',JSON.stringify(r));
  assert.equal(before-BigInt((await f.view('snapshot')).credits.maker),9n); // base 2 + brute 4 + key, lock, plate
 }finally{await f.sandbox.tearDown();}
});

test('WASM v13 accepts generated drafts with a lure vault and a one-way drop into a sealed arena',{timeout:180000},async()=>{
 const {generateDraft,generatorPresets,lureRooms}=await import('../../packages/game/src/draft-generator');
 const {encodeCustomModule}=await import('../../packages/shared/src/custom-layout');
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms')));
  for(const [preset,seed] of [['medium',13],['medium',29]] as const){
   const d=generateDraft(seed,generatorPresets[preset].options);
   assert.ok(d.floors.some(x=>x.links?.some(l=>l.id==='drop'))&&d.floors.some((x,i)=>lureRooms(x,d.placements[i]).length),`${preset} ${seed} has both themes`);
   const sockets=d.placements.flatMap((ps,room)=>ps.map((p,slot)=>({id:`s${room}-${slot}`,room,slot,enemy:p.enemy,trap:p.trap,reward:null})));
   const r=await call(f,`gen-${preset}-${seed}`,publish({...t,rules_version:13,modules:d.floors.map(x=>encodeCustomModule(x,'keys')),sockets}));
   assert.equal(r.status,'Applied',JSON.stringify(r));
  }
 }finally{await f.sandbox.tearDown();}
});

test('WASM v14 accepts clocks (cost 1, wired as switches) and keeps them out of v13; v13 editions unchanged',{timeout:180000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms')));
  const clock={id:'c',x:2,y:6,kind:'clock',channel:'tick',period:5,on:2,offset:1};
  const gate={id:'g',x:8,y:6,kind:'door',channel:'tick',open_when:true};
  const v=(version:number,features:unknown[],prefix:string)=>({...t,rules_version:version,modules:[mod(floor({features,devices:[gate]}),prefix)]});
  assert.notEqual((await call(f,'v13-clock',publish(v(13,[clock],'custom13:')))).status,'Applied');
  for(const [name,bad] of [['on-eq-period',{...clock,on:5}],['offset',{...clock,offset:5}],['period',{...clock,period:13}],['channel',{...clock,channel:'9x'}],['extra',{...clock,extra:1}]] as const)
   assert.notEqual((await call(f,'v14-'+name,publish(v(14,[bad],'custom14:')))).status,'Applied',name);
  assert.notEqual((await call(f,'v14-unwired',publish({...t,rules_version:14,modules:[mod(floor({features:[clock],devices:[{...gate,channel:'other'}]}),'custom14:')]}))).status,'Applied');
  const before=BigInt((await f.view('snapshot')).credits.maker);
  const r=await call(f,'v14-ok',publish(v(14,[clock],'custom14:')));assert.equal(r.status,'Applied',JSON.stringify(r));
  assert.equal(before-BigInt((await f.view('snapshot')).credits.maker),7n); // base 2 + brute 4 + clock 1
  const prog=[{id:'k',x:3,y:3,kind:'key',color:'brass'},{id:'l',x:4,y:4,kind:'lock',color:'brass'},{id:'p',x:2,y:6,kind:'plate',channel:'tick'}];
  assert.equal((await call(f,'v13-still',publish(v(13,prog,'custom13:')))).status,'Applied');
 }finally{await f.sandbox.tearDown();}
});

test('WASM v14 accepts the harbour watch (cost 2) and rejects it before v14',{timeout:180000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms')));
  const watch=[{id:'s0',room:0,slot:0,enemy:'patrol',trap:false,reward:null}];
  assert.notEqual((await call(f,'v13-patrol',publish({...t,rules_version:13,sockets:watch,modules:[mod(floor(),'custom13:')]}))).status,'Applied');
  const before=BigInt((await f.view('snapshot')).credits.maker);
  const r=await call(f,'v14-patrol',publish({...t,rules_version:14,sockets:watch,modules:[mod(floor(),'custom14:')]}));assert.equal(r.status,'Applied',JSON.stringify(r));
  assert.equal(before-BigInt((await f.view('snapshot')).credits.maker),4n); // base 2 + watch 2
 }finally{await f.sandbox.tearDown();}
});
