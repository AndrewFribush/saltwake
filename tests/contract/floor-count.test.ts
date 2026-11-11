import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';

function floor(count=0){
 const sockets=Array.from({length:count},(_,i)=>({x:2+i%10,y:1+Math.floor(i/10)}));
 return {tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets,tuning:[]};
}
const module7=(f:unknown)=>'custom7:'+JSON.stringify(f);
const link=(id:string,to:number,x=2)=>({id,x,y:4,to,require_clear:false});
const base=(now:number)=>({...terms(now),rules_version:9,modules:[module7(floor())],sockets:[],no_reward:true,run_duration_ms:'60000',max_runs:1});

test('WASM v9 permits one and sixteen floors, with unchanged encounter and operating limits',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms'))),before=await f.view('snapshot');
  const slots=Array.from({length:64},(_,i)=>({id:'s'+i,room:Math.floor(i/4),slot:i%4,enemy:'none',trap:false,reward:null}));
  const invalid=[
   {modules:[]},{modules:Array(17).fill(module7(floor()))},
   {modules:Array(16).fill(module7(floor(4))),sockets:[...slots,{id:'extra',room:15,slot:3,enemy:'none',trap:false,reward:null}]},
   {modules:Array(5).fill(module7(floor(13)))}, // 65 markers, even with no declared encounters.
   {modules:[module7(floor(17))]},
   {modules:[module7(floor())+' '.repeat(4096)]},
   {modules:[module7(floor()).replace('custom7:','custom9:')]},
   {run_duration_ms:'59999'},{run_duration_ms:'3600001'},{max_runs:0},{max_runs:5},
   {closes_at_ms:String(BigInt(t.opens_at_ms)+86400001n)}
  ];
  for(const [i,patch] of invalid.entries()){
   const r=await f.apply('floor-bad-'+i,{actor:'maker',action:{type:'publish',terms:{...t,...patch},fee:'0',funding:[]}});
   assert.equal(r.status,'Rejected',String(i));assert.deepEqual(await f.view('snapshot'),before);
  }
  const tooMuchFunding=await f.apply('floor-funding-cap',{actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:Array.from({length:129},(_,i)=>'stock-'+i)}});
  assert.equal(tooMuchFunding.result,'InvalidTerms');assert.deepEqual(await f.view('snapshot'),before);
  const single=await f.apply('floor-single',{actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:[]}});assert.equal(single.status,'Applied');
  // The per-floor byte limit also remains available at the one-floor boundary.
  const small=module7(floor()),padded=small+' '.repeat(4096-Buffer.byteLength(small));
  assert.equal((await f.apply('floor-byte-boundary',{actor:'maker',action:{type:'publish',terms:{...t,modules:[padded]},fee:'0',funding:[]}})).status,'Applied');
  const modules=Array(16).fill(module7(floor(4)));
  const maximum=await f.apply('floor-sixteen',{actor:'maker',action:{type:'publish',terms:{...t,modules,sockets:slots,run_duration_ms:'3600000',max_runs:4},fee:'0',funding:[]}});assert.equal(maximum.status,'Applied');
  const state=await f.view('snapshot'),edition=state.editions.find((e:any)=>e.id===maximum.result);
  assert.equal(state.editions.find((e:any)=>e.id===single.result).terms.modules.length,1);
  assert.deepEqual(edition.terms.modules,modules);assert.equal(edition.terms.sockets.length,64);
  assert.equal(edition.terms.run_duration_ms,'3600000');assert.equal(edition.terms.max_runs,4);
 }finally{await f.sandbox.tearDown();}
});

test('WASM v1-v8 keep two-to-four floor bounds after v9 introduction',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t=base(Number(await f.view('clock_ms')));
  for(let version=1;version<=8;version++){
   const modules=(count:number)=>Array.from({length:count},(_,room)=>version<3?'cellar':(version===3?'custom:':`custom${Math.min(version,7)}:`)+JSON.stringify({...floor(4),...(version===6?{links:[link('next',(room+1)%count)]}:{})}));
   const legacy={...t,rules_version:version,run_duration_ms:'900000',max_runs:4};
   for(const count of [0,1,5,16]){
    const before=await f.view('snapshot');const r=await f.apply(`legacy-${version}-bad-${count}`,{actor:'maker',action:{type:'publish',terms:{...legacy,modules:modules(count)},fee:'0',funding:[]}});
    assert.equal(r.result,'InvalidTerms',`v${version}, ${count} floors`);assert.deepEqual(await f.view('snapshot'),before);
   }
   for(const count of [2,4])assert.equal((await f.apply(`legacy-${version}-valid-${count}`,{actor:'maker',action:{type:'publish',terms:{...legacy,modules:modules(count)},fee:'0',funding:[]}})).status,'Applied');
  }
 }finally{await f.sandbox.tearDown();}
});

test('WASM v9 validates all directed floors and reserves exact last-floor socket goods',{timeout:120000},async()=>{
 const f=await fixture();try{
  const graph=Array.from({length:16},(_,room)=>({...floor(room===15?16:0),links:room===0?[link('forward',1)]:room===15?[link('return',0)]:[link('forward',room+1),link('return',room-1,3)]}));
  const t={...base(Number(await f.view('clock_ms'))),modules:graph.map(module7),no_reward:false,sockets:[{id:'last-floor-last-slot',room:15,slot:15,enemy:'pursuer',trap:true,reward:'tonic'}]};
  const tuned=structuredClone(graph) as Array<Omit<typeof graph[number],'tuning'> & {tuning:Array<{slot:number;hp:number;trap_period:number}>}>;
  tuned[15].tuning=[{slot:15,hp:8,trap_period:4}];t.modules=tuned.map(module7);
  const before=await f.view('snapshot');
  const graphs=[
   graph.map((r,i)=>i===7?{...r,links:[link('return',6)]}:r), // Floors 8..15 cannot be reached.
   graph.map((r,i)=>i===15?{...r,links:[link('outside',16)]}:r),
   graph.map((r,i)=>i===15?floor(16):r), // Optional graphs still require every links array.
   graph.map((r,i)=>i===15?{...r,links:[link('duplicate',0),link('duplicate',14,3)]}:r)
  ];
  for(const [i,invalid] of graphs.entries()){
   const r=await f.apply('graph-bad-'+i,{actor:'maker',action:{type:'publish',terms:{...t,modules:invalid.map(module7)},fee:'1',funding:['maker-tonic-0']}});
   assert.equal(r.result,'InvalidTerms');assert.deepEqual(await f.view('snapshot'),before);
  }
  for(const [i,patch] of [{room:16},{slot:16}].entries()){
   const r=await f.apply('last-slot-bad-'+i,{actor:'maker',action:{type:'publish',terms:{...t,sockets:[{...t.sockets[0],...patch}]},fee:'1',funding:['maker-tonic-0']}});
   assert.equal(r.result,'InvalidSocket');assert.deepEqual(await f.view('snapshot'),before);
  }
  assert.equal((await f.apply('last-floor-unfunded',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:[]}})).result,'IncompleteBundle');assert.deepEqual(await f.view('snapshot'),before);
  const published=await f.apply('last-floor-publish',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:['maker-tonic-0']}});assert.equal(published.status,'Applied');
  const admitted=await f.apply('last-floor-admit',{actor:'buyer',action:{type:'admit',edition_id:published.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'42'}});assert.equal(admitted.status,'Applied');
  assert.deepEqual(admitted.run.assignments,[{socket:'last-floor-last-slot',item_id:'maker-tonic-0',source_pool:'fixed:"tonic"'}]);
  const state=await f.view('snapshot');assert.deepEqual(state.editions[0].terms.modules,t.modules);
  assert.deepEqual(state.editions[0].terms.sockets,t.sockets);
  assert.deepEqual(state.items.find((i:any)=>i.id==='maker-tonic-0').location,{kind:'reserved',run:admitted.result,socket:'last-floor-last-slot',source_pool:'fixed:"tonic"'});
  assert.deepEqual(state.items.find((i:any)=>i.id==='maker-tonic-1').location,{kind:'owned',profile:'maker'});
  const oneGraph=module7({...floor(),links:[]});
  assert.equal((await f.apply('single-graph',{actor:'maker',action:{type:'publish',terms:{...base(Number(await f.view('clock_ms'))),modules:[oneGraph]},fee:'0',funding:[]}})).status,'Applied');
 }finally{await f.sandbox.tearDown();}
});

for(const publicationType of ['publish','publish_random']) test(`WASM large v9 ${publicationType} has a bounded 128 KiB allowance; other commands retain 32 KiB`,{timeout:120000},async()=>{
 const f=await fixture();try{
  const modules=Array.from({length:16},(_,room)=>module7({
   tiles:['#'.repeat(31),...Array(29).fill('#'+'.'.repeat(29)+'#'),'#'.repeat(31)],
   spawn:{x:1,y:1},exit:{x:29,y:29},
   sockets:Array.from({length:4},(_,slot)=>({x:slot+2,y:1})),
   tuning:Array.from({length:4},(_,slot)=>({slot,trap_period:8,trap_active:7,trap_offset:7,trap_damage:12})),
   links:Array.from({length:4},(_,i)=>({id:'link-'+i,x:i+2,y:3,to:(room+1)%16,require_clear:false}))
  }));
  const t={...base(Number(await f.view('clock_ms'))),modules,sockets:Array.from({length:64},(_,i)=>({id:'s'+i,room:Math.floor(i/4),slot:i%4,enemy:'none',trap:true,reward:null}))};
  const publish={actor:'maker',action:{type:'publish',terms:t,fee:'0',funding:[]}};
  const random={actor:'maker',action:{type:'publish_random',terms:t,fee:'0',fixed_funding:[],random_tables:[]}};
  const bytes=(args:object)=>Buffer.byteLength(JSON.stringify(args));
  const padded=(op_id:string,command:object,size:number)=>{
   const args={op_id,command,padding:''};args.padding=' '.repeat(size-bytes(args));assert.equal(bytes(args),size);return args;
  };
  const call=(args:Record<string,unknown>)=>f.account.callFunction<any>({contractId:f.contractId,methodName:'execute',args,gas:300_000_000_000_000n,waitUntil:'INCLUDED_FINAL'});
  for(const [i,command] of [publicationType==='publish'?publish:random].entries()){
   const args={op_id:'large-valid-'+i,command};assert.ok(bytes(args)>32768);assert.ok(bytes(args)<131072);
   assert.ok(modules.every(m=>Buffer.byteLength(m)<=4096));
   console.log(`Large v9 ${command.action.type}: ${bytes(args)} bytes, 16 floors, 64 trap markers`);
   const receipt=await call(args);assert.equal(receipt.status,'Applied');
   const edition=(await f.view('snapshot')).editions.find((e:any)=>e.id===receipt.result);
   assert.deepEqual(edition.terms.modules,modules);assert.deepEqual(edition.terms.sockets,t.sockets);
   // Unknown envelope metadata counts toward the raw input bound, even though
   // deserialization ignores it. Pin both sides of the inclusive limit.
   const boundary=await call(padded(args.op_id,command,131072));assert.equal(boundary.status,'Applied');
   // Release WASM may expose Rust assertion panics as an unreachable trap.
   const before=await f.view('snapshot');
   await assert.rejects(call(padded(args.op_id,command,131073)),{name:'ContractExecutionError',message:/Request too large|WebAssembly trap: An `unreachable` opcode/});
   assert.deepEqual(await f.view('snapshot'),before);
  }
  for(let version=1;version<=8;version++){
   for(const [i,command] of [publish,random].entries()){
    const legacy={...command,action:{...command.action,terms:{...t,rules_version:version}}};
    const before=await f.view('snapshot');
    await assert.rejects(call({op_id:`large-legacy-${version}-${i}`,command:legacy}),{name:'ContractExecutionError',message:/Request too large|WebAssembly trap: An `unreachable` opcode/});
    assert.deepEqual(await f.view('snapshot'),before);
   }
  }
  const nonpublish={actor:'maker',action:{type:'set_fee',edition_id:(await f.view('snapshot')).editions[0].id,new_fee:'0'}};
  assert.equal((await call(padded('legacy-boundary',nonpublish,32768))).status,'Applied');
  const before=await f.view('snapshot');
  await assert.rejects(call(padded('nonpublish-over',nonpublish,32769)),{name:'ContractExecutionError',message:/Request too large|WebAssembly trap: An `unreachable` opcode/});
  assert.deepEqual(await f.view('snapshot'),before);
 }finally{await f.sandbox.tearDown();}
});
