import type {Item,ItemType} from './types';
export const weaponDamage={unarmed:1,club:2,sword:3} as const;
export const healing={tonic:4,fineTonic:6} as const;
export const armorReduction=1;
export const itemUse:Record<ItemType,string>={club:`${weaponDamage.club} damage`,sword:`${weaponDamage.sword} damage`,armor:`Reduces each hit by ${armorReduction}; minimum 1`,tonic:`Restores ${healing.tonic} health`,fineTonic:`Restores ${healing.fineTonic} health`,herb:'Tonic ingredient',flask:'Tonic ingredient',iron:'Trade material; no current recipe'};
export type SupplyGroup='All'|'Equipment'|'Medicine'|'Ingredients';
export function inSupplyGroup(type:ItemType,group:SupplyGroup){return group==='All'||group==='Equipment'&&['club','sword','armor'].includes(type)||group==='Medicine'&&['tonic','fineTonic'].includes(type)||group==='Ingredients'&&['herb','flask','iron'].includes(type);}
/** Selection order is meaningful: the first weapon and armor start equipped. */
export function planLoadout(items:readonly Pick<Item,'id'|'item_type'>[]){
 let weapon:'unarmed'|'club'|'sword'='unarmed',armor=false,bag=0;
 const slots=items.map(item=>{let kind:'weapon'|'armor'|'bag'='bag';if((item.item_type==='club'||item.item_type==='sword')&&weapon==='unarmed'){weapon=item.item_type;kind='weapon';}else if(item.item_type==='armor'&&!armor){armor=true;kind='armor';}else bag++;return {id:item.id,type:item.item_type,kind};});
 const valid=items.length<=8&&bag<=6&&new Set(items.map(i=>i.id)).size===items.length;
 return {weapon,armor,bag,slots,valid,reason:valid?'':bag>6?'Bag holds 6 goods; weapons and armor beyond the equipped pair also use bag space.':'Pack at most 8 distinct goods.'};
}
