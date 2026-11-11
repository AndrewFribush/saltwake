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
