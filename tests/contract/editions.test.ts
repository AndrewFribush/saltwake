import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
test('funded publication locks exact stock, charges pinned cost once; bad funding has no effects',{timeout:120000},async()=>{
 const f=await fixture();try{
 const t=terms(Date.now());const publish={actor:'maker',action:{type:'publish',terms:t,fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}};
 const before=await f.view('snapshot');
 const bad=await f.apply('bad-stock',{...publish,action:{...publish.action,funding:['buyer-club']}});assert.equal(bad.status,'Rejected');assert.deepEqual(await f.view('snapshot'),before);
 assert.deepEqual(await f.apply('bad-stock',{...publish,action:{...publish.action,funding:['buyer-club']}}),bad);
 const r=await f.apply('publish',publish);assert.equal(r.status,'Applied');assert.equal(r.result,'edition-0');assert.deepEqual(await f.apply('publish',publish),r);
 const after=await f.view('snapshot');assert.equal(after.credits.maker,'89');assert.equal(after.bank,'11');assert.equal(after.editions[0].original_value,'24');
 assert.equal(after.items.filter((i:any)=>i.location.kind==='edition_fixed').length,3);
 const locked=await f.apply('double-fund',publish);assert.equal(locked.status,'Rejected');assert.deepEqual(await f.view('snapshot'),after);
 }finally{await f.sandbox.tearDown();}
});
test('explicit no-reward editions publish; invalid terms and incomplete bundles reject',{timeout:120000},async()=>{
 const f=await fixture();try{
 const t=terms(Date.now());const before=await f.view('snapshot');
 for(const [id,terms_,funding] of [
  ['past',{...t,closes_at_ms:'1'},[]],['room',{...t,modules:['unknown','gauntlet']},[]],
  ['slot',{...t,sockets:[{...t.sockets[0],slot:99}]},[]],['partial',t,['maker-sword-0','maker-tonic-0']],
  ['duplicate',t,['maker-sword-0','maker-tonic-0','maker-tonic-0']],
  ['hidden-zero',{...t,sockets:[]},[]],['duration',{...t,run_duration_ms:'1'},[]],['cap',{...t,max_runs:5},[]]
 ] as const){const r=await f.apply(id,{actor:'maker',action:{type:'publish',terms:terms_,fee:'3',funding}});assert.equal(r.status,'Rejected',id);assert.deepEqual(await f.view('snapshot'),before);}
 const r=await f.apply('zero',{actor:'maker',action:{type:'publish',terms:{...t,sockets:[],no_reward:true},fee:'1',funding:[]}});assert.equal(r.status,'Applied');assert.equal((await f.view('snapshot')).bank,'2');
 await assert.rejects(()=>f.outsider.callFunction({contractId:f.contractId,methodName:'execute',args:{op_id:'intruder',command:{actor:'buyer',action:{type:'debit',amount:'1'}}},gas:100_000_000_000_000n}));
 }finally{await f.sandbox.tearDown();}
});

test('v2 accepts bounded seeded rules with unchanged module IDs and exact funding; unknown versions reject',{timeout:120000},async()=>{
 const f=await fixture();try{
  const t={...terms(Date.now()),rules_version:2};
  const before=await f.view('snapshot');
  for(const [id,patch] of [['version',{rules_version:3}],['module',{modules:['seeded','gauntlet']}],['short',{modules:['cellar']}],['long',{modules:Array(5).fill('cellar')}],['socket',{sockets:[{...t.sockets[0],slot:4}]}]] as const){
   const r=await f.apply('v2-invalid-'+id,{actor:'maker',action:{type:'publish',terms:{...t,...patch},fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});
   assert.equal(r.status,'Rejected',id);assert.deepEqual(await f.view('snapshot'),before);
  }
  const published=await f.apply('v2-publish',{actor:'maker',action:{type:'publish',terms:t,fee:'3',funding:['maker-sword-0','maker-tonic-0','maker-tonic-1']}});
  assert.equal(published.status,'Applied');
  const snapshot=await f.view('snapshot');assert.equal(snapshot.editions[0].terms.rules_version,2);assert.equal(snapshot.bank,'11');
  const admitted=await f.apply('v2-admit',{actor:'buyer',action:{type:'admit',edition_id:published.result,expected_version:'1',expected_fee:'3',loadout_ids:['buyer-club'],seed:'18446744073709551615'}});
  assert.equal(admitted.status,'Applied');assert.equal(admitted.run.seed,'18446744073709551615');
  assert.deepEqual(admitted.run.assignments.map((a:any)=>a.item_id).sort(),['maker-sword-0','maker-tonic-0','maker-tonic-1']);
  assert.deepEqual(admitted.run.loadout_ids,['buyer-club']);
 }finally{await f.sandbox.tearDown();}
});
