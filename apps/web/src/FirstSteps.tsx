import React from 'react';
import {bestOutlets} from './outlets';
import {matchEditions} from '../../../packages/shared/src/matcher';
import {catalog} from '../../../packages/shared/src/catalog';
import type {Item} from '../../../packages/shared/src/types';

/** Per-browser memory of things the world snapshot cannot attribute to a player (e.g. a bank sale). */
export const markDone=(profile:string,step:string)=>{try{localStorage.setItem(`saltwake.done.${profile}.${step}`,'1');}catch{}};
const wasDone=(profile:string,step:string)=>{try{return localStorage.getItem(`saltwake.done.${profile}.${step}`)==='1';}catch{return false;}};

/** Stable: offers with funded treasure left (bundles>0, not a no-treasure attraction) first, original order kept within each group. */
export const treasureFirst=<T extends {terms:{no_reward:boolean};bundles?:number}>(offers:T[]):T[]=>[...offers.filter(e=>!e.terms.no_reward&&(e.bundles??0)>0),...offers.filter(e=>e.terms.no_reward||(e.bundles??0)<=0)];

type Step={id:string;title:string;text:string;done:boolean;start?:boolean};

/** A state-aware goal list for the idle town window. It explains what to do; it never moves the player. */
export function FirstSteps({world,hidden}:{world:any;hidden:boolean}){
 const profile=world.profile as string;
 const mine=(world.items as Item[]).filter(i=>i.location.kind==='owned'&&i.location.profile===profile);
 const count=(type:string)=>mine.filter(i=>i.item_type===type).length;
 // A tonic found in a dungeon or bought is not a brew; only a finished batch (or this browser's record of one) counts.
 const brewed=(world.craft?.status==='finished'&&!world.craft?.recovery)||wasDone(profile,'brew');
 const stocked=brewed||(count('herb')>=1&&count('flask')>=1)||wasDone(profile,'stock');
 const sold=wasDone(profile,'sell')||(world.listings??[]).some((l:{seller:string})=>l.seller===profile);
 const delved=(world.runs??[]).some((r:{terminal:string|null})=>r.terminal)||wasDone(profile,'delve');
 const built=(world.editions??[]).some((e:{maker:string})=>e.maker===profile);
 const offer=world.recoveryOffer as {eligible:boolean;wage:string;jobsLeft:number}|undefined;
 const coins=Number(world.credits??0),fresh=!delved&&!built,clubs=count('club')>0;
 // The best first dungeon: funded treasure left, affordable, cheapest first.
 const pick=treasureFirst(matchEditions(world.editions??[],profile,{maxFee:coins,style:'any',difficulty:'any',rewards:'any'},0,12)).find((e:any)=>!e.terms.no_reward&&e.bundles>0) as any;
 const loot=pick?[...new Set((pick.terms.sockets as {reward:string|null}[]).flatMap(x=>x.reward?[x.reward==='random'?'a random find':(catalog as any)[x.reward]?.name?.toLowerCase()??x.reward]:[]))].join(', ')||'funded treasure':'';
 const steps:Step[]=[
  ...(offer?.eligible?[{id:'wage',title:`Earn a wage (${offer.wage} coins)`,text:`Short of coin? Ivo at the Copper Kettle pays for a recovery job: three timed stirs, no ingredients needed. Keep going until you can afford a batch of ingredients (8 coins); ${offer.jobsLeft} ${offer.jobsLeft===1?'job':'jobs'} left.`,done:false}]:[]),
  {id:'stock',title:'Stock up on ingredients',text:`At Quayside market, buy 2 herbs and 2 flasks from the merchant counter (8 coins).${Number(world.credits)<8?` You have ${world.credits}: earn or sell first, or look for cheaper player offers.`:''}`,done:stocked},
  {id:'brew',title:'Brew tonics',text:'Talk to Ivo at the Copper Kettle. Hit all three gold marks for fine tonics, which are worth more.',done:brewed},
  {id:'sell',title:'Sell or trade',text:`Tonics now fetch: ${bestOutlets(world,'tonic').text}. Fine tonics: ${bestOutlets(world,'fineTonic').text}. Or click someone in town to trade.`,done:sold},
  ...(delved?[(()=>{const gearTypes=['club','sword','armor','tonic','fineTonic'];const items=(world.listedItems??[]) as Item[];const active=((world.listings??[]) as {id:string;seller:string;remaining_ids:string[];unit_price:string;status:string}[]).filter(l=>l.status==='active'&&l.seller!==profile);
   const where=((world.shops??[]) as {title:string;owner:string;listing_ids:string[]}[]).filter(sh=>sh.owner!==profile).map(sh=>{const types=new Set<string>(active.filter(l=>sh.listing_ids.includes(l.id)).flatMap(l=>l.remaining_ids.map(id=>items.find(i=>i.id===id)?.item_type as string|undefined)).filter((t):t is string=>!!t&&gearTypes.includes(t)));return types.size?`${sh.title} (${[...types].map(t=>t==='fineTonic'?'fine tonics':t+'s').join(', ')})`:'';}).filter(Boolean);
   const packed=count('club')+count('sword')+count('armor')+count('tonic')+count('fineTonic')>0;
   return {id:'gear',title:'Gear up for the next run',text:`A club, armour or a tonic makes a run far safer, but packed gear goes to the bank if you die.${where.length?` Player shops selling gear now: ${where.slice(0,3).join('; ')}. Use the arrows on the map to find their districts.`:' Brew tonics at the Copper Kettle, or check Player offers at the market counter.'}`,done:packed};})()]:[]),
  {id:'delve',title:pick?`Delve: escape ${pick.terms.title} with its treasure`:'Delve for treasure',text:pick?`At the old catacombs, talk to the gatewarden. Press + to pack your ${clubs?'club (2 damage instead of 1)':'gear'}, page to ${pick.terms.title} and pay ${pick.fee} ${pick.fee==='1'?'coin':'coins'}. Inside: ${loot}. Pick it up, stand on a floor’s stairs and choose Escape to keep it (or go down for more); die and your packed gear goes to the bank.`:'At the old catacombs, pack gear and pay an entry fee. Escape with treasure; die and your gear is lost.',done:delved,start:true},
  ...(world.shopContract?[{id:'shop',title:'Open a shop',text:'Press “Build here” above the map to place a shop of your own in this district, then stock it with goods to sell.',done:(world.shops??[]).some((x:{owner:string})=>x.owner===profile)}]:[]),
  {id:'build',title:'Build: open your own dungeon',text:`At the Delvers’ guild, walk to the drafting table (✎) and press Fit my budget: ${coins>=10?`a one-floor dungeon costs about 9–10 of your ${coins} coins.`:coins>=4?`it trims a one-floor dungeon (fewer enemies) to fit your ${coins} coins.`:'a one-floor dungeon costs at least 4 coins.'} Rehearse it for free, then Open it: other players pay you their entry fee.${coins<4?' You need at least 4 coins to open one; drawing and rehearsing are free.':''}`,done:built,start:true},
 ];
 // Fresh visitors see the two headline paths first: escape a funded dungeon, or build and open their own.
 if(!(delved&&built))steps.sort((a,b)=>Number(!!b.start&&!b.done)-Number(!!a.start&&!a.done));
 const now=steps.find(s=>!s.done);
 const headline=steps.filter(s=>s.start&&!s.done).length;
 return <aside className="idle-inspector first-steps" aria-label="Your goals in Saltwake" hidden={hidden}>
  <h2>Make a living</h2>
  <p>You have <b>{world.credits} coins</b> and {mine.length} {mine.length===1?'item':'items'}. Walk into a building to use it.</p>
  {!now&&<p className="all-done">You’ve tried every trade in Saltwake. Keep your dungeon stocked, undercut the market, or go deeper.</p>}
  {fresh?<p className="start-here"><b>Start here: pick one.</b> Each takes about five minutes.</p>:!(delved&&built)&&<p className="start-here"><b>Next:</b> {delved?'you have delved; now build one of your own.':'you have built; now see what delvers face.'}</p>}
  <ol>{steps.map((s,i)=><React.Fragment key={s.id}>{!(delved&&built)&&i===headline&&<li className="later-heading">Then make a living</li>}<li className={`step ${s.done?'done':''} ${s===now||(s.start&&!s.done)?'now':''}`}><b>{s.title}</b>{!s.done&&s.text}</li></React.Fragment>)}</ol>
  <p className="controls-note">Arrow keys / WASD or click to walk · Enter to chat · click another player to trade.</p>
 </aside>;
}
