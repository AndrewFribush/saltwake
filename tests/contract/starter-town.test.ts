import {test} from 'node:test';import assert from 'node:assert/strict';
import {extendedFixture} from './extended-fixture';
import {starterTownCommands} from '../../packages/shared/src/starter-town';
import {availability} from '../../apps/server/src/availability';
test('starter town spends existing maker stock and funds two playable openings and finite shops',{timeout:60000},async()=>{
 const f=await extendedFixture();try{const before=await f.view();const now=Number(await f.view('clock_ms'));for(const {id,command} of starterTownCommands(now)){assert.equal((await f.apply(id,command)).status,'Applied');}
 const s=await f.view();assert.equal(s.items.length,before.items.length);assert.equal(s.credits.maker,'89');assert.equal(s.bank,'11');assert.equal(s.editions[0].terms.rules_version,2);assert.equal(availability(s.editions[0],s.items,now).bundles,2);assert.equal(s.listings.length,2);
 const replay=await f.view();for(const {id,command} of starterTownCommands(now))await f.apply(id,command);assert.deepEqual(await f.view(),replay);
 }finally{await f.close();}
});
