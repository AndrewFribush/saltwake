import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';

const rule=(patch:Record<string,unknown>={})=>({extract:true,require_clear:false,...patch});
const sw=(channel='Exit_1-a')=>({id:'switch',x:2,y:2,kind:'switch',channel,mode:'toggle'});
const floor=(exit_rule:unknown=rule())=>({tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[] as {x:number;y:number}[],tuning:[] as unknown[],devices:[] as unknown[],exit_rule});
const mod=(f:unknown)=>'custom11:'+JSON.stringify(f);
const link=(to:number)=>({id:'next',x:9,y:5,to,require_clear:false});
const base=(now:number)=>({...terms(now),rules_version:11,modules:[mod(floor())],sockets:[] as unknown[],no_reward:true,run_duration_ms:'60000',max_runs:1});
const publish=(t:object)=>({actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:[]}});
const call=(f:Awaited<ReturnType<typeof fixture>>,op_id:string,command:object,padding?:string)=>f.account.callFunction<any>({contractId:f.contractId,methodName:'execute',args:{op_id,command,...(padding===undefined?{}:{padding})},gas:300_000_000_000_000n,waitUntil:'INCLUDED_FINAL'});

test('WASM v11 requires exact exit rules with paired non-null channel and value',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms'))),before=await f.view('snapshot');
  const bad=[undefined,null,[],[true,false],[true,false,'Exit_1-a',true],{},true,'exit',{extract:true},{require_clear:false},
   rule({extra:true}),rule({extract:null}),rule({extract:1}),rule({extract:'true'}),
   rule({require_clear:null}),rule({require_clear:0}),rule({require_clear:'false'}),
   rule({channel:'Exit_1-a'}),rule({value:false}),rule({channel:null,value:false}),rule({channel:'Exit_1-a',value:null}),
   rule({channel:null,value:null}),rule({channel:1,value:true}),rule({channel:'Exit_1-a',value:1}),rule({channel:'Exit_1-a',value:'true'}),
   ...['','1exit','_exit','-exit','é','a b','a.b','a\n','a'.repeat(33)].map(channel=>rule({channel,value:true}))
  ];
  for(const [i,exit_rule] of bad.entries()){
   const room={...floor(exit_rule),exit_rule,devices:[sw()]}; // Explicit undefined omits the required field.
   const r=await call(f,'schema-'+i,publish({...t,modules:[mod(room)]}));assert.equal(r.result,'InvalidTerms',String(i));assert.deepEqual(await f.view('snapshot'),before);
  }
  for(const extract of [false,true])for(const require_clear of [false,true]){
   const modules=[mod(floor(rule({extract,require_clear}))),mod(floor())];
   assert.equal((await call(f,`valid-${extract}-${require_clear}`,publish({...t,modules}))).status,'Applied');
  }
  for(const value of [false,true]){
   const channel='A'+'x'.repeat(31),room={...floor(rule({channel,value})),devices:[sw(channel)]};
   assert.equal((await call(f,'signal-'+value,publish({...t,modules:[mod(room)]}))).status,'Applied');
  }
 }finally{await f.sandbox.tearDown();}
});

test('WASM v11 requires an extraction floor and globally wired exit channels while preserving bounds',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms'))),before=await f.view('snapshot');
  const many=(count:number)=>Array.from({length:count},(_,i)=>({...sw(),id:'s'+i,x:2+i%8,y:2+Math.floor(i/8)}));
  const bad=[
   {modules:[mod(floor(rule({extract:false})))]},
   {modules:Array(16).fill(mod(floor(rule({extract:false}))))},
   {modules:[mod(floor(rule({channel:'Exit_1-a',value:false})))]},
   // Non-extraction exits still gate continuation and must be wired.
   {modules:[mod(floor(rule({extract:false,channel:'Exit_1-a',value:true}))),mod(floor())]},
   {modules:[mod({...floor(rule({channel:'exit_1-a',value:true})),devices:[sw()]})]},
   {modules:[]},{modules:Array(17).fill(mod(floor()))},
   {modules:[mod({...floor(),devices:undefined})]},{modules:[mod({...floor(),tuning:undefined})]},
   {modules:[mod({...floor(),devices:[{...sw(),extra:true}]})]},
   {modules:[mod({...floor(),devices:[{...sw(),x:1,y:1}]})]},
   {modules:[mod({...floor(),devices:many(17)})]},
   {modules:Array(5).fill(mod({...floor(),devices:many(13)}))},
   {modules:Array(5).fill(mod({...floor(),sockets:many(13).map(d=>({x:d.x,y:d.y}))}))},
   {modules:[mod(floor()).replace('custom11:','custom10:')]},
   {modules:[mod(floor())+' '.repeat(4096)]},
   {run_duration_ms:'59999'},{run_duration_ms:'3600001'},{max_runs:0},{max_runs:5}
  ];
  for(const [i,patch] of bad.entries()){
   const r=await call(f,'bounds-'+i,publish({...t,...patch}));assert.equal(r.status,'Rejected',String(i));assert.deepEqual(await f.view('snapshot'),before);
  }
  const small=mod(floor()),padded=small+' '.repeat(4096-Buffer.byteLength(small));
  assert.equal((await call(f,'module-boundary',publish({...t,modules:[padded],run_duration_ms:'3600000',max_runs:4}))).status,'Applied');
  // Signal reachability/solvability is deliberately not inferred: the switch can
  // be in a later linear floor, and false is a valid channel target value.
  const modules=[mod(floor(rule({extract:false,channel:'Exit_1-a',value:false}))),mod({...floor(),devices:[sw()]})];
  assert.equal((await call(f,'global-switch',publish({...t,modules}))).status,'Applied');
 }finally{await f.sandbox.tearDown();}
});

test('WASM v11 validates graph exit policies and reserves exact funded last-floor goods',{timeout:120000},async()=>{
 const f=await fixture();try{
  const rooms=Array.from({length:16},(_,i)=>({...floor(rule({extract:i===15,require_clear:true,channel:'Exit_1-a',value:true})),devices:i===0?[sw()]:[],links:[link((i+1)%16)]}));
  rooms[15].sockets=[{x:5,y:2}];rooms[15].tuning=[{slot:0,hp:12,trap_period:8,trap_active:7}];
  const t={...base(Number(await f.view('clock_ms'))),modules:rooms.map(mod),no_reward:false,sockets:[{id:'last',room:15,slot:0,enemy:'pursuer',trap:true,reward:'tonic'}]};
  const before=await f.view('snapshot');
  const bad=[
   rooms.map((r,i)=>i===0?{...r,links:[]}:r),
   rooms.map((r,i)=>i===15?{...r,links:[link(16)]}:r),
   rooms.map((r,i)=>i===15?{...r,links:undefined}:r),
   rooms.map((r,i)=>i===15?{...r,tuning:[{slot:1,hp:12}]}:r),
   rooms.map((r,i)=>i===15?{...r,exit_rule:rule({extract:false})}:r)
  ];
  for(const [i,modules] of bad.entries()){
   const r=await call(f,'graph-bad-'+i,{actor:'maker',action:{type:'publish',terms:{...t,modules:modules.map(mod)},fee:'1',funding:['maker-tonic-0']}});
   assert.equal(r.status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);
  }
  assert.equal((await call(f,'unfunded',publish(t))).result,'IncompleteBundle');assert.deepEqual(await f.view('snapshot'),before);
  const p=await call(f,'funded',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:['maker-tonic-0']}});assert.equal(p.status,'Applied');
  const run=await call(f,'admit',{actor:'buyer',action:{type:'admit',edition_id:p.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'42'}});assert.equal(run.status,'Applied');
  assert.deepEqual(run.run.assignments,[{socket:'last',item_id:'maker-tonic-0',source_pool:'fixed:"tonic"'}]);
  const state=await f.view('snapshot');assert.deepEqual(state.editions[0].terms.modules,t.modules);
  assert.deepEqual(state.items.find((i:any)=>i.id==='maker-tonic-0').location,{kind:'reserved',run:run.result,socket:'last',source_pool:'fixed:"tonic"'});
 }finally{await f.sandbox.tearDown();}
});

test('WASM v1-v10 stay pinned and old custom modules ignore exit_rule metadata',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms')));
  for(let version=1;version<=10;version++){
   const prefix=version===3?'custom:':version===10?'custom10:':`custom${Math.min(version,7)}:`;
   const modules=Array.from({length:2},(_,room)=>version<3?'cellar':prefix+JSON.stringify({...floor({extract:null,nonsense:true}),sockets:[{x:2,y:1},{x:3,y:1},{x:4,y:1},{x:5,y:1}],...(version===6?{links:[link(1-room)]}:{})}));
   const legacy={...t,rules_version:version,modules,run_duration_ms:'900000',max_runs:4};
   assert.equal((await call(f,'legacy-valid-'+version,publish(legacy))).status,'Applied');
   const before=await f.view('snapshot');
   assert.equal((await call(f,'legacy-prefix-'+version,publish({...legacy,modules:[mod(floor()),mod(floor())]}))).result,'InvalidTerms');assert.deepEqual(await f.view('snapshot'),before);
  }
 }finally{await f.sandbox.tearDown();}
});

for(const type of ['publish','publish_random'])test(`WASM v11 ${type} retains the bounded large publication allowance`,{timeout:120000},async()=>{
 const f=await fixture();try{
  const modules=Array.from({length:16},(_,i)=>mod({...floor(rule({extract:i===15,require_clear:true,channel:'Exit_1-a',value:true})),
   devices:Array.from({length:4},(_,j)=>({...sw(),id:'s'+j,x:2+j,y:3})),
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
  console.log(`${type}: ${bytes} bytes, 16 floors at 31x31, 64 devices, 64 tuned traps, authored exit policies, 300 Tgas`);
 }finally{await f.sandbox.tearDown();}
});
