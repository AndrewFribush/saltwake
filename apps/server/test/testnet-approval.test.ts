import test from 'node:test';import assert from 'node:assert/strict';
import {checkTestnetApproval,TESTNET_MAX_TRANSACTIONS} from '../src/testnet-approval';
const config={rpcUrl:'https://test.rpc.fastnear.com',accountId:'saltwake.testnet',epoch:'testnet-x'};
const now=Date.parse('2026-11-11T00:00:00Z');
const approval={approvedBy:'Andrew',accountId:config.accountId,rpcUrl:config.rpcUrl,wasmSha256:'a'.repeat(64),maximumTransactions:3000,expiresAt:'2026-11-16T12:00:00Z'};
test('testnet approval accepts a multi-day budget and keeps exact destination checks',()=>{
 assert.deepEqual(checkTestnetApproval(config,approval,now),{limit:3000,expiresAt:Date.parse(approval.expiresAt),budgetId:'saltwake.testnet:2026-11-16T12:00:00Z'});
 const bad:[string,object,object][]=[
  ['mainnet rpc',{rpcUrl:'https://rpc.mainnet.near.org'},{rpcUrl:'https://rpc.mainnet.near.org'}],
  ['mainnet account',{accountId:'saltwake.near'},{accountId:'saltwake.near'}],
  ['account mismatch',{},{accountId:'other.testnet'}],
  ['rpc mismatch',{},{rpcUrl:'https://rpc.testnet.near.org'}],
  ['too many tx',{},{maximumTransactions:TESTNET_MAX_TRANSACTIONS+1}],
  ['expired',{},{expiresAt:'2026-11-10T00:00:00Z'}],
  ['too late',{},{expiresAt:'2026-11-26T00:00:01Z'}],
  ['approver',{},{approvedBy:'someone'}],
  ['hash',{},{wasmSha256:'nope'}],
 ];
 for(const [name,c,a] of bad)assert.throws(()=>checkTestnetApproval({...config,...c},{...approval,...a},now),/Testnet approval rejected/,name);
});
