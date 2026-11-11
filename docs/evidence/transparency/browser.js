const pg=await openTab('http://127.0.0.1:18930');await snapshot(pg);
await pg.evaluate(()=>{window.__errs=[];window.addEventListener('error',e=>window.__errs.push(e.message));});
await pg.getByRole('button',{name:'Visit The old catacombs',exact:true}).click();await pg.getByRole('button',{name:'Gatewarden · expeditions',exact:true}).waitFor({state:'visible',timeout:15000});await pg.getByRole('button',{name:'Gatewarden · expeditions',exact:true}).click();await snapshot(pg);
await pg.getByRole('combobox',{name:'Service view',exact:true}).waitFor({state:'visible',timeout:15000});
await pg.getByRole('combobox',{name:'Service view',exact:true}).selectOption({label:'Track records'});
for(let i=0;i<4;i++){
 for(const [width,height] of [[1366,768],[390,844]]){
  await pg._sendToTarget('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const result=await pg.evaluate(()=>{
   const panel=document.querySelector('.desk-slot:not([hidden]) section[aria-label="Dungeon track record"]');const r=panel.getBoundingClientRect();
   const board=document.querySelector('.room-board').getBoundingClientRect();
   return {text:panel.innerText,outside:r.bottom>innerHeight||r.right>innerWidth,scroll:document.documentElement.scrollHeight>innerHeight,board:[board.x,board.y,board.width,board.height]};
  });console.log(JSON.stringify({page:i,width,...result}));if(result.outside||result.scroll)throw Error('Layout overflow');
 }
 if(i<3)await pg.locator('.desk-slot:not([hidden]) section[aria-label="Dungeon track record"] nav button:last-child').click();
}
console.log('ERRORS='+JSON.stringify(await pg.evaluate(()=>window.__errs)));
await closeTab(pg);console.log('GSTACK_STEP_OK');
