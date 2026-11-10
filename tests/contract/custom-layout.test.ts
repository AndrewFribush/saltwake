import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,terms} from './helpers';
import {encodeCustomModule} from '../../packages/shared/src/custom-layout';
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
