import test from 'node:test';import assert from 'node:assert/strict';
import {showcasePublication} from '../../../scripts/demo-town';
import {estimateDraft} from '../../../packages/game/src/draft-generator';
const treasure=[{floor:1,type:'fineTonic' as const},{floor:99,type:'sword' as const}];
test('showcase fits the proprietor budget with the current generator, three floors, two funded treasures',()=>{
 // The demo proprietor has about 50 coins when the showcase is published (12 are held back for the commission).
 for(const budget of [30,45]){
  const s=showcasePublication('The tide vaults',Date.now(),budget,treasure);assert.ok(s,`a seed fits ${budget} coins`);
  assert.ok(estimateDraft(s.draft).coins<=budget);assert.ok(s.terms.modules.length>=3);assert.equal(s.terms.no_reward,false);
  assert.deepEqual(s.terms.sockets.filter(x=>x.reward).map(x=>x.reward).sort(),['fineTonic','sword']);
  assert.ok(s.terms.sockets.some(x=>x.enemy!=='none'),'the showcase keeps at least one fight');
 }
});
test('an impossible budget returns null instead of throwing',()=>{assert.equal(showcasePublication('X',Date.now(),0,treasure),null);});
