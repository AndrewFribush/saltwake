import React,{useState} from 'react';
import {enemyCatalog,enemyKinds,featureCatalog,featureKinds,supplyCatalog} from '../../../packages/shared/src/depth-components';
import {catalog} from '../../../packages/shared/src/catalog';
import {itemUse} from '../../../packages/shared/src/equipment';
import {ComponentArt} from './art/Places';
import {ItemIcon} from './ItemIcon';

/** What each building block asks of the player, and what the maker controls. Generated from the live catalogs,
 * so a new enemy or feature appears here with its summary even before it gets hand-written advice. */
type Card={name:string;cost:string;what:string;decision:string;control:string};

const enemyAdvice:Record<string,{decision:string;control:string}>={
 pursuer:{decision:'Fight it in a corridor where it can only come from one side, or guard as it closes. Its next step is shown, so you can wait for it.',control:'Placement decides the route it takes to you. Tuning sets health, damage and how far away it wakes.'},
 charger:{decision:'Never stand in a straight line with it unless something else is between you. Step aside when it commits, then hit it while it recovers.',control:'Long open rows make it deadly; pillars and bends tame it. Tuning sets health, damage and wake distance.'},
 archer:{decision:'Close the distance using cover, or break its line of sight. Leave its row or column when the bolt line appears.',control:'Give it long sightlines to guard a room, or tuck it behind obstacles. Tuning sets health, damage and wake distance.'},
 bomber:{decision:'Kill it before it reaches you, or step out of the 3×3 once its fuse is lit. Its blast also hurts enemies and lights kegs.',control:'Pair it with kegs and oil for chain reactions, or with other enemies it can blow up. Tuning sets health and blast damage.'},
 brute:{decision:'It acts every other turn: hit it, then step out of its sweep before it swings. It cannot be shoved.',control:'Put it where the sweep covers a doorway, or let players dance around it in open space. Tuning sets health and damage.'},
 nest:{decision:'Destroy it early or rats keep coming. Decide whether the treasure near it is worth the fight.',control:'Place it to guard treasure or block a route; rats hatch on marked tiles next to it. Tuning sets health.'},
};
const featureAdvice:Record<string,{decision:string;control:string}>={
 barrel:{decision:'Light it to blast a group of enemies or a cracked wall, and stand clear of the 3×3 when it bursts.',control:'Blast damage. Cluster kegs and oil for chains; put them near enemy routes.'},
 crack:{decision:'Spend turns bumping it open, or find a blast to break it. What is behind it may be worth it.',control:'How many bumps it takes. Hide side rooms, shortcuts or treasure behind it.'},
 oil:{decision:'Lure enemies onto it, then ignite it with a blast. Do not stand on it near fire.',control:'Where fire can spread. Line corridors with it beside kegs.'},
 pit:{decision:'Shove enemies into it to remove them instantly; walk around it.',control:'Shape routes without blocking sight. Combine with shove-able enemies for clever kills.'},
 fountain:{decision:'Drink now or save the draughts for later floors; it remembers what is left.',control:'Health per draught and how many draughts. Place it before or after the hard fight.'},
 altar:{decision:'Pay health now for a lasting boon, or keep your health. It cannot kill you.',control:'Which boon and its health price. A tempting price before a hard room is a real choice.'},
 key:{decision:'Detour to fetch the key, or skip what it unlocks.',control:'Its colour. Every locked door of that colour needs one key somewhere reachable; place the key to set the detour.'},
 lock:{decision:'Is what lies behind worth going back for the key?',control:'Its colour. Click a wall tile in Features to cut a doorway with the lock in it, or put it on a floor tile in a corridor.'},
 plate:{decision:'Stand on it (or shove an enemy onto it) to hold a gate open, then find a way through.',control:'Its channel name. Wire it to a door in More tools → Devices with the same channel, or make the stairs need it in Exits. Check → Wiring shows what each channel controls.'},
 cache:{decision:'Collect run-only supplies (bombs, darts, flashes) and decide when to spend them.',control:'Which supply and how many. Supplies never leave the dungeon or enter the economy.'},
};

function cards():Record<string,Card[]>{
 const enemies=enemyKinds.map(k=>{const e=enemyCatalog[k],a=enemyAdvice[k];return {name:e.name,cost:`${e.cost} coins`,what:`${e.hp} health, ${e.damage} damage. ${e.summary}`,decision:a?.decision??'Read its telegraph and decide whether to fight, avoid or use the terrain.',control:a?.control??'Placement and Tuning.'};});
 const features=featureKinds.map(k=>{const f=featureCatalog[k],a=featureAdvice[k];const fields=Object.values(f.fields).map(v=>Array.isArray(v)?'a choice of '+v.join(' / '):(v as {label:string}).label.toLowerCase());return {name:f.name,cost:`${f.cost} coin${f.cost>1?'s':''}`,what:f.summary,decision:a?.decision??'Decide whether using it is worth the turn.',control:a?.control??(fields.length?`Set ${fields.join(', ')}.`:'Placement.')};});
 const traps:Card[]=[
  {name:'Spike trap',cost:'1 coin',what:'Alternates armed and safe; armed spikes hurt any creature on the tile after enemies act.',decision:'Time your step for the safe phase, or lure enemies onto it when it arms.',control:'Tick “Spike trap” on an encounter in 2 Encounters; Tuning sets cycle length, armed duration, starting phase and damage.'},
  {name:'Rising tide',cost:'free',what:'After a set number of turns on a floor, the player takes damage every turn until leaving.',decision:'Grab what you can and leave, or gamble on one more room.',control:'Per floor, in More tools → Features: tick “Rising tide on this floor”, then set the turns before it floods and the damage per turn.'},
 ];
 const rewards:Card[]=[
  {name:'Fixed reward',cost:'1 coin + the good',what:'A real good you own, placed at an encounter. Delvers keep it only if they escape.',decision:'Is this reward worth the guard standing on it?',control:'Which good, and where. Fund copies in Treasure; each copy funds one attempt.'},
  {name:'Random reward',cost:'1 coin + goods in its pool',what:'Draws one good from a named pool you stock, without replacement.',decision:'Gamble on what is inside.',control:'Pool names (encounters sharing a name share stock) and which goods you put in each.'},
  ...(['sword','armor','fineTonic'] as const).map(t=>({name:catalog[t].name,cost:`worth ${catalog[t].value}`,what:itemUse[t],decision:t==='fineTonic'?'Drink it in the run, or carry it home to sell.':'Equip it mid-run, or carry it home: dying loses it back to the pool.',control:'Offer it as a fixed reward or put it in a random pool.'})),
  {name:'Dungeon supplies',cost:'via Supply cache',what:Object.values(supplyCatalog).map(s=>`${s.name}: ${s.summary}`).join(' '),decision:'When to spend a limited tool.',control:'Choose the supply and count in a Supply cache.'},
 ];
 return {Enemies:enemies,Features:features,'Traps & timers':traps,Rewards:rewards};
}

export function ComponentReference(){
 const groups=cards(),names=Object.keys(groups);const [group,setGroup]=useState(names[0]);
 return <div className="component-reference">
  <nav className="builder-steps" aria-label="Component groups">{names.map(n=><button type="button" key={n} aria-pressed={group===n} onClick={()=>setGroup(n)}>{n}</button>)}</nav>
  <ul>{groups[group].map(c=><li key={c.name}><div>{(['sword','armor','fineTonic'] as const).find(t=>catalog[t].name===c.name)?<ItemIcon type={(['sword','armor','fineTonic'] as const).find(t=>catalog[t].name===c.name)!}/>:<ComponentArt name={c.name}/>}<b>{c.name}</b><small>{c.cost}</small></div><p>{c.what}</p><p><em>Player decides:</em> {c.decision}</p><p><em>You control:</em> {c.control}</p></li>)}</ul>
 </div>;
}
