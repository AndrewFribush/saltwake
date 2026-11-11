const pg=await openTab('http://127.0.0.1:18930');await snapshot(pg);
await pg.getByRole('button',{name:'Session',exact:true}).click();await pg.locator('.purse-drawer select').selectOption('maker');await pg.getByRole('button',{name:'Close session',exact:true}).click();await pg.getByRole('button',{name:'Build here',exact:true}).click();
for(const [width,height] of [[1366,768],[390,844]]){
 await pg._sendToTarget('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await sleep(200);
 const result=await pg.evaluate(()=>({scroll:document.documentElement.scrollHeight>innerHeight,offscreen:[...document.querySelectorAll('.builder-studio button,.builder-studio select,.builder-studio input')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.top<0||r.left<0||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>e.textContent||e.getAttribute('aria-label'))}));
 console.log('PLACEMENT_FIT='+JSON.stringify({width,height,...result}));if(result.scroll||result.offscreen.length)throw Error('Placement controls overflow');
}
await pg.getByRole('button',{name:'Close builder',exact:true}).click();await closeTab(pg);console.log('GSTACK_STEP_OK');
