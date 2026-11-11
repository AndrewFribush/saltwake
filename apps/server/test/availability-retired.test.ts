import test from 'node:test';
import assert from 'node:assert/strict';
import {availability} from '../src/availability';

test('a retired edition reports retiring while runs are inside, then retired; never open',()=>{
 const e:any={id:'e',closed:false,active_runs:['r1'],terms:{opens_at_ms:'0',closes_at_ms:'9999999999999',max_runs:4,sockets:[]},random_tables:[],original_value:'0',refresh_value:'0',extracted_value:'0',consumed_value:'0',banked_value:'0'};
 assert.equal(availability(e,[],1000).status,'open');
 assert.equal(availability(e,[],1000,true).status,'retiring');
 assert.equal(availability({...e,active_runs:[]},[],1000,true).status,'retired');
 assert.equal(availability({...e,closed:true},[],1000,true).status,'closed');
});
