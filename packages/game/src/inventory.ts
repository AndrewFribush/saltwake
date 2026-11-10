import {catalog} from '../../shared/src/catalog';
import type {RunState} from './state';
export type ItemLocation={kind:'floor';room:number;x:number;y:number}|{kind:'bag'|'weapon'|'armor'|'consumed'};
export type RunItem={id:string;type:keyof typeof catalog;origin:'town'|'dungeon';location:ItemLocation};
export type InventoryAction={type:'pickup'|'equip'|'use'|'drop';itemId:string};
export const isConsumable=(type:RunItem['type'])=>type==='tonic'||type==='fineTonic';
export function addItem(s:RunState,item:RunItem){
 if(!item.id||item.id in s.items)throw Error('Duplicate or invalid item ID');
 const l=item.location;
 if(l.kind==='floor'&&item.origin==='town')throw Error('Town item on floor');
 if(l.kind==='bag'&&Object.values(s.items).filter(i=>i.location.kind==='bag').length>=6)throw Error('Bag full');
 if(l.kind==='weapon'||l.kind==='armor'){
  if(Object.values(s.items).some(i=>i.location.kind===l.kind))throw Error('Occupied equipment slot');
  if(l.kind==='weapon'&&!['club','sword'].includes(item.type)||l.kind==='armor'&&item.type!=='armor')throw Error('Wrong equipment type');
 }
 s.items[item.id]=structuredClone(item);
 (item.origin==='town'?s.originalTownIds:s.reservedItemIds).push(item.id);
}
export function accessible(s:RunState,i:RunItem){const l=i.location;return l.kind!=='consumed'&&(l.kind!=='floor'||(l.room===s.roomIndex&&l.x===s.player.x&&l.y===s.player.y));}
// Called only on a clone. A rejected operation never changes caller state.
export function inventoryAction(s:RunState,a:InventoryAction):boolean{
 const item=Object.hasOwn(s.items,a.itemId)?s.items[a.itemId]:undefined;if(!item||!accessible(s,item))return false;
 const bagCount=()=>Object.values(s.items).filter(i=>i.location.kind==='bag').length;
 if(a.type==='use'){
  if(!isConsumable(item.type)||s.player.hp>=12)return false;
  s.player.hp=Math.min(12,s.player.hp+(item.type==='tonic'?4:6));item.location={kind:'consumed'};s.log.push(`Used ${catalog[item.type].name}.`);return true;
 }
 if(a.type==='pickup'){
  if(item.location.kind!=='floor'||bagCount()>=6)return false;item.location={kind:'bag'};
 }else if(a.type==='drop'){
  if(item.origin==='town'||item.location.kind!=='bag')return false;
  item.location={kind:'floor',room:s.roomIndex,x:s.player.x,y:s.player.y};
 }else{
  const slot=item.type==='armor'?'armor':item.type==='club'||item.type==='sword'?'weapon':null;
  if(!slot||item.location.kind===slot)return false;
  const old=Object.values(s.items).find(i=>i.location.kind===slot);
  const room=bagCount()-(item.location.kind==='bag'?1:0)<6;
  if(old&&!room&&old.origin==='town')return false;
  if(old)old.location=room?{kind:'bag'}:{kind:'floor',room:s.roomIndex,x:s.player.x,y:s.player.y};
  item.location={kind:slot};
  if(slot==='weapon')s.player.weapon=item.type as 'club'|'sword';else s.player.armor=true;
 }
 s.log.push(`${a.type}: ${catalog[item.type].name} (${item.origin}).`);return true;
}
