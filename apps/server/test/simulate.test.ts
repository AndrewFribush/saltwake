import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync,rmSync} from 'node:fs';
test('npm run simulate: two simulated days through the real API and contract, coins conserved, history written',{timeout:300000},()=>{
 const out=execFileSync('npx',['tsx','scripts/simulate.ts','--days','2','--exit-when-done'],{encoding:'utf8',timeout:280000});
 assert.match(out,/Day 1: .*drift 0/);assert.match(out,/Day 2: .*drift 0/);assert.doesNotMatch(out,/CONSERVATION FAILURE/);
 const path=out.match(/History: (\S+)/)![1];const h=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(h.label,'SIMULATION');assert.equal(h.days.length,2);assert.ok(h.days.every((d:any)=>d.conservationDrift===0&&d.events.length>0));
 assert.ok(h.days.reduce((n:number,d:any)=>n+d.runs.extracted+d.runs.died+d.runs.abandoned,0)>0,'delvers played');
 rmSync(path.replace(/\/town-history\.json$/,''),{recursive:true,force:true});
});
