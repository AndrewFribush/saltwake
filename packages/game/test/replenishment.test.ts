import test from 'node:test';
import assert from 'node:assert/strict';
import {randomPoolSelection,replenishmentAction} from '../../shared/src/replenishment';
import type {Item,Socket} from '../../shared/src/types';

const items:Item[]=[{id:'tonic',item_type:'tonic',location:{kind:'owned',profile:'maker'}},{id:'iron',item_type:'iron',location:{kind:'owned',profile:'maker'}}];
const edition={id:'edition',terms:{sockets:[{id:'fixed-reward',room:0,slot:0,enemy:'none',trap:false,reward:'tonic'} as Socket]},randomTables:['fixed','random:fixed'].map(table_id=>({table_id,socket_ids:[table_id],item_ids:[]}))};

test('fixed rewards and random pools named fixed and random:fixed produce distinct exact refresh targets',()=>{
 const selections=['fixed',...edition.randomTables.map(t=>randomPoolSelection(t.table_id))];
 assert.equal(new Set(selections).size,3);
 assert.deepEqual(replenishmentAction(edition,selections[0],['tonic'],items,'maker'),{type:'refresh',edition_id:'edition',fixed_funding:['tonic'],random_funding:[]});
 for(const [index,table] of edition.randomTables.entries()){
  // A fixed-compatible good must still go exclusively to the selected random pool.
  assert.deepEqual(replenishmentAction(edition,selections[index+1],['tonic'],items,'maker'),{type:'refresh',edition_id:'edition',fixed_funding:[],random_funding:[{table_id:table.table_id,item_ids:['tonic']}]});
 }
});

test('random-only editions can replenish either colliding name with goods outside fixed reward types',()=>{
 const randomOnly={...edition,terms:{sockets:[]}};
 assert.equal(replenishmentAction(randomOnly,'fixed',['iron'],items,'maker'),null);
 for(const table of edition.randomTables){
  const action=replenishmentAction(randomOnly,randomPoolSelection(table.table_id),['iron'],items,'maker');
  assert.deepEqual(action?.random_funding,[{table_id:table.table_id,item_ids:['iron']}]);
  assert.deepEqual(action?.fixed_funding,[]);
 }
});

test('invalid, stale or unowned selections cannot produce a refresh action',()=>{
 for(const selection of ['random:missing','random:','unencoded'])assert.equal(replenishmentAction(edition,selection,['tonic'],items,'maker'),null);
 assert.equal(replenishmentAction(edition,'fixed',['iron'],items,'maker'),null);
 for(const ids of [[],['missing'],['tonic','tonic'],Array(129).fill('tonic')])assert.equal(replenishmentAction(edition,randomPoolSelection('fixed'),ids,items,'maker'),null);
 assert.equal(replenishmentAction(edition,randomPoolSelection('fixed'),['tonic'],items,'buyer'),null);
 assert.equal(replenishmentAction({...edition,randomTables:[]},randomPoolSelection('fixed'),['tonic'],items,'maker'),null);
});
