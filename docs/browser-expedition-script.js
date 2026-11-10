const pg=await openTab("about:blank");await pg._sendToTarget("Page.addScriptToEvaluateOnNewDocument",{source:`window.__errs=[];window.addEventListener("error",e=>window.__errs.push(e.message));`});await pg.goto("http://127.0.0.1:18930");
const actions=[{"type": "pickup", "itemId": "cache-tonic"}, {"type": "wait"}, {"type": "wait"}, {"type": "attack", "enemyId": "rat-1"}, {"type": "attack", "enemyId": "rat-1"}, {"type": "move", "x": 1, "y": 2}, {"type": "move", "x": 1, "y": 3}, {"type": "equip", "itemId": "cache-armor"}, {"type": "move", "x": 2, "y": 3}, {"type": "equip", "itemId": "cache-sword"}, {"type": "move", "x": 3, "y": 3}, {"type": "move", "x": 4, "y": 3}, {"type": "move", "x": 5, "y": 3}, {"type": "move", "x": 6, "y": 3}, {"type": "move", "x": 7, "y": 3}, {"type": "move", "x": 7, "y": 4}, {"type": "move", "x": 7, "y": 5}, {"type": "continue"}, {"type": "move", "x": 2, "y": 1}, {"type": "move", "x": 3, "y": 1}, {"type": "move", "x": 3, "y": 2}, {"type": "attack", "enemyId": "boar-1"}, {"type": "move", "x": 4, "y": 2}, {"type": "move", "x": 5, "y": 2}, {"type": "move", "x": 6, "y": 2}, {"type": "move", "x": 7, "y": 2}, {"type": "move", "x": 7, "y": 3}, {"type": "move", "x": 7, "y": 4}, {"type": "pickup", "itemId": "deep-fine"}, {"type": "move", "x": 7, "y": 5}, {"type": "pickup", "itemId": "deep-iron"}, {"type": "extract"}];
for(let idx=0;idx<actions.length;idx++){
 const a=actions[idx];
 if(a.type==="move")await pg.locator(`button[aria-label^="${a.x},${a.y} "]`).click();
 else if(a.type==="attack")await pg.getByRole("button",{name:`Attack ${a.enemyId}`,exact:true}).click();
 else if(a.type==="wait")await pg.getByRole("button",{name:"Wait [Space]",exact:true}).click();
 else if(a.type==="continue")await pg.getByRole("button",{name:"Enter spike hall",exact:true}).click();
 else if(a.type==="extract")await pg.getByRole("button",{name:"Extract",exact:true}).click();
 else {const verb={pickup:"Take",equip:"Equip",use:"Drink",drop:"Drop"}[a.type];await pg.locator(`[data-item-id="${a.itemId}"] button`).filter({hasText:verb}).click();}
 const status=await pg.locator("[role=status]").innerText();if(!status.includes(`Turn ${idx+1}.`))throw Error(`Turn mismatch ${idx+1}: ${status}`);
 console.log(`TURN ${idx+1}: ${a.type} OK`);
}
console.log("REPORT="+await pg.locator("[aria-label=\"Practice item outcomes\"]").innerText());console.log("CONSOLE_ERRORS="+JSON.stringify(await pg.evaluate(()=>window.__errs)));
await pg.screenshot({path:"expedition.jpg",type:"jpeg",quality:75,fullPage:true});console.log("IMAGE_BASE64="+(await fs.readFile(path.join(pwd,"expedition.jpg"))).toString("base64"));await closeTab(pg);console.log("GSTACK_STEP_OK");