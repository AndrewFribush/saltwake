const pg=await openTab('http://127.0.0.1:18930');await snapshot(pg);
await pg.getByRole('button',{name:'Session',exact:true}).click();await pg.locator('.purse-drawer select').selectOption('maker');await pg.getByRole('button',{name:'Close session',exact:true}).click();
await pg.getByRole('button',{name:'Visit Player-built provisioner',exact:true}).click();await pg.getByRole('button',{name:'Edit interior',exact:true}).waitFor({state:'visible',timeout:15000});
const read=()=>pg.evaluate(async()=>{const w=await fetch('/api/world').then(r=>r.json());return {shop:w.shops.find(s=>s.title==='Player-built provisioner'),credits:w.credits};});
const before=await read();
for(const district of ['e',before.shop.district]){
 await pg.getByRole('button',{name:'Edit interior',exact:true}).click();
 await pg.locator('.shop-site-settings select').selectOption(district);
 await pg.getByRole('button',{name:`Place shop at ${district==='e'?4:before.shop.x}, ${district==='e'?10:before.shop.y}`,exact:true}).click();
 await pg.getByRole('button',{name:'Build shop interior →',exact:true}).click();
 await pg.getByRole('button',{name:'Confirm shop changes',exact:true}).click();
 await pg.getByRole('button',{name:'Edit interior',exact:true}).waitFor({state:'visible',timeout:20000});
 const next=await read();if(next.shop.district!==district||JSON.stringify(next.shop.listing_ids)!==JSON.stringify(before.shop.listing_ids)||next.credits!==before.credits)throw Error('Relocation changed stock/balance or wrong location');
 console.log('SHOP_RELOCATION='+JSON.stringify({district:next.shop.district,version:next.shop.version,listings:next.shop.listing_ids,credits:next.credits}));
}
await pg.getByRole('button',{name:'Leave house',exact:true}).click();await pg.getByRole('button',{name:'Visit Player-built provisioner',exact:true}).waitFor({state:'visible',timeout:15000});
await closeTab(pg);console.log('GSTACK_STEP_OK');
