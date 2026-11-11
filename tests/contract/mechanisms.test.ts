import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';

const sw=(patch:Record<string,unknown>={})=>({id:'switch',x:2,y:2,kind:'switch',channel:'Gate_1-a',mode:'toggle',...patch});
const door=(patch:Record<string,unknown>={})=>({id:'door',x:3,y:2,kind:'door',channel:'Gate_1-a',open_when:true,...patch});
const floor=(devices:unknown[]=[])=>({tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[] as {x:number;y:number}[],tuning:[] as unknown[],devices});
const mod=(f:unknown)=>'custom10:'+JSON.stringify(f);
const link=(to:number)=>({id:'next',x:9,y:5,to,require_clear:false});
const base=(now:number)=>({...terms(now),rules_version:10,modules:[mod(floor())],sockets:[] as unknown[],no_reward:true,run_duration_ms:'60000',max_runs:1});
const publish=(t:object)=>({actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:[]}});
const call=(f:Awaited<ReturnType<typeof fixture>>,op_id:string,command:object,padding?:string)=>f.account.callFunction<any>({contractId:f.contractId,methodName:'execute',args:{op_id,command,...(padding===undefined?{}:{padding})},gas:300_000_000_000_000n,waitUntil:'INCLUDED_FINAL'});

test('WASM v10 requires exact typed devices and bounded ASCII channels and UTF8 IDs',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms'))),before=await f.view('snapshot');
  const missing=(device:Record<string,unknown>,key:string)=>{const d={...device};delete d[key];return d;};
  const badDevices=[
   ...['id','x','y','kind','channel','mode'].map(key=>missing(sw(),key)),
   missing(door(),'open_when'),sw({id:''}),sw({id:'é'.repeat(17)}),sw({id:3}),
   sw({x:-1}),sw({x:1.5}),sw({x:'2'}),sw({y:null}),sw({kind:'button'}),
   sw({mode:'flip'}),sw({mode:null}),sw({open_when:true}),sw({extra:1}),
   door({mode:'toggle'}),door({open_when:1}),door({open_when:null}),door({extra:1}),
   ...['','1gate','_gate','-gate','é','a b','a.b','a\n','a'.repeat(33)].map(channel=>sw({channel})),
   sw({channel:null}),sw({channel:42})
  ];
  const badFloors=[{...floor(),devices:undefined},{...floor(),devices:null},{...floor(),devices:{}},...badDevices.map(d=>floor([d])),floor([sw(),sw({x:4})])];
  for(const [i,room] of badFloors.entries()){
   const r=await call(f,'schema-'+i,publish({...t,modules:[mod(room)]}));assert.equal(r.result,'InvalidTerms',String(i));assert.deepEqual(await f.view('snapshot'),before);
  }
  for(const [i,mode] of ['toggle','set','clear'].entries()){
   const channel='A'+'x'.repeat(31);
   const room=floor([sw({id:'é'.repeat(16),channel,mode}),door({channel,open_when:i!==0})]);
   assert.equal((await call(f,'schema-valid-'+i,publish({...t,modules:[mod(room)]}))).status,'Applied');
  }
 }finally{await f.sandbox.tearDown();}
});

test('WASM v10 enforces geometry, marker collisions, device totals and operating bounds',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms'))),before=await f.view('snapshot');
  const devices=(n:number)=>Array.from({length:n},(_,i)=>sw({id:'s'+i,x:2+i%8,y:2+Math.floor(i/8)}));
  const badRooms=[
   floor([sw({x:0})]),floor([sw({x:13})]),floor([sw({y:9})]),floor([sw({x:1,y:1})]),floor([sw({x:11,y:7})]),
   floor([sw(),door({x:2})]),{...floor([sw()]),sockets:[{x:2,y:2}]},
   {...floor([sw()]),links:[{...link(0),x:2,y:2}]},floor(devices(17)),
   {...floor(),tiles:['#####','#...#','#...#','#####']}, // height below five
   {...floor(),tiles:['#####','#...#','#...#','#..#','#####']},
   {...floor(),tiles:['.'.repeat(13),...Array(7).fill('#...........#'),'#############']}
  ];
  const patches=[...badRooms.map(room=>({modules:[mod(room)]})),
   {modules:[]},{modules:Array(17).fill(mod(floor()))},
   {modules:Array(5).fill(mod(floor(devices(13))))},
   {modules:Array(5).fill(mod({...floor(),sockets:devices(13).map(d=>({x:d.x,y:d.y}))}))},
   {modules:[mod(floor()).replace('custom10:','custom7:')]},
   {modules:[mod(floor())+' '.repeat(4096)]},
   {run_duration_ms:'59999'},{run_duration_ms:'3600001'},{max_runs:0},{max_runs:5}
  ];
  for(const [i,patch] of patches.entries()){
   const r=await call(f,'bounds-'+i,publish({...t,...patch}));assert.equal(r.status,'Rejected',String(i));assert.deepEqual(await f.view('snapshot'),before);
  }
  const small=mod(floor()),padded=small+' '.repeat(4096-Buffer.byteLength(small));
  for(const [i,modules] of [[mod(floor())],[padded],Array(4).fill(mod(floor(devices(16)))),Array(16).fill(mod(floor(devices(4))))].entries()){
   const r=await call(f,'bounds-valid-'+i,publish({...t,modules,run_duration_ms:'3600000',max_runs:4}));assert.equal(r.status,'Applied');
  }
 }finally{await f.sandbox.tearDown();}
});

test('WASM v10 wires channels across directed floors and reserves exact funded goods',{timeout:120000},async()=>{
 const f=await fixture();try{
  const rooms=Array.from({length:16},(_,i)=>({...floor(i===0?[sw()]:i===15?[door()]:[]),links:[link((i+1)%16)]}));
  rooms[15].sockets=[{x:5,y:2}];rooms[15].tuning=[{slot:0,hp:12,trap_period:8,trap_active:7}];
  const t={...base(Number(await f.view('clock_ms'))),modules:rooms.map(mod),no_reward:false,sockets:[{id:'last',room:15,slot:0,enemy:'pursuer',trap:true,reward:'tonic'}]};
  const before=await f.view('snapshot');
  const bad=[
   rooms.map((r,i)=>i===0?{...r,devices:[]}:r),
   rooms.map((r,i)=>i===15?{...r,devices:[door({channel:'gate_1-a'})]}:r),
   rooms.map((r,i)=>i===0?{...r,links:[]}:r),
   rooms.map((r,i)=>i===15?{...r,links:[link(16)]}:r),
   rooms.map((r,i)=>i===15?{...r,links:undefined}:r),
   rooms.map((r,i)=>i===15?{...r,tuning:[{slot:1,hp:12}]}:r)
  ];
  for(const [i,modules] of bad.entries()){
   const r=await call(f,'graph-bad-'+i,{actor:'maker',action:{type:'publish',terms:{...t,modules:modules.map(mod)},fee:'1',funding:['maker-tonic-0']}});
   assert.equal(r.status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);
  }
  const unfunded=await call(f,'unfunded',publish(t));assert.equal(unfunded.result,'IncompleteBundle');assert.deepEqual(await f.view('snapshot'),before);
  const p=await call(f,'funded',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:['maker-tonic-0']}});assert.equal(p.status,'Applied');
  const run=await call(f,'admit',{actor:'buyer',action:{type:'admit',edition_id:p.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'42'}});assert.equal(run.status,'Applied');
  assert.deepEqual(run.run.assignments,[{socket:'last',item_id:'maker-tonic-0',source_pool:'fixed:"tonic"'}]);
  const state=await f.view('snapshot');assert.deepEqual(state.editions[0].terms.modules,t.modules);
  assert.deepEqual(state.items.find((i:any)=>i.id==='maker-tonic-0').location,{kind:'reserved',run:run.result,socket:'last',source_pool:'fixed:"tonic"'});
 }finally{await f.sandbox.tearDown();}
});

test('WASM v3-v9 preserve ignored device metadata and reject the custom10 prefix',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms')));
  for(let version=3;version<=9;version++){
   const prefix=version===3?'custom:':`custom${Math.min(version,7)}:`;
   const modules=Array.from({length:2},(_,room)=>prefix+JSON.stringify({...floor(),devices:[{nonsense:true}],sockets:[{x:2,y:1},{x:3,y:1},{x:4,y:1},{x:5,y:1}],...(version===6?{links:[link(1-room)]}:{})}));
   const legacy={...t,rules_version:version,modules,run_duration_ms:'900000',max_runs:4};
   assert.equal((await call(f,'legacy-valid-'+version,publish(legacy))).status,'Applied');
   const before=await f.view('snapshot');
   assert.equal((await call(f,'legacy-prefix-'+version,publish({...legacy,modules:[mod(floor()),mod(floor())]}))).result,'InvalidTerms');assert.deepEqual(await f.view('snapshot'),before);
  }
 }finally{await f.sandbox.tearDown();}
});

for(const type of ['publish','publish_random'])test(`WASM v10 ${type} accepts large geometry with devices within the 128 KiB input cap`,{timeout:120000},async()=>{
 const f=await fixture();try{
  const modules=Array.from({length:16},(_,i)=>mod({...floor([sw({id:'a',x:2,y:3}),door({id:'b',x:3,y:3}),sw({id:'c',x:4,y:3,mode:'clear'}),door({id:'d',x:5,y:3,open_when:false})]),
   tiles:['#'.repeat(31),...Array(29).fill('#'+'.'.repeat(29)+'#'),'#'.repeat(31)],exit:{x:29,y:29},
   sockets:Array.from({length:4},(_,slot)=>({x:slot+2,y:2})),
   tuning:Array.from({length:4},(_,slot)=>({slot,trap_period:8,trap_active:7,trap_offset:7,trap_damage:12})),
   links:Array.from({length:4},(_,j)=>({...link((i+1)%16),id:'link-'+j,x:j+10,y:10}))
  }));
  const t={...base(Number(await f.view('clock_ms'))),modules,sockets:Array.from({length:64},(_,i)=>({id:'trap-'+i,room:Math.floor(i/4),slot:i%4,enemy:'none',trap:true,reward:null}))};
  const command={actor:'maker',action:{type,terms:t,fee:'0',...(type==='publish'?{funding:[]}:{fixed_funding:[],random_tables:[]})}};
  const op_id='large-'+type,bytes=Buffer.byteLength(JSON.stringify({op_id,command}));assert.ok(bytes>32768);assert.ok(modules.every(m=>Buffer.byteLength(m)<=4096));
  const r=await call(f,op_id,command);assert.equal(r.status,'Applied');assert.deepEqual((await f.view('snapshot')).editions[0].terms.modules,modules);
  const overhead=Buffer.byteLength(JSON.stringify({op_id,command,padding:''}));
  assert.equal((await call(f,op_id,command,' '.repeat(131072-overhead))).status,'Applied');
  const before=await f.view('snapshot');await assert.rejects(call(f,op_id,command,' '.repeat(131073-overhead)),{name:'ContractExecutionError',message:/Request too large|WebAssembly trap: An `unreachable` opcode/});assert.deepEqual(await f.view('snapshot'),before);
  console.log(`${type}: ${bytes} bytes, 16 floors at 31x31, 64 devices, 64 tuned traps, 300 Tgas`);
 }finally{await f.sandbox.tearDown();}
});
