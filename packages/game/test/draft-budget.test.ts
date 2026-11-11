import test from 'node:test';import assert from 'node:assert/strict';
import {fitBudgetOrThin,thinDraftToCoins} from '../src/draft-budget';
import {estimateDraft,generateDraft,generatorPresets} from '../src/draft-generator';
test('6 and 10 coins always yield an openable draft (fewer coins usually), keeping one fight',()=>{
 for(const [coins,goods] of [[10,1],[6,1],[5,0],[4,0]] as const)for(const seed of [1,2,3,17,99]){
  const fit=fitBudgetOrThin(seed,coins,goods);if(coins<6&&!fit)continue; // some layouts carry a cracked wall that cannot go
  assert.ok(fit,`seed ${seed} fits ${coins} coins`);const e=estimateDraft(fit.draft);
  assert.ok(e.coins<=coins&&e.goods<=goods);assert.ok(fit.draft.placements.flat().some(p=>p.enemy!=='none'));
 }
 assert.equal(fitBudgetOrThin(1,3,0),null);
});
test('thinning keeps geometry and does not mutate the input',()=>{
 const d=generateDraft(5,{...generatorPresets.small.options,treasure:false});const before=JSON.stringify(d);
 const t=thinDraftToCoins(d,5)!;assert.equal(JSON.stringify(d),before);assert.deepEqual(t.floors.map(f=>f.tiles),d.floors.map(f=>f.tiles));
});
