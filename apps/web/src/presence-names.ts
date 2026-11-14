// Mirrors Demo.tsx's labels for operator-controlled demo profiles; wallet identities arrive as account ids.
const demoNames:Record<string,string>={buyer:'The delver',maker:'The proprietor',worker:'The apprentice',worker2:'The journeyman',p2:'The mercenary',p3:'The wayfarer',p4:'The scavenger',p5:'The newcomer',dredger:'The dredger',salvager:'The salvager'};
/** Hosted townsfolk (server crowd): presence ids `npc:<name>`. Scenery: shown by first name, never tradable. */
export const isNpc=(id:string)=>id.startsWith('npc:');
export const playerLabel=(id:string)=>{const name=demoNames[id]??(isNpc(id)?id.slice(4).replace(/^./,c=>c.toUpperCase()):id.replace(/^wallet:/,''));return name.length>20?name.slice(0,19)+'…':name;};
/** Presence ids drop the `wallet:` prefix; economy profiles keep it. */
/** The economy profile for a presence id, given the viewer's own profile kind (wallet profiles carry `wallet:`). */
export const economyProfile=(viewerProfile:string,presenceId:string)=>viewerProfile.startsWith('wallet:')&&!presenceId.startsWith('wallet:')?'wallet:'+presenceId:presenceId;
export const sellerIs=(seller:string,presenceId:string)=>seller===presenceId||seller==='wallet:'+presenceId;
