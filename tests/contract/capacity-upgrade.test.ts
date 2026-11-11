import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture,terms} from './helpers';

// State written by the pre-capacity contract (lifetime caps, ids numbered by map length) loads in place with no
// migration call; bounded storage starts lazily and never reuses an old id.
test('pre-capacity state upgrades in place: snapshot unchanged, old receipts replay, ids never reused',{timeout:300000},async()=>{
 const f=await fixture('tests/fixtures/economy-pre-capacity.wasm');try{
  const list0=await f.apply('old-list-0',{actor:'maker',action:{type:'list',item_ids:['maker-tonic-0'],unit_price:'3'}});assert.equal(list0.result,'listing-0');
  await f.apply('old-cancel-0',{actor:'maker',action:{type:'cancel_listing',listing_id:'listing-0'}});
  assert.equal((await f.apply('old-list-1',{actor:'maker',action:{type:'list',item_ids:['maker-tonic-1'],unit_price:'3'}})).result,'listing-1');
  // Commission escrow is outside the helper audit, so orders are posted and cancelled back to back with plain calls.
  for(const n of [0,1]){
   assert.equal((await f.call('execute',{op_id:`old-order-${n}`,command:{actor:'p2',action:{type:'post_commission',item_type:'club',unit_price:'1',quantity:1}}})).result,`commission-${n}`);
   assert.equal((await f.call('execute',{op_id:`old-order-${n}-cancel`,command:{actor:'p2',action:{type:'cancel_commission',commission_id:`commission-${n}`}}})).status,'Applied');
  }
  const pub=await f.apply('old-pub',{actor:'maker',action:{type:'publish',terms:terms(Date.now()),fee:'3',funding:['maker-sword-0','maker-tonic-2','maker-tonic-3']}});
  const admit=await f.apply('old-enter',{actor:'buyer',action:{type:'admit',edition_id:pub.result,expected_version:'1',expected_fee:'3',loadout_ids:['buyer-club'],seed:'0'}});
  const before=await f.view('snapshot');
  await f.account.deployContract(readFileSync('contracts/economy/target/wasm32-unknown-unknown/release/dungeon_economy.wasm'));
  assert.deepEqual(await f.view('snapshot'),before,'no migration and no change to any record');
  assert.deepEqual(await f.view('operation',{op_id:'old-enter'}),admit,'old full receipts are still served');
  assert.deepEqual(await f.call('execute',{op_id:'old-list-0',command:{actor:'maker',action:{type:'list',item_ids:['maker-tonic-0'],unit_price:'3'}}}),list0,'and still refuse to execute twice');
  const cap=await f.view('capacity');assert.equal(cap.receipts.recent_receipts,9);assert.equal(cap.receipts.tombstones,'0');assert.equal(cap.receipts.recent_capacity,256);
  // The active run from before the upgrade settles normally, and new ids continue past every old one.
  const partition={town_consumed:[],town_returned:['buyer-club'],town_forfeited:[],dungeon_consumed:[],dungeon_extracted:[],dungeon_returned:['maker-sword-0','maker-tonic-2','maker-tonic-3']};
  assert.equal((await f.apply('new-leave',{actor:'buyer',action:{type:'void',run_id:admit.result,reason:'upgrade test',disposition:partition}})).status,'Applied');
  assert.equal((await f.apply('new-list',{actor:'maker',action:{type:'list',item_ids:['maker-tonic-4'],unit_price:'3'}})).result,'listing-2');
  assert.equal((await f.call('execute',{op_id:'new-order',command:{actor:'p2',action:{type:'post_commission',item_type:'club',unit_price:'1',quantity:1}}})).result,'commission-2');
  assert.equal((await f.call('execute',{op_id:'new-order-cancel',command:{actor:'p2',action:{type:'cancel_commission',commission_id:'commission-2'}}})).status,'Applied');
  assert.equal((await f.apply('new-enter',{actor:'buyer',action:{type:'admit',edition_id:pub.result,expected_version:'1',expected_fee:'3',loadout_ids:['buyer-club'],seed:'1'}})).result,'run-1');
 }finally{await f.sandbox.tearDown();}
});
