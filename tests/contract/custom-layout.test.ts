import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import {encodeCustomModule} from '../../packages/shared/src/custom-layout';

// Raw modules keep contract validation independent of the client codec.
function sizedFloor(width:number,height:number,count=0){
 const spawn={x:1,y:1},exit={x:width-2,y:height-2};
 const sockets:{x:number;y:number}[]=[];
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  if((x===spawn.x&&y===spawn.y)||(x===exit.x&&y===exit.y))continue;
  if(sockets.length<count)sockets.push({x,y});
 }
 assert.equal(sockets.length,count);
 return {tiles:['#'.repeat(width),...Array(height-2).fill('#'+'.'.repeat(width-2)+'#'),'#'.repeat(width)],spawn,exit,sockets};
}
const custom5=(floor:unknown)=>'custom5:'+JSON.stringify(floor);
const custom6=(floor:unknown)=>'custom6:'+JSON.stringify(floor);
const custom7=(floor:unknown)=>'custom7:'+JSON.stringify(floor);
const link=(id:string,to:number,x=2,y=3,require_clear=false)=>({id,to,x,y,require_clear});

test('WASM v7 accepts bounded tuning, linear floors and exact funded reservations',{timeout:120000},async()=>{
 const f=await fixture();try{
  const floors=[{...sizedFloor(9,7,2),tuning:[{slot:0,hp:1,damage:1,alert:1,trap_period:2,trap_active:1,trap_offset:0,trap_damage:1},{slot:1,trap_damage:12}]},{...sizedFloor(5,5),tuning:[]}];
  const sockets=[{id:'tuned-reward',room:0,slot:0,enemy:'pursuer',trap:true,reward:'tonic'},{id:'default-trap',room:0,slot:1,enemy:'none',trap:true,reward:null}];
  const t={...terms(Number(await f.view('clock_ms'))),rules_version:7,modules:floors.map(custom7),sockets};
  const before=await f.view('snapshot');
  const action={type:'publish',terms:t,fee:'1',funding:['maker-tonic-0']};
  for(const [i,funding] of [[],['maker-tonic-0','maker-tonic-0'],['buyer-club']].entries()){
   assert.equal((await f.apply('tuned-bad-funding-'+i,{actor:'maker',action:{...action,funding}})).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);
  }
  const published=await f.apply('tuned-linear',{actor:'maker',action});assert.equal(published.status,'Applied');
  const edition=(await f.view('snapshot')).editions[0];assert.deepEqual(edition.terms.modules,t.modules);assert.equal(edition.placement_paid,'7');
  const admitted=await f.apply('tuned-admit',{actor:'buyer',action:{type:'admit',edition_id:published.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'42'}});
  assert.equal(admitted.status,'Applied');assert.deepEqual(admitted.run.assignments,[{socket:'tuned-reward',item_id:'maker-tonic-0',source_pool:'fixed:"tonic"'}]);
  const state=await f.view('snapshot');assert.deepEqual(state.items.find((i:any)=>i.id==='maker-tonic-0').location,{kind:'reserved',run:admitted.result,socket:'tuned-reward',source_pool:'fixed:"tonic"'});
  assert.deepEqual(state.items.find((i:any)=>i.id==='maker-tonic-1').location,{kind:'owned',profile:'maker'});
  assert.equal((await f.apply('tuned-depleted',{actor:'p2',action:{type:'admit',edition_id:published.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'43'}})).result,'IncompleteBundle');assert.deepEqual(await f.view('snapshot'),state);
  // Sixteen maximum overrides and 31x31 geometry exceed the old byte cap.
  const tuning=Array.from({length:16},(_,slot)=>({slot,hp:30,damage:12,alert:8,trap_period:8,trap_active:7,trap_offset:7,trap_damage:12}));
  const large=custom7({...sizedFloor(31,31,16),tuning});assert.ok(Buffer.byteLength(large)>2048);assert.ok(Buffer.byteLength(large)<4096);
  const padded=large+' '.repeat(4096-Buffer.byteLength(large));
  const maxSockets=Array.from({length:64},(_,i)=>({id:'max-'+i,room:Math.floor(i/16),slot:i%16,enemy:i<16?'pursuer':'none',trap:i<16,reward:null}));
  const rest=custom7({...sizedFloor(31,5,16),tuning:[]});
  const maximum=await f.apply('tuned-maximum',{actor:'maker',action:{type:'publish',terms:{...t,modules:[padded,rest,rest,rest],sockets:maxSockets,no_reward:true},fee:'0',funding:[]}});
  assert.equal(maximum.status,'Applied');assert.equal((await f.view('snapshot')).editions.find((e:any)=>e.id===maximum.result).terms.modules[0],padded);
 }finally{await f.sandbox.tearDown();}
});

test('WASM v7 rejects malformed, null, unknown and inapplicable tuning atomically',{timeout:120000},async()=>{
 const f=await fixture();try{
  const floor={...sizedFloor(9,9,2),tuning:[{slot:0,hp:4}]},end=custom7({...sizedFloor(5,5),tuning:[]});
  const socket={id:'encounter',room:0,slot:0,enemy:'charger',trap:true,reward:null};
  const t={...terms(Number(await f.view('clock_ms'))),rules_version:7,modules:[custom7(floor),end],sockets:[socket],no_reward:true};
  const before=await f.view('snapshot');
  const entries:unknown[]=[{slot:0},{hp:4},{slot:null,hp:4},{slot:'0',hp:4},{slot:-1,hp:4},{slot:0.5,hp:4},{slot:2,hp:4},{slot:1,hp:4},{slot:0,hp:4,extra:1},null];
  for(const [field,max,min] of [['hp',30,1],['damage',12,1],['alert',8,1],['trap_period',8,2],['trap_active',1,1],['trap_offset',1,0],['trap_damage',12,1]] as const){
   for(const value of [null,'1',true,1.5,-1,max+1,256,...(min>0?[0]:[])])entries.push({slot:0,[field]:value});
  }
  entries.push({slot:0,trap_period:8,trap_active:8},{slot:0,trap_period:8,trap_offset:8});
  const badFloors:unknown[]=[...entries.map(e=>({...floor,tuning:[e]})),
   sizedFloor(9,9,2),{...floor,tuning:null},{...floor,tuning:{}},
   {...floor,tuning:[{slot:0,hp:4},{slot:0,damage:2}]},
   {...floor,tuning:Array.from({length:17},(_,slot)=>({slot,hp:4}))},
   {...sizedFloor(4,9),tuning:[]},{...sizedFloor(9,32),tuning:[]},
   {...floor,tiles:floor.tiles.map((row,i)=>i===2?'#####':row)},
   {...floor,tiles:floor.tiles.map((row,i)=>i===4?'#########':row)},
   {...floor,tiles:['#.#######',...floor.tiles.slice(1)]}
  ];
  const patches=[...badFloors.map(b=>({modules:[custom7(b),end]})),
   {modules:[custom7(floor)+' '.repeat(4096),end]},
   {modules:[custom7(floor)]},{modules:Array(5).fill(custom7(floor))},
   ...['custom:','custom4:','custom5:','custom6:'].map(prefix=>({modules:[prefix+JSON.stringify(floor),end]})),
   ...[3,4,5,6,12].map(rules_version=>({rules_version})),
   {sockets:[{...socket,enemy:'none'}]},
   ...['trap_period','trap_active','trap_offset','trap_damage'].map(field=>({modules:[custom7({...floor,tuning:[{slot:0,[field]:field==='trap_period'?2:field==='trap_offset'?0:1}]}),end],sockets:[{...socket,trap:false}]}))
  ];
  for(const [i,patch] of patches.entries()){
   const r=await f.apply('bad-tuning-'+i,{actor:'maker',action:{type:'publish',terms:{...t,...patch},fee:'0',funding:[]}});
   assert.equal(r.status,'Rejected',String(i));assert.equal(r.result,'InvalidTerms',String(i));assert.deepEqual(await f.view('snapshot'),before,String(i));
  }
  const invalidSlot=await f.apply('tuned-invalid-socket',{actor:'maker',action:{type:'publish',terms:{...t,sockets:[{...socket,slot:2}]},fee:'0',funding:[]}});
  assert.equal(invalidSlot.result,'InvalidSocket');assert.deepEqual(await f.view('snapshot'),before);
 }finally{await f.sandbox.tearDown();}
});

test('WASM v7 optional links require a complete valid graph and old tuning metadata stays ignored',{timeout:120000},async()=>{
 const f=await fixture();try{
  const floor={...sizedFloor(9,9),tuning:[]},root={...floor,links:[link('next',1)]},leaf={...floor,links:[]};
  const base={...terms(Number(await f.view('clock_ms'))),rules_version:7,modules:[custom7(root),custom7(leaf)],sockets:[],no_reward:true};
  const before=await f.view('snapshot');
  const badModules=[
   [custom7(root),custom7(floor)], [custom7(floor),custom7(leaf)],
   [custom7({...root,links:null}),custom7(leaf)],
   [custom7({...root,links:[]}),custom7(leaf)],
   [custom7({...root,links:[link('outside',2)]}),custom7(leaf)],
   [custom7({...root,links:[link('collision',1,1,1)]}),custom7(leaf)],
   [custom7({...root,links:[link('exit',1,7,7)]}),custom7(leaf)],
   [custom7({...root,sockets:[{x:2,y:3}]}),custom7(leaf)],
   [custom7({...root,links:[link('duplicate',1),link('duplicate',0,3,3)]}),custom7(leaf)],
   [custom7({...root,links:[link('next',1),link('same-position',0)]}),custom7(leaf)],
   [custom7({...root,links:[link('wall',1,0,3)]}),custom7(leaf)],
   [custom7({...root,links:[link('outside',1,9,3)]}),custom7(leaf)],
   [custom7({...root,links:[{id:'missing-clear',x:2,y:3,to:1}]}),custom7(leaf)],
   [custom7({...root,links:[link('x'.repeat(33),1)]}),custom7(leaf)],
   [custom7({...sizedFloor(13,9),tuning:[],links:Array.from({length:9},(_,i)=>link('l'+i,1,2+i,3))}),custom7(leaf)]
  ];
  for(const [i,modules] of badModules.entries()){
   const r=await f.apply('bad-tuned-graph-'+i,{actor:'maker',action:{type:'publish',terms:{...base,modules},fee:'0',funding:[]}});
   assert.equal(r.status,'Rejected');assert.equal(r.result,'InvalidTerms');assert.deepEqual(await f.view('snapshot'),before);
  }
  const graphModules=[custom7({...root,links:[link('next',1),link('branch',2,3,3,true),link('self',0,4,3)]}),custom7({...leaf,links:[link('back',0)]}),custom7(leaf)];
  assert.equal((await f.apply('tuned-graph',{actor:'maker',action:{type:'publish',terms:{...base,modules:graphModules},fee:'0',funding:[]}})).status,'Applied');
  // Do not reinterpret previously ignored tuning, even if its shape is invalid.
  for(const [version,prefix] of [[3,'custom:'],[4,'custom4:'],[5,'custom5:'],[6,'custom6:']] as const){
   const old={...sizedFloor(13,9,4),tuning:null};
   const modules=[0,1].map(room=>prefix+JSON.stringify({...old,...(version===6?{links:[link('next',1-room)]}:{})}));
   assert.equal((await f.apply('old-tuning-'+version,{actor:'maker',action:{type:'publish',terms:{...base,rules_version:version,modules},fee:'0',funding:[]}})).status,'Applied');
   const saved=await f.view('snapshot');
   const over=await f.apply('old-byte-cap-'+version,{actor:'maker',action:{type:'publish',terms:{...base,rules_version:version,modules:[modules[0]+' '.repeat(2049-Buffer.byteLength(modules[0])),modules[1]]},fee:'0',funding:[]}});
   assert.equal(over.result,'InvalidTerms');assert.deepEqual(await f.view('snapshot'),saved);
  }
 }finally{await f.sandbox.tearDown();}
});
test('WASM v3 publication rejects invalid geometry atomically and reserves exact funded stock',{timeout:120000},async()=>{
 const f=await fixture();try{
  const floor={tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[{x:9,y:6},{x:10,y:6},{x:9,y:7},{x:10,y:7}]};
  const module=encodeCustomModule(floor),t={...terms(Number(await f.view('clock_ms'))),rules_version:3,modules:[module,module]};
  const disconnected=structuredClone(floor);disconnected.tiles[4]='#############';
  const island=structuredClone(floor);island.tiles[2]='#..###......#';island.tiles[3]='#..#.#......#';island.tiles[4]='#..###......#';
  const raw=(v:unknown)=>'custom:'+JSON.stringify(v);
  const before=await f.view('snapshot');
  const badModules=['cellar','custom:{',module+' '.repeat(2048),raw({...floor,tiles:floor.tiles.slice(1)}),raw({...floor,tiles:['.############',...floor.tiles.slice(1)]}),raw({...floor,exit:floor.spawn}),raw({...floor,sockets:[floor.spawn,...floor.sockets.slice(1)]}),raw({...floor,spawn:{x:0,y:0}}),raw({...floor,spawn:{x:1.5,y:1}}),raw({...floor,sockets:floor.sockets.slice(1)}),raw(disconnected),raw(island)];
  for(const [i,bad] of badModules.entries()){
   const r=await f.apply('bad-custom-'+i,{actor:'maker',action:{type:'publish',terms:{...t,modules:[bad,module]},fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});
   assert.equal(r.status,'Rejected',String(i));assert.equal(r.result,'InvalidTerms');assert.deepEqual(await f.view('snapshot'),before);
  }
  for(const [id,patch] of [['short',{modules:[module]}],['long',{modules:Array(5).fill(module)}],['version',{rules_version:4}],['slot',{sockets:[{...t.sockets[0],slot:4}]}],['room',{sockets:[{...t.sockets[0],room:2}]}]] as const){
   const rejected=await f.apply('custom-invalid-'+id,{actor:'maker',action:{type:'publish',terms:{...t,...patch},fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});
   assert.equal(rejected.status,'Rejected',id);assert.deepEqual(await f.view('snapshot'),before);
  }
  const r=await f.apply('custom-publish',{actor:'maker',action:{type:'publish',terms:t,fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});
  assert.equal(r.status,'Applied');const published=(await f.view('snapshot')).editions[0];assert.deepEqual(published.terms.modules,[module,module]);assert.equal(published.terms.rules_version,3);
  const admission=await f.apply('custom-admit',{actor:'buyer',action:{type:'admit',edition_id:r.result,expected_version:'1',expected_fee:'3',loadout_ids:['buyer-club'],seed:'42'}});
  assert.equal(admission.status,'Applied');assert.deepEqual(admission.run.assignments.map((a:any)=>a.item_id).sort(),['maker-sword-0','maker-tonic-0','maker-tonic-1']);
 }finally{await f.sandbox.tearDown();}
});

test('WASM v6 accepts branches, returns, self links and leaf exits; reserves actual last-slot goods',{timeout:120000},async()=>{
 const f=await fixture();try{
  const floors=[
   {...sizedFloor(5,5),links:[link('branch',1,2,1),link('other',2,1,2),link('self',0,2,2)]},
   {...sizedFloor(31,31,16),links:[link('return',0),link('branch',3,3,3,true)]},
   {...sizedFloor(7,9),links:[]},
   {...sizedFloor(9,7),links:[link('return',1)]}
  ];
  const modules=floors.map(custom6);
  const socket={id:'graph-reward',room:1,slot:15,enemy:'none',trap:false,reward:'tonic'};
  const t={...terms(Number(await f.view('clock_ms'))),rules_version:6,modules,sockets:[socket]};
  const command={actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:['maker-tonic-0']}};
  const before=await f.view('snapshot');
  for(const [i,patch] of [{sockets:[{...socket,slot:16}]},{sockets:[{...socket,room:2,slot:0}]}].entries()){
   const rejected=await f.apply('graph-slot-'+i,{...command,action:{...command.action,terms:{...t,...patch}}});
   assert.equal(rejected.status,'Rejected');assert.equal(rejected.result,'InvalidSocket');assert.deepEqual(await f.view('snapshot'),before);
  }
  const unfunded=await f.apply('graph-unfunded',{...command,action:{...command.action,funding:[]}});
  assert.equal(unfunded.status,'Rejected');assert.equal(unfunded.result,'IncompleteBundle');assert.deepEqual(await f.view('snapshot'),before);
  const result=await f.apply('graph-publish',command);assert.equal(result.status,'Applied');
  const edition=(await f.view('snapshot')).editions.find((e:any)=>e.id===result.result);
  assert.equal(edition.terms.rules_version,6);assert.deepEqual(edition.terms.modules,modules);
  const admitted=await f.apply('graph-admit',{actor:'buyer',action:{type:'admit',edition_id:result.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'42'}});
  assert.equal(admitted.status,'Applied');
  assert.deepEqual(admitted.run.assignments.map((a:any)=>({socket:a.socket,item_id:a.item_id})),[{socket:'graph-reward',item_id:'maker-tonic-0'}]);
  const state=await f.view('snapshot');assert.equal(state.items.find((i:any)=>i.id==='maker-tonic-0').location.kind,'reserved');
  assert.deepEqual(state.items.find((i:any)=>i.id==='maker-tonic-1').location,{kind:'owned',profile:'maker'});
  const depleted=await f.apply('graph-depleted',{actor:'p2',action:{type:'admit',edition_id:result.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'43'}});
  assert.equal(depleted.status,'Rejected');assert.deepEqual(await f.view('snapshot'),state);
  // All independent caps can be met together, including eight links per floor.
  const maximum=Array.from({length:4},(_,room)=>custom6({...sizedFloor(31,31,16),links:Array.from({length:8},(_,i)=>link(i===0?'x'.repeat(32):'l'+i,(room+1)%4,2+i,3,i%2===0))}));
  maximum.forEach(m=>assert.ok(Buffer.byteLength(m)<=2048));
  const sockets=Array.from({length:64},(_,i)=>({id:'s'+i,room:Math.floor(i/16),slot:i%16,enemy:'none',trap:false,reward:null}));
  assert.equal((await f.apply('graph-maximum',{actor:'maker',action:{type:'publish',terms:{...t,modules:maximum,sockets,no_reward:true},fee:'0',funding:[]}})).status,'Applied');
 }finally{await f.sandbox.tearDown();}
});

test('WASM v6 rejects invalid graphs, link schemas and marker collisions atomically',{timeout:120000},async()=>{
 const f=await fixture();try{
  const floor={...sizedFloor(9,9,1),links:[link('next',1)]},leaf={...sizedFloor(5,5),links:[]};
  const module=custom6(floor),end=custom6(leaf);
  const t={...terms(Number(await f.view('clock_ms'))),rules_version:6,modules:[module,end],sockets:[],no_reward:true};
  const before=await f.view('snapshot');
  const missingClear={id:'next',to:1,x:2,y:3};
  const ragged=structuredClone(floor);ragged.tiles[2]='#...#';
  const disconnected=structuredClone(floor);disconnected.tiles[4]='#'.repeat(9);
  const open=structuredClone(floor);open.tiles[0]='#.#######';
  const bad=[
   sizedFloor(9,9,1), {...floor,links:null}, {...floor,links:{}},
   {...floor,links:[]}, {...floor,links:[link('self',0)]},
   {...floor,links:[link('outside',2)]}, {...floor,links:[link('negative',-1)]},
   {...floor,links:[link('fractional',1.5)]},
   {...floor,links:[missingClear]}, {...floor,links:[{...missingClear,require_clear:'false'}]},
   {...floor,links:[{...link('next',1),to:undefined}]},
   {...floor,links:[{...link('next',1),x:undefined}]},
   {...floor,links:[link('',1)]}, {...floor,links:[link('x'.repeat(33),1)]},
   {...floor,links:[link('duplicate',1),link('duplicate',1,3,3)]},
   {...floor,links:[link('first',1),link('second',1)]},
   {...floor,links:[link('spawn',1,floor.spawn.x,floor.spawn.y)]},
   {...floor,links:[link('exit',1,floor.exit.x,floor.exit.y)]},
   {...floor,links:[link('socket',1,floor.sockets[0].x,floor.sockets[0].y)]},
   {...floor,links:[link('wall',1,0,3)]}, {...floor,links:[link('outside-x',1,9,3)]},
   {...floor,links:[link('outside-y',1,2,9)]}, {...floor,links:[link('negative-x',1,-1,3)]},
   {...floor,links:[link('fractional-x',1,2.5,3)]},
   {...sizedFloor(13,9),links:Array.from({length:9},(_,i)=>link('l'+i,1,2+i,3))},
   {...sizedFloor(4,9),links:[link('next',1)]}, {...sizedFloor(9,32),links:[link('next',1)]},
   {...sizedFloor(9,9,17),links:[link('next',1)]},ragged,disconnected,open,
   {...floor,exit:undefined}
  ];
  const patches=[...bad.map(b=>({modules:[custom6(b),end]})),
   // A leaf cannot reach floor zero in reverse to satisfy directed reachability.
   {modules:[custom6({...leaf,links:[]}),custom6({...floor,links:[link('back',0)]})]},
   {modules:[module,end,custom6({...leaf,links:[link('self',2)]})]},
   {modules:[module]}, {modules:Array(5).fill(module)},
   {modules:[module+' '.repeat(2048),end]},
   {modules:['custom6:{',end]},
   ...['custom:','custom4:','custom5:'].map(prefix=>({modules:[prefix+JSON.stringify(floor),end]})),
   ...[3,4,5,7].map(rules_version=>({rules_version})),
   {sockets:Array.from({length:65},(_,i)=>({id:'s'+i,room:0,slot:0,enemy:'none',trap:false,reward:null}))}
  ];
  for(const [i,patch] of patches.entries()){
   const r=await f.apply('bad-graph-'+i,{actor:'maker',action:{type:'publish',terms:{...t,...patch},fee:'0',funding:[]}});
   assert.equal(r.status,'Rejected',String(i));assert.equal(r.result,'InvalidTerms',String(i));
   assert.deepEqual(await f.view('snapshot'),before,String(i));
  }
 }finally{await f.sandbox.tearDown();}
});

test('WASM v3-v5 continue ignoring link metadata without graph interpretation',{timeout:120000},async()=>{
 const f=await fixture();try{
  const base={...terms(Number(await f.view('clock_ms'))),sockets:[],no_reward:true};
  for(const [version,prefix] of [[3,'custom:'],[4,'custom4:'],[5,'custom5:']] as const){
   const module=prefix+JSON.stringify({...sizedFloor(13,9,4),links:'ignored legacy metadata'});
   const r=await f.apply('legacy-links-'+version,{actor:'maker',action:{type:'publish',terms:{...base,rules_version:version,modules:[module,module]},fee:'0',funding:[]}});
   assert.equal(r.status,'Applied');
   assert.deepEqual((await f.view('snapshot')).editions.find((e:any)=>e.id===r.result).terms.modules,[module,module]);
  }
 }finally{await f.sandbox.tearDown();}
});

test('WASM v4 publishes variable encounter positions, reserves a fifth-slot reward and rejects legacy reinterpretation',{timeout:120000},async()=>{const f=await fixture();try{const floor={tiles:['#############',...Array(7).fill('#...........#'),'#############'],spawn:{x:1,y:1},exit:{x:11,y:7},sockets:[{x:2,y:2},{x:3,y:2},{x:4,y:2},{x:5,y:2},{x:6,y:2}]};const empty={...floor,sockets:[]};const t={...terms(Number(await f.view('clock_ms'))),rules_version:4,modules:[encodeCustomModule(empty,true),encodeCustomModule(floor,true)],sockets:[{id:'free-placement',room:1,slot:4,enemy:'none',trap:false,reward:'tonic'}]};const command={actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:['maker-tonic-0']}};const before=await f.view('snapshot');for(const [i,patch] of [{rules_version:3},{sockets:[{...t.sockets[0],slot:5}]},{sockets:[{...t.sockets[0],room:0}]}].entries()){assert.equal((await f.apply('bad-variable-'+i,{...command,action:{...command.action,terms:{...t,...patch}}})).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);}const result=await f.apply('variable-publish',command);assert.equal(result.status,'Applied');const admitted=await f.apply('variable-admit',{actor:'buyer',action:{type:'admit',edition_id:result.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'1'}});assert.equal(admitted.status,'Applied');assert.deepEqual(admitted.run.assignments.map((a:any)=>a.item_id),['maker-tonic-0']);}finally{await f.sandbox.tearDown();}});

test('WASM v5 accepts independent dimension bounds and four maximum floors with 64 sockets',{timeout:120000},async()=>{
 const f=await fixture();try{
  const base={...terms(Number(await f.view('clock_ms'))),rules_version:5,no_reward:true};
  const rectangles=[custom5(sizedFloor(5,5)),custom5(sizedFloor(5,31)),custom5(sizedFloor(31,5))];
  const first=await f.apply('sized-rectangles',{actor:'maker',action:{type:'publish',terms:{...base,modules:rectangles,sockets:[]},fee:'0',funding:[]}});
  assert.equal(first.status,'Applied');
  const largest=custom5(sizedFloor(31,31,16));assert.ok(Buffer.byteLength(largest)<=2048);
  const sockets=Array.from({length:64},(_,i)=>({id:'slot-'+i,room:Math.floor(i/16),slot:i%16,enemy:'none',trap:false,reward:null}));
  const maximum=await f.apply('sized-maximum',{actor:'maker',action:{type:'publish',terms:{...base,modules:Array(4).fill(largest),sockets},fee:'0',funding:[]}});
  assert.equal(maximum.status,'Applied');
  const editions=(await f.view('snapshot')).editions;
  assert.deepEqual(editions.find((e:any)=>e.id===first.result).terms.modules,rectangles);
  const published=editions.find((e:any)=>e.id===maximum.result);
  assert.equal(published.terms.rules_version,5);assert.equal(published.terms.sockets.length,64);
  assert.deepEqual(published.terms.modules,Array(4).fill(largest));
 }finally{await f.sandbox.tearDown();}
});

test('WASM v5 rejects malformed dimensions, markers, boundaries and legacy reinterpretation atomically',{timeout:120000},async()=>{
 const f=await fixture();try{
  const floor=sizedFloor(7,11,4),module=custom5(floor);
  const base={...terms(Number(await f.view('clock_ms'))),rules_version:5,modules:[module,module],sockets:[],no_reward:true};
  const before=await f.view('snapshot');
  const ragged=structuredClone(floor);ragged.tiles[2]='#...#';
  const open=structuredClone(floor);open.tiles[0]='##.####';
  const disconnected=structuredClone(floor);disconnected.tiles[5]='#######';
  const island=structuredClone(floor);island.tiles[4]='#.###.#';island.tiles[5]='#.#.#.#';island.tiles[6]='#.###.#';
  const invalidTile=structuredClone(floor);invalidTile.tiles[4]='#..x..#';
  const badFloors=[sizedFloor(4,11),sizedFloor(7,4),sizedFloor(32,11),sizedFloor(7,32),
   {...floor,tiles:[]},ragged,open,disconnected,island,invalidTile,
   {...floor,spawn:{x:7,y:1}},{...floor,exit:{x:1,y:11}},
   {...floor,sockets:[{x:7,y:1}]},{...floor,spawn:{x:-1,y:1}},
   {...floor,spawn:{x:1.5,y:1}},{...floor,spawn:{x:0,y:0}},
   {...floor,exit:floor.spawn},{...floor,sockets:[floor.spawn]},
   {...floor,sockets:[floor.sockets[0],floor.sockets[0]]},sizedFloor(13,9,17)];
  const patches=[...badFloors.map(bad=>({modules:[custom5(bad),module]})),
   {modules:['custom5:{',module]}, {modules:[module+' '.repeat(2048),module]},
   {modules:[module]}, {modules:Array(5).fill(module)},
   {rules_version:3}, {rules_version:4}, {rules_version:6},
   // Correct legacy prefixes must still reject non-13x9 dimensions.
   {rules_version:3,modules:Array(2).fill('custom:'+JSON.stringify(floor))},
   {rules_version:4,modules:Array(2).fill('custom4:'+JSON.stringify(floor))},
   // v5 must not reinterpret either older prefix, even at legacy dimensions.
   {modules:Array(2).fill('custom:'+JSON.stringify(sizedFloor(13,9,4)))},
   {modules:Array(2).fill('custom4:'+JSON.stringify(sizedFloor(13,9,4)))},
   {sockets:Array.from({length:65},(_,i)=>({id:'s'+i,room:0,slot:0,enemy:'none',trap:false,reward:null}))}];
  for(const [i,patch] of patches.entries()){
   const rejected=await f.apply('bad-sized-'+i,{actor:'maker',action:{type:'publish',terms:{...base,...patch},fee:'0',funding:[]}});
   assert.equal(rejected.status,'Rejected',String(i));assert.equal(rejected.result,'InvalidTerms',String(i));
   assert.deepEqual(await f.view('snapshot'),before,String(i));
  }
 }finally{await f.sandbox.tearDown();}
});

test('WASM v5 validates actual per-floor slots and reserves exactly the funded last-slot reward',{timeout:120000},async()=>{
 const f=await fixture();try{
  const modules=[custom5(sizedFloor(5,5)),custom5(sizedFloor(9,7,16))];
  const socket={id:'last-slot',room:1,slot:15,enemy:'none',trap:false,reward:'tonic'};
  const t={...terms(Number(await f.view('clock_ms'))),rules_version:5,modules,sockets:[socket]};
  const command={actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:['maker-tonic-0']}};
  const before=await f.view('snapshot');
  for(const [i,sockets] of [[{...socket,slot:16}],[{...socket,room:0,slot:0}],[{...socket,room:2}],[socket,{...socket,id:'same-slot'}]].entries()){
   const rejected=await f.apply('sized-invalid-slot-'+i,{...command,action:{...command.action,terms:{...t,sockets}}});
   assert.equal(rejected.status,'Rejected');assert.equal(rejected.result,'InvalidSocket');assert.deepEqual(await f.view('snapshot'),before);
  }
  for(const [i,funding] of [[],['maker-tonic-0','maker-tonic-0'],['buyer-club']].entries()){
   assert.equal((await f.apply('sized-invalid-funding-'+i,{...command,action:{...command.action,funding}})).status,'Rejected');
   assert.deepEqual(await f.view('snapshot'),before);
  }
  const published=await f.apply('sized-funded',command);assert.equal(published.status,'Applied');
  const admitted=await f.apply('sized-admit',{actor:'buyer',action:{type:'admit',edition_id:published.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'42'}});
  assert.equal(admitted.status,'Applied');
  assert.deepEqual(admitted.run.assignments.map((a:any)=>({socket:a.socket,item_id:a.item_id})),[{socket:'last-slot',item_id:'maker-tonic-0'}]);
  const state=await f.view('snapshot');
  assert.equal(state.items.find((i:any)=>i.id==='maker-tonic-0').location.kind,'reserved');
  assert.deepEqual(state.items.find((i:any)=>i.id==='maker-tonic-1').location,{kind:'owned',profile:'maker'});
  const depleted=await f.apply('sized-depleted',{actor:'p2',action:{type:'admit',edition_id:published.result,expected_version:'1',expected_fee:'1',loadout_ids:[],seed:'43'}});
  assert.equal(depleted.status,'Rejected');assert.deepEqual(await f.view('snapshot'),state);
 }finally{await f.sandbox.tearDown();}
});
