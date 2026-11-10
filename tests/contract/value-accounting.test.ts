import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import {catalog} from '../../packages/shared/src/catalog';
import type {Command,EconomySnapshot,Partition} from '../../packages/shared/src/types';
const empty=():Partition=>({town_consumed:[],town_returned:[],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:[]});
test('edition reference values reconcile stock, reservations, extract, consume, refresh, void and closure exactly once',{timeout:120000},async()=>{
 const f=await fixture();try{
 const check=async(expected:{funding:string;stock:string;reserved:string;extracted:string;consumed:string;banked:string})=>{
  const s=await f.view('snapshot') as EconomySnapshot;const e=s.editions[0];
  const value=(items:typeof s.items)=>items.reduce((n,i)=>n+BigInt(catalog[i.item_type].value),0n);
  const stock=value(s.items.filter(i=>(i.location.kind==='edition_fixed'||i.location.kind==='edition_random')&&i.location.edition===e.id));
  const active=new Set(s.runs.filter(r=>r.edition===e.id&&r.status==='active').map(r=>r.id));
  const reserved=value(s.items.filter(i=>i.location.kind==='reserved'&&active.has(i.location.run)));
  assert.deepEqual({funding:String(BigInt(e.original_value)+BigInt(e.refresh_value)),stock:String(stock),reserved:String(reserved),extracted:e.extracted_value,consumed:e.consumed_value,banked:e.banked_value},expected);
  assert.equal(BigInt(e.original_value)+BigInt(e.refresh_value),stock+reserved+BigInt(e.extracted_value)+BigInt(e.consumed_value)+BigInt(e.banked_value));
  return s;
 };
 const apply=async(id:string,c:Command)=>{const r=await f.apply(id,c);assert.equal(r.status,'Applied',r.result);const before=await f.view('snapshot');assert.deepEqual(await f.apply(id,c),r);assert.deepEqual(await f.view('snapshot'),before);return r;};
 const base=terms(Number(await f.view('clock_ms')));
 const publish:Command={actor:'maker',action:{type:'publish_random',terms:{...base,sockets:base.sockets.map((s,i)=>({...s,reward:i===0?s.reward:null}))},fee:'0',fixed_funding:['maker-sword-0'],random_tables:[{table_id:'tonics',socket_ids:['tonic-a','tonic-b'],item_ids:['maker-tonic-0','maker-tonic-1','maker-tonic-2']}]}};
 await apply('publish',publish);
 await check({funding:'30',stock:'30',reserved:'0',extracted:'0',consumed:'0',banked:'0'});
 const admit=(actor:string,loadout_ids:string[]=[]):Command=>({actor,action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'0',loadout_ids,seed:'42'}});
 const first=await apply('first',admit('buyer'));
 await check({funding:'30',stock:'6',reserved:'24',extracted:'0',consumed:'0',banked:'0'});
 const tonicIds=(r:any):string[]=>r.run.assignments.filter((a:any)=>a.source_pool==='random:tonics').map((a:any)=>a.item_id);
 const [used,returned]=tonicIds(first);
 const extract:Command={actor:'buyer',action:{type:'settle',run_id:first.result,outcome:'extracted',carried_dungeon_ids:['maker-sword-0'],disposition:{...empty(),dungeon_extracted:['maker-sword-0'],dungeon_consumed:[used],dungeon_returned:[returned]}}};
 const before=await f.view('snapshot');
 assert.equal((await f.apply('bad-partition',{...extract,action:{...extract.action,type:'settle',run_id:first.result,outcome:'extracted',carried_dungeon_ids:['maker-sword-0'],disposition:{...empty(),dungeon_extracted:['maker-sword-0']}}})).status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);
 await apply('extract',extract);await check({funding:'30',stock:'12',reserved:'0',extracted:'12',consumed:'6',banked:'0'});
 const refresh=(sword:string,tonic:string):Command=>({actor:'maker',action:{type:'refresh',edition_id:'edition-0',fixed_funding:[sword],random_funding:[{table_id:'tonics',item_ids:[tonic]}]}});
 await apply('refresh',refresh('maker-sword-1','maker-tonic-3'));
 await check({funding:'48',stock:'30',reserved:'0',extracted:'12',consumed:'6',banked:'0'});
 // A bought town tonic consumed during void must not increase edition consumption.
 await apply('list-town-tonic',{actor:'maker',action:{type:'list',item_ids:['maker-tonic-5'],unit_price:'1'}});
 await apply('buy-town-tonic',{actor:'p2',action:{type:'buy',listing_id:'listing-0',item_ids:['maker-tonic-5'],expected_unit_price:'1'}});
 const second=await apply('second',admit('p2',['p2-club','maker-tonic-5']));const [voidUsed,voidReturned]=tonicIds(second);
 await check({funding:'48',stock:'6',reserved:'24',extracted:'12',consumed:'6',banked:'0'});
 const voidCommand:Command={actor:'p2',action:{type:'void',run_id:second.result,reason:'recover snapshot',disposition:{...empty(),town_consumed:['maker-tonic-5'],town_returned:['p2-club'],dungeon_consumed:[voidUsed],dungeon_returned:['maker-sword-1',voidReturned]}}};
 await apply('void',voidCommand);await check({funding:'48',stock:'24',reserved:'0',extracted:'12',consumed:'12',banked:'0'});
 // Previously extracted gear is town-origin now: its forfeiture must not be counted again.
 const third=await apply('third',admit('buyer',['maker-sword-0']));const [deathUsed,deathReturned]=tonicIds(third);
 const death:Command={actor:'buyer',action:{type:'settle',run_id:third.result,outcome:'died',carried_dungeon_ids:[],disposition:{...empty(),town_forfeited:['maker-sword-0'],dungeon_consumed:[deathUsed],dungeon_returned:['maker-sword-1',deathReturned]}}};
 await apply('death',death);await check({funding:'48',stock:'18',reserved:'0',extracted:'12',consumed:'18',banked:'0'});
 const settled=await f.view('snapshot');assert.equal((await f.apply('fresh-terminal',death)).result,'TerminalRun');assert.deepEqual(await f.view('snapshot'),settled);
 await apply('refresh-again',refresh('maker-sword-2','maker-tonic-4'));
 await check({funding:'66',stock:'36',reserved:'0',extracted:'12',consumed:'18',banked:'0'});
 const last=await apply('last',admit('p3'));await check({funding:'66',stock:'12',reserved:'24',extracted:'12',consumed:'18',banked:'0'});
 for(let n=0;n<10&&BigInt(await f.view('clock_ms'))<BigInt(base.closes_at_ms);n++){
  const response=await fetch(f.sandbox.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'advance',method:'sandbox_fast_forward',params:{delta_height:1000}}),signal:AbortSignal.timeout(30000)});assert.equal((await response.json()).error,undefined);
 }
 assert.ok(BigInt(await f.view('clock_ms'))>=BigInt(base.closes_at_ms));
 const close:Command={actor:'maker',action:{type:'finalize_close',edition_id:'edition-0'}};
 const active=await f.view('snapshot');assert.equal((await f.apply('premature-close',close)).result,'ActiveReservations');assert.deepEqual(await f.view('snapshot'),active);
 await apply('late-void',{actor:'p3',action:{type:'void',run_id:last.result,reason:'late cleanup',disposition:{...empty(),dungeon_returned:last.run.assignments.map((a:any)=>a.item_id)}}});
 await apply('close',close);const closed=await check({funding:'66',stock:'0',reserved:'0',extracted:'12',consumed:'18',banked:'36'});
 assert.equal(closed.editions[0].original_value,'30');assert.equal(closed.editions[0].refresh_value,'36');
 assert.equal((await f.apply('fresh-close',close)).result,'AlreadyClosed');assert.deepEqual(await f.view('snapshot'),closed);
 }finally{await f.sandbox.tearDown();}
});
