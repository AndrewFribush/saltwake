const pg=await openTab('http://127.0.0.1:18930');
await snapshot(pg);
await pg.getByRole('button',{name:'Session',exact:true}).click();
await pg.locator('.purse-drawer select').selectOption('p4');
await pg.getByRole('button',{name:'Close session',exact:true}).click();
const before=await pg.evaluate(async()=>{const w=await fetch('/api/world').then(r=>r.json());return w.items.map(i=>i.id);});
await pg.getByRole('button',{name:'Visit The old catacombs',exact:true}).click();
await pg.getByRole('button',{name:'Gatewarden · expeditions',exact:true}).waitFor({state:'visible',timeout:15000});
await pg.getByRole('button',{name:'Gatewarden · expeditions',exact:true}).click();
await pg.locator('.gate-warning').waitFor({state:'visible',timeout:15000});
if(!(await pg.locator('.gate-warning').innerText()).includes('unarmed (1 damage)'))throw Error('Missing unarmed warning');
for(let i=0;!(await pg.locator('.expedition-offer').innerText()).includes('Verification fixture · random pool');i++){
 if(i>10)throw Error('Fixture not offered');
 await pg.locator('nav[aria-label="Dungeon openings"] button:last-child').click();
}
await pg.getByRole('button',{name:'Pay 0 coins & descend',exact:true}).click();
await pg.locator('.retreat summary').waitFor({state:'visible',timeout:20000});
const admitted=await pg.evaluate(async()=>{const w=await fetch('/api/world').then(r=>r.json());const r=w.runs.find(r=>!r.terminal);return {id:r.id,weapon:r.state.player.weapon,stored:w.items.map(i=>i.id)};});
if(admitted.weapon!=='unarmed'||JSON.stringify(before)!==JSON.stringify(admitted.stored))throw Error('Incorrect empty-loadout admission');
await pg.locator('.retreat summary').click();
await pg.getByRole('button',{name:'Abandon and forfeit gear',exact:true}).click();
await pg.getByRole('button',{name:'Return to Saltwake',exact:true}).waitFor({state:'visible',timeout:20000});
await pg.getByRole('button',{name:'Return to Saltwake',exact:true}).click();
const after=await pg.evaluate(async()=>{const w=await fetch('/api/world').then(r=>r.json());return {stored:w.items.map(i=>i.id),runs:w.runs.map(r=>({id:r.id,terminal:r.terminal,settlement:r.settlement?.status}))};});
if(JSON.stringify(before)!==JSON.stringify(after.stored))throw Error('Unpacked equipment lost');
console.log('UNARMED_ADMISSION='+JSON.stringify({before,admitted,after}));
await closeTab(pg);console.log('GSTACK_STEP_OK');
