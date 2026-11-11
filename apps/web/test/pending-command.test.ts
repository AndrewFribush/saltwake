import test from 'node:test';
import assert from 'node:assert/strict';
import {resumablePending,WALLET_RETRY_MS} from '../src/pending-command';

test('saved wallet requests are resent only within 12 hours; older or undated ones are dropped',()=>{
 const now=1_000_000_000,saved=(at?:number)=>JSON.stringify({id:'r1',action:{type:'buy'},...(at===undefined?{}:{at})});
 assert.deepEqual(resumablePending(null,true,now),{pending:null,dropped:false});
 assert.equal(resumablePending(saved(now-WALLET_RETRY_MS),true,now).pending?.id,'r1');
 assert.deepEqual(resumablePending(saved(now-WALLET_RETRY_MS-1),true,now),{pending:null,dropped:true});
 assert.deepEqual(resumablePending(saved(),true,now),{pending:null,dropped:true},'requests saved before the guard existed are not resent');
 assert.deepEqual(resumablePending('{broken',true,now),{pending:null,dropped:true});
 // Local demo requests go through the server outbox, which applies its own signing cutoff.
 assert.equal(resumablePending(saved(),false,now).pending?.id,'r1');
});
