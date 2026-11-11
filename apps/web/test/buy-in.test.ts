import test from 'node:test';
import assert from 'node:assert/strict';
import {buyInTransaction,isExactBuyIn,nearLabel,COIN_PRICE_YOCTO} from '../../../packages/shared/src/buy-in';
import {pickTestSignerKey} from '../test-signer-plugin';

test('buy-in transactions carry exactly coins × price and nothing else', () => {
 const tx=buyInTransaction('game.testnet','buy-1',10);
 assert.equal(tx.deposit,(10n*COIN_PRICE_YOCTO).toString());assert.equal(nearLabel(tx.deposit),'0.1 NEAR');
 assert.ok(isExactBuyIn(tx,'game.testnet'));
 assert.equal(isExactBuyIn(tx,'other.testnet'),false,'wrong contract');
 assert.equal(isExactBuyIn({...tx,deposit:(11n*COIN_PRICE_YOCTO).toString()},'game.testnet'),false,'overpay');
 assert.equal(isExactBuyIn({...tx,deposit:'0'},'game.testnet'),false,'underpay');
 assert.equal(isExactBuyIn({...tx,methodName:'execute_player'},'game.testnet'),false,'deposit on another method');
 assert.equal(isExactBuyIn({...tx,args:{...tx.args,extra:1}},'game.testnet'),false,'extra args');
 assert.equal(isExactBuyIn({...tx,args:{...tx.args,expected_coins:'1001'},deposit:(1001n*COIN_PRICE_YOCTO).toString()},'game.testnet'),false,'over limit');
 assert.throws(()=>buyInTransaction('game.testnet','buy-1',0));assert.throws(()=>buyInTransaction('game.testnet','bad id',5));
 assert.equal(nearLabel(COIN_PRICE_YOCTO),'0.01 NEAR');assert.ok(pickTestSignerKey);
});
