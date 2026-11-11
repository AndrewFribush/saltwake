import test from 'node:test';
import assert from 'node:assert/strict';
import {pickTestSignerKey} from '../test-signer-plugin';
const keys=[{accountId:'a.testnet',privateKey:'x'},{accountId:'b.testnet',privateKey:'y'}];
test('dev test signer defaults to the first key',()=>{
 assert.equal(pickTestSignerKey(keys,undefined)?.accountId,'a.testnet');
 assert.equal(pickTestSignerKey(keys,'')?.accountId,'a.testnet');
});
test('dev test signer picks a configured account and refuses others',()=>{
 assert.equal(pickTestSignerKey(keys,'b.testnet')?.accountId,'b.testnet');
 assert.equal(pickTestSignerKey(keys,'c.testnet'),null);
 assert.equal(pickTestSignerKey(keys,['a.testnet','b.testnet']),null);
 assert.equal(pickTestSignerKey([],undefined),null);
});
