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
import {economyProfile} from '../src/presence-names';
test('private offers address the partner by their economy profile',()=>{
 assert.equal(economyProfile('wallet:alice.testnet','bob.testnet'),'wallet:bob.testnet');
 assert.equal(economyProfile('buyer','maker'),'maker');
 assert.equal(economyProfile('wallet:alice.testnet','wallet:bob.testnet'),'wallet:bob.testnet');
});
import {filtered,hidden} from '../src/chat-safety';
test('chat safety: the word filter masks listed words only when on; muted and blocked players are hidden',()=>{
 assert.equal(filtered('what the hell, idiots!',true),'what the ••••, ••••••!');assert.equal(filtered('what the hell',false),'what the hell');assert.equal(filtered('shellfish hello',true),'shellfish hello');
 const s={muted:['a'],blocked:['b'],filter:true};assert.ok(hidden(s,'a')&&hidden(s,'b')&&!hidden(s,'c'));
});
