const pg=await openTab('http://127.0.0.1:18930');
await pg.evaluate(()=>{window.__errors=[];window.addEventListener('error',e=>window.__errors.push(e.message));});
await snapshot(pg);await pg.getByRole('button',{name:'Visit Delvers’ guild',exact:true}).click();await sleep(2300);await pg.getByRole('button',{name:'Steward · dungeon charters',exact:true}).click();await sleep(1000);await snapshot(pg);await pg.getByRole('button',{name:'Open dungeon builder',exact:true}).click();
const measure=async(label)=>console.log(label+'='+JSON.stringify(await pg.evaluate(()=>({viewport:[innerWidth,innerHeight],studio:[document.querySelector('.builder-studio').clientHeight,document.querySelector('.builder-studio').scrollHeight],outOfView:[...document.querySelectorAll('.builder-studio button,.builder-studio input,.builder-studio select')].filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.bottom>innerHeight+1||r.right>innerWidth+1||r.top<0||r.left<0}).map(el=>el.textContent||el.getAttribute('aria-label')),scrollRegions:[...document.querySelectorAll('.builder-studio *')].filter(el=>el.clientHeight&&el.scrollHeight>el.clientHeight+2&&['auto','scroll'].includes(getComputedStyle(el).overflowY)).map(el=>el.className)}))));
for(const [width,height] of [[1366,768],[390,844],[390,667]]){
 await pg._sendToTarget('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<650});await sleep(200);
 for(const name of ['Layout','Encounters','Art','Treasure','Open']){await pg.getByRole('button',{name,exact:true}).click();await measure(width+'x'+height+' '+name);}
 await pg.getByRole('button',{name:'Play rehearsal',exact:true}).click();await measure(width+' rehearsal');
 for(const name of ['Bag','Journal','Map']){await pg.getByRole('button',{name,exact:true}).click();await measure(width+' '+name);}
 await pg.getByRole('button',{name:'Back to editor',exact:true}).click();
}
await pg.getByRole('button',{name:'Layout',exact:true}).click();await pg.screenshot({path:'studio-mobile.jpg',type:'jpeg',quality:70});
await pg.getByRole('button',{name:'Close builder',exact:true}).click();await pg.getByRole('button',{name:'Back to room',exact:true}).click();await pg.getByRole('button',{name:'Edit interior',exact:true}).click();
for(const name of ['Layout','Art','Check']){await pg.getByRole('button',{name,exact:true}).click();await measure('interior '+name);}
await pg.getByRole('button',{name:'Walk preview',exact:true}).click();await measure('interior preview');await pg.getByRole('button',{name:'Leave house',exact:true}).click();await pg.getByRole('button',{name:'Close builder',exact:true}).click();
console.log('CONSOLE_ERRORS='+JSON.stringify(await pg.evaluate(()=>window.__errors)));console.log('ASIDE_DIR='+pwd);await sleep(10000);await closeTab(pg);console.log('GSTACK_STEP_OK');
