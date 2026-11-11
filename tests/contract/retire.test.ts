import test from 'node:test';
import assert from 'node:assert/strict';
import {extendedFixture} from './extended-fixture';
import {terms} from './helpers';

test('a maker retires an edition: no new admissions, active runs finish, closure allowed early, terms unchanged',{timeout:240000},async()=>{
 const f=await extendedFixture();
 try{
  const now=Number(await f.view('clock_ms'));
  const t={...terms(now),sockets:[],no_reward:true,closes_at_ms:String(now+3_600_000)};
  assert.equal((await f.apply('pub',{actor:'maker',action:{type:'publish',terms:t,fee:'1',funding:[]}})).status,'Applied');
  let s=await f.view();const e=s.editions.find((x:any)=>x.maker==='maker'&&x.terms.title===t.title);const before=structuredClone(e.terms);
  assert.deepEqual(s.retired_editions,[]);
  assert.equal((await f.apply('in',{actor:'buyer',action:{type:'admit',edition_id:e.id,expected_version:e.version,expected_fee:'1',loadout_ids:[],seed:'0'}})).status,'Applied');
  assert.equal((await f.apply('not-yours',{actor:'buyer',action:{type:'retire',edition_id:e.id}})).result,'WrongMaker');
  assert.equal((await f.apply('retire',{actor:'maker',action:{type:'retire',edition_id:e.id}})).status,'Applied');
  assert.equal((await f.apply('retire-again',{actor:'maker',action:{type:'retire',edition_id:e.id}})).result,'AlreadyRetired');
  s=await f.view();assert.deepEqual(s.retired_editions,[e.id]);assert.deepEqual(s.editions.find((x:any)=>x.id===e.id).terms,before,'terms stay immutable');
  assert.equal((await f.apply('late',{actor:'p2',action:{type:'admit',edition_id:e.id,expected_version:e.version,expected_fee:'1',loadout_ids:[],seed:'0'}})).result,'EditionRetired');
  assert.equal((await f.apply('close-early',{actor:'maker',action:{type:'finalize_close',edition_id:e.id}})).result,'ActiveReservations','the active run must settle first');
 }finally{await f.close();}
});
