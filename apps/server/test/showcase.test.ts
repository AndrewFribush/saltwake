import test from 'node:test';import assert from 'node:assert/strict';
import {showcasePublication} from '../../../scripts/demo-town';
import {estimateDraft} from '../../../packages/game/src/draft-generator';
const treasure=[{floor:1,type:'herb' as const},{floor:99,type:'fineTonic' as const}];
test('showcase fits the proprietor budget with the current generator, three floors, herb and fine tonic treasures',()=>{
 // The demo proprietor has about 50 coins when the showcase is published (12 are held back for the commission).
 for(const budget of [30,45]){
  const s=showcasePublication('The tide vaults',Date.now(),budget,treasure);assert.ok(s,`a seed fits ${budget} coins`);
  assert.ok(estimateDraft(s.draft).coins<=budget);assert.ok(s.terms.modules.length>=3);assert.equal(s.terms.no_reward,false);
  assert.deepEqual(s.terms.sockets.filter(x=>x.reward).map(x=>x.reward).sort(),['fineTonic','herb']);
  assert.ok(s.terms.sockets.some(x=>x.enemy!=='none'),'the showcase keeps at least one fight');
 }
});
test('an impossible budget returns null instead of throwing',()=>{assert.equal(showcasePublication('X',Date.now(),0,treasure),null);});
test('the showcase ramps up: a newcomer with the starting club and a tonic can escape with treasure',async()=>{
 const {SHOWCASE_RAMP}=await import('../../../scripts/demo-town');const {choose}=await import('../../../scripts/depth-sim');
 const {creatorRehearsal}=await import('../../../packages/game/src/authored-layout');const {act}=await import('../../../packages/game/src/actions');
 const s=showcasePublication('The tide vaults',Date.now(),45,treasure)!;
 s.draft.placements.forEach((ps,floor)=>assert.ok(ps.reduce((n,p)=>n+Number(p.enemy!=='none')+Number(p.trap),0)<=SHOWCASE_RAMP(floor),`floor ${floor+1} is within the ramp`));
 let run=creatorRehearsal(s.draft.floors,s.draft.placements,'club','tonic');let ft=0,room=0;
 for(let i=0;i<800&&run.status==='active';i++){let n=act(run,choose(run,'cautious',ft));if(n===run)n=act(run,{type:'wait'});run=n;if(run.roomIndex!==room){room=run.roomIndex;ft=0;}else ft++;}
 assert.equal(run.status,'extracted');
 assert.ok(Object.values(run.items).some(i=>i.origin==='dungeon'&&['bag','weapon','armor'].includes(i.location.kind)),'escaped carrying a funded find');
});
test('demo publications use the rules version and module format the draft needs (keys/plates publish as v13)',async()=>{
 const {presetPublication,SHOWCASE_SEEDS}=await import('../../../scripts/demo-town');const {requiredRulesVersion}=await import('../../../packages/shared/src/depth-components');
 for(const seed of SHOWCASE_SEEDS){const s=showcasePublication('X',Date.now(),45,treasure,[seed]);if(s)assert.equal(s.terms.rules_version,requiredRulesVersion(s.draft.floors,s.draft.placements.flat().map(p=>p.enemy)));}
 for(const preset of ['small','medium','large'] as const)for(const seed of [3,11,23]){const p=presetPublication(seed,preset,'X',Date.now());assert.ok(p.terms.rules_version>=11);}
});
