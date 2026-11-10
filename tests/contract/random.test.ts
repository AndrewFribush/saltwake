import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import type {Command} from '../../packages/shared/src/types';
import {commandHash} from '../../packages/shared/src/protocol';
const partition=(ids:string[])=>({town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:ids});
const admit=(actor:string,seed='42'):Command=>({actor,action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'0',loadout_ids:[],seed}});
test('random pools reserve without replacement, replay deterministically, return on death and exclude extracted/consumed goods',{timeout:120000},async()=>{
 const f=await fixture();try{
 const legacy:Command={actor:'maker',action:{type:'publish',terms:{title:'Legacy',rules_version:1,modules:['cellar','gauntlet'],sockets:[],opens_at_ms:'0',closes_at_ms:'120000',no_reward:true,difficulty_tag:'standard',style_tag:'combat',run_duration_ms:'900000',max_runs:4},fee:'3',funding:[]}};
 // Captured from the pre-M22 encoder: old durable outbox payloads must keep their hash.
 assert.equal(commandHash(legacy),'a50b7456191b9250f28fbff30aa2604eee8020de9df53e7d0a93aaff520ec129');
 assert.equal(await f.view('command_hash',{command:legacy}),commandHash(legacy));
 const base=terms(Number(await f.view('clock_ms')));
 const command:Command={actor:'maker',action:{type:'publish_random',terms:{...base,sockets:base.sockets.map(s=>({...s,reward:null}))},fee:'0',fixed_funding:[],random_tables:[{table_id:'loot',socket_ids:['sword','tonic-a','tonic-b'],item_ids:['maker-tonic-0','maker-tonic-1','maker-tonic-2','maker-tonic-3','maker-tonic-4','maker-tonic-5']}]}};
 assert.deepEqual(await f.view('roundtrip_command',{command}),command);
 const published=await f.apply('publish',command);assert.equal(published.status,'Applied');assert.equal(published.payload_hash,commandHash(command));
 const first=await f.apply('first',admit('buyer'));assert.equal(first.status,'Applied');assert.equal(first.run.seed,'42');
 assert.deepEqual(await f.apply('first',admit('buyer')),first);
 const second=await f.apply('second',admit('p2'));assert.equal(second.status,'Applied');
 const ids=(r:any):string[]=>r.run.assignments.map((a:any)=>a.item_id);
 assert.equal(new Set([...ids(first),...ids(second)]).size,6);
 const before=await f.view('snapshot');assert.equal((await f.apply('empty',admit('p3'))).result,'IncompleteBundle');assert.deepEqual(await f.view('snapshot'),before);
 assert.equal((await f.apply('death',{actor:'buyer',action:{type:'settle',run_id:first.result,outcome:'died',disposition:partition(ids(first)),carried_dungeon_ids:[]}})).status,'Applied');
 assert.equal((await f.apply('void',{actor:'p2',action:{type:'void',run_id:second.result,reason:'test recovery',disposition:partition(ids(second))}})).status,'Applied');
 const again=await f.apply('again',admit('buyer'));assert.deepEqual(again.run.assignments,first.run.assignments);
 const [consumed,extracted,returned]=ids(again);
 const end={actor:'buyer',action:{type:'settle',run_id:again.result,outcome:'extracted',disposition:{...partition([returned]),dungeon_consumed:[consumed],dungeon_extracted:[extracted]},carried_dungeon_ids:[extracted]}};
 assert.equal((await f.apply('end',end)).status,'Applied');
 const next=await f.apply('next',admit('p3','18446744073709551615'));assert.equal(next.status,'Applied');assert.ok(!ids(next).includes(consumed));assert.ok(!ids(next).includes(extracted));
 const s=await f.view('snapshot');assert.equal(s.items.find((i:any)=>i.id===consumed).location.kind,'consumed');assert.equal(s.items.find((i:any)=>i.id===extracted).location.kind,'owned');
 }finally{await f.sandbox.tearDown();}
});
test('random table validation and fixed/random funding isolation reject atomically',{timeout:120000},async()=>{
 const f=await fixture();try{
 const base=terms(Number(await f.view('clock_ms')));
 const action={type:'publish_random',terms:{...base,sockets:[base.sockets[0],{...base.sockets[1],reward:null}]},fee:'0',fixed_funding:['maker-sword-0'],random_tables:[{table_id:'loot',socket_ids:['tonic-a'],item_ids:['maker-tonic-0']}]};
 const before=await f.view('snapshot');
 for(const [i,a] of [
 {...action,random_tables:[{...action.random_tables[0],item_ids:['maker-sword-0']}]},
 {...action,fixed_funding:[],random_tables:[{...action.random_tables[0],item_ids:['maker-sword-0','maker-tonic-0']}]},
 {...action,random_tables:[{...action.random_tables[0],socket_ids:['sword']}]},
 {...action,random_tables:[{...action.random_tables[0],socket_ids:['missing']}]},
 {...action,random_tables:[{...action.random_tables[0],item_ids:['buyer-club']}]},
 {...action,random_tables:[action.random_tables[0],action.random_tables[0]]},
 {...action,terms:{...action.terms,no_reward:true}},
 ].entries()){assert.equal((await f.apply(`bad-${i}`,{actor:'maker',action:a})).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);}
 assert.equal((await f.apply('good',{actor:'maker',action})).status,'Applied');
 const r=await f.apply('admit',admit('buyer'));assert.equal(r.status,'Applied');assert.deepEqual(r.run.assignments.map((a:any)=>a.source_pool),['fixed:"sword"','random:loot']);
 }finally{await f.sandbox.tearDown();}
});
