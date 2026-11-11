// Mirrors Demo.tsx's labels for operator-controlled demo profiles; wallet identities arrive as account ids.
const demoNames:Record<string,string>={buyer:'The delver',maker:'The proprietor',worker:'The apprentice',worker2:'The journeyman',p2:'The mercenary',p3:'The wayfarer',p4:'The scavenger',p5:'The newcomer'};
export const playerLabel=(id:string)=>{const name=demoNames[id]??id.replace(/^wallet:/,'');return name.length>20?name.slice(0,19)+'…':name;};
/** Presence ids drop the `wallet:` prefix; economy profiles keep it. */
export const sellerIs=(seller:string,presenceId:string)=>seller===presenceId||seller==='wallet:'+presenceId;
