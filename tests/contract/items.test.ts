import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import {catalog} from '../../packages/shared/src/catalog';
// Hash implementation is loaded only after contract methods exist, giving a real missing-method red check.
test('Rust protocol exposes exact catalog, costs and canonical command hash', {timeout:120000},async()=>{
 const f=await fixture();try{
 const rules=await f.view('rules');
 assert.deepEqual(rules.catalog,Object.entries(catalog).map(([item_type,i])=>({item_type,value:String(i.value),consumable:['tonic','fineTonic'].includes(item_type)})));
 const {commandHash}=await import('../../packages/shared/src/protocol');
 const commands=[{actor:'buyer',action:{type:'debit',amount:'9007199254740993'}},{actor:'maker',action:{type:'publish',terms:terms(Date.now()),fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}},{actor:'buyer',action:{type:'admit',edition_id:'edition-0',expected_version:'1',expected_fee:'3',loadout_ids:['buyer-club'],seed:'18446744073709551615'}}] as const;
 for(const command of commands){assert.equal(await f.view('command_hash',{command}),commandHash(command));assert.deepEqual(await f.view('roundtrip_command',{command}),command);}
 const partition={town_consumed:[],town_returned:['buyer-club'],town_forfeited:[],dungeon_consumed:['x'],dungeon_extracted:['y'],dungeon_returned:['z']};
 for(const action of [{type:'settle',run_id:'run-0',outcome:'extracted',disposition:partition,carried_dungeon_ids:['y']},{type:'void',run_id:'run-0',reason:'café 💀',disposition:partition},{type:'finalize_close',edition_id:'edition-0'}] as const){const command={actor:'buyer',action};assert.equal(await f.view('command_hash',{command}),commandHash(command));assert.deepEqual(await f.view('roundtrip_command',{command}),command);}
 assert.throws(()=>commandHash({actor:'buyer',action:{type:'debit',amount:'01'}}));assert.throws(()=>commandHash({actor:'buyer',action:{type:'debit',amount:'18446744073709551616'}}));
 for(const t of [{...terms(Date.now()),title:'Le trésor 💎',sockets:[{...terms(Date.now()).sockets[0],reward:null}],no_reward:true},{...terms(Date.now()),sockets:[],no_reward:true}]){const command={actor:'maker',action:{type:'publish' as const,terms:t,fee:'0',funding:[]}};assert.equal(await f.view('command_hash',{command}),commandHash(command));}
 const {placementCosts,runDurationMs,maxRunsPerEdition}=await import('../../packages/shared/src/rules');assert.deepEqual(rules.costs,placementCosts);assert.equal(rules.run_duration_ms,String(runDurationMs));assert.equal(rules.max_runs,maxRunsPerEdition);
 const state=await f.view('snapshot');assert.equal(new Set(state.items.map((i:any)=>i.id)).size,state.items.length);assert.ok(state.items.every((i:any)=>i.location.kind==='owned'));
 }finally{await f.sandbox.tearDown();}
});
