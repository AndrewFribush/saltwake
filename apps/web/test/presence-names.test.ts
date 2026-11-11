import test from 'node:test';
import assert from 'node:assert/strict';
import {playerLabel,sellerIs} from '../src/presence-names';

test('presence labels: demo profiles get character names, wallet accounts are shown and truncated',()=>{
 assert.equal(playerLabel('buyer'),'The delver');
 assert.equal(playerLabel('alice.testnet'),'alice.testnet');
 assert.equal(playerLabel('a-very-long-account-name.testnet'),'a-very-long-account…');
});

test('trade partner listings match demo profiles and wallet profiles, nothing looser',()=>{
 assert.equal(sellerIs('maker','maker'),true);
 assert.equal(sellerIs('wallet:alice.testnet','alice.testnet'),true);
 assert.equal(sellerIs('wallet:alice.testnet','wallet:alice.testnet'),true);
 assert.equal(sellerIs('maker2','maker'),false);
 assert.equal(sellerIs('wallet:bob.testnet','alice.testnet'),false);
});
