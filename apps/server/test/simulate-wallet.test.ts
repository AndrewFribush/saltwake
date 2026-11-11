import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync,rmSync} from 'node:fs';
test('npm run simulate:wallet: wallet-signed bots for a day, coins conserved apart from labelled NEAR buy-ins',{timeout:300000},()=>{
 const out=execFileSync('npx',['tsx','scripts/simulate-wallet.ts','--days','1'],{encoding:'utf8',timeout:280000});
 assert.match(out,/opened Wallet warren/);assert.match(out,/Day 1: .*issued 100 .*drift 0/);assert.doesNotMatch(out,/CONSERVATION FAILURE/);
 const path=out.match(/History: (\S+)/)![1];const h=JSON.parse(readFileSync(path,'utf8'));assert.ok(h.days[0].events.some((e:string)=>/wallet-signed admission/.test(e)));
 rmSync(path.replace(/\/town-history\.json$/,''),{recursive:true,force:true});
});
