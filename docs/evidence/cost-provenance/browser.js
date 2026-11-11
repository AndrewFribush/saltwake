const pg=await openTab('http://127.0.0.1:18930');await snapshot(pg);
await pg.getByRole('button',{name:'Open wallet and receipts',exact:true}).click();await pg.locator('.game-wallet select').selectOption('Stock costs');
console.log('COST_REPORT='+await pg.locator('.game-wallet').innerText());
for(const [width,height] of [[1366,768],[390,844]]){
 await pg._sendToTarget('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await sleep(200);
 for(const view of ['Stock costs','Trading result','Cost rules']){await pg.locator('.game-wallet select').selectOption(view);
 const fit=await pg.evaluate(()=>({scroll:document.documentElement.scrollHeight>innerHeight,offscreen:[...document.querySelectorAll('.game-wallet button,.game-wallet select,.game-wallet summary')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>e.textContent)}));console.log('FIT='+JSON.stringify({width,height,view,...fit}));if(fit.scroll||fit.offscreen.length)throw Error('Cash flow window overflow');}
}
await pg.getByRole('button',{name:'Close purse',exact:true}).click();await closeTab(pg);console.log('GSTACK_STEP_OK');
