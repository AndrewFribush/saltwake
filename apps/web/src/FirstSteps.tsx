import React from 'react';
import type {Item} from '../../../packages/shared/src/types';

/** Per-browser memory of things the world snapshot cannot attribute to a player (e.g. a bank sale). */
export const markDone=(profile:string,step:string)=>{try{localStorage.setItem(`saltwake.done.${profile}.${step}`,'1');}catch{}};
const wasDone=(profile:string,step:string)=>{try{return localStorage.getItem(`saltwake.done.${profile}.${step}`)==='1';}catch{return false;}};

type Step={id:string;title:string;text:string;done:boolean};

/** A state-aware goal list for the idle town window. It explains what to do; it never moves the player. */
export function FirstSteps({world,hidden}:{world:any;hidden:boolean}){
 const profile=world.profile as string;
 const mine=(world.items as Item[]).filter(i=>i.location.kind==='owned'&&i.location.profile===profile);
 const count=(type:string)=>mine.filter(i=>i.item_type===type).length;
 const brewed=count('tonic')+count('fineTonic')>0||(world.craft?.status==='finished'&&!world.craft?.recovery)||wasDone(profile,'brew');
 const stocked=brewed||(count('herb')>=2&&count('flask')>=2)||wasDone(profile,'stock');
 const sold=wasDone(profile,'sell')||(world.listings??[]).some((l:{seller:string})=>l.seller===profile);
 const delved=(world.runs??[]).some((r:{terminal:string|null})=>r.terminal)||wasDone(profile,'delve');
 const built=(world.editions??[]).some((e:{maker:string})=>e.maker===profile);
 const offer=world.recoveryOffer as {eligible:boolean;wage:string;jobsLeft:number}|undefined;
 const steps:Step[]=[
  ...(offer?.eligible?[{id:'wage',title:`Earn a wage (${offer.wage} coins)`,text:`Short of coin? Ivo at the Copper Kettle pays for a recovery job: three timed stirs, no ingredients needed. Keep going until you can afford a batch of ingredients (8 coins); ${offer.jobsLeft} ${offer.jobsLeft===1?'job':'jobs'} left.`,done:false}]:[]),
  {id:'stock',title:'Stock up on ingredients',text:`At Quayside market, buy 2 herbs and 2 flasks from the merchant counter (8 coins).${Number(world.credits)<8?` You have ${world.credits}: earn or sell first, or look for cheaper player offers.`:''}`,done:stocked},
  {id:'brew',title:'Brew tonics',text:'Talk to Ivo at the Copper Kettle. Hit all three gold marks for fine tonics, which are worth more.',done:brewed},
  {id:'sell',title:'Sell or trade',text:'The bank buys tonics at the market counter (Sell tab), and a standing order pays more for fine ones. Or offer goods to other players: click someone in town to trade.',done:sold},
  ...(delved?[(()=>{const gearTypes=['club','sword','armor','tonic','fineTonic'];const items=(world.listedItems??[]) as Item[];const active=((world.listings??[]) as {id:string;seller:string;remaining_ids:string[];unit_price:string;status:string}[]).filter(l=>l.status==='active'&&l.seller!==profile);
   const where=((world.shops??[]) as {title:string;owner:string;listing_ids:string[]}[]).filter(sh=>sh.owner!==profile).map(sh=>{const types=new Set<string>(active.filter(l=>sh.listing_ids.includes(l.id)).flatMap(l=>l.remaining_ids.map(id=>items.find(i=>i.id===id)?.item_type as string|undefined)).filter((t):t is string=>!!t&&gearTypes.includes(t)));return types.size?`${sh.title} (${[...types].map(t=>t==='fineTonic'?'fine tonics':t+'s').join(', ')})`:'';}).filter(Boolean);
   const packed=count('club')+count('sword')+count('armor')+count('tonic')+count('fineTonic')>0;
   return {id:'gear',title:'Gear up for the next run',text:`A club, armour or a tonic makes a run far safer, but packed gear goes to the bank if you die.${where.length?` Player shops selling gear now: ${where.slice(0,3).join('; ')}. Use the arrows on the map to find their districts.`:' Brew tonics at the Copper Kettle, or check Player offers at the market counter.'}`,done:packed};})()]:[]),
  {id:'delve',title:'Delve for treasure',text:'At the old catacombs, pack gear and pay an entry fee. Escape with treasure; die and your gear is lost.',done:delved},
  ...(world.shopContract?[{id:'shop',title:'Open a shop',text:'Press “Build here” above the map to place a shop of your own in this district, then stock it with goods to sell.',done:(world.shops??[]).some((x:{owner:string})=>x.owner===profile)}]:[]),
  {id:'build',title:'Build a dungeon',text:'At the Delvers’ guild, walk to the drafting table (✎). Draw floors, rehearse for free, then open it: other players pay you to enter.',done:built},
 ];
 const now=steps.find(s=>!s.done);
 return <aside className="idle-inspector first-steps" aria-label="Your goals in Saltwake" hidden={hidden}>
  <h2>Make a living</h2>
  <p>You have <b>{world.credits} coins</b> and {mine.length} {mine.length===1?'item':'items'}. Walk into a building to use it.</p>
  {!now&&<p className="all-done">You’ve tried every trade in Saltwake. Keep your dungeon stocked, undercut the market, or go deeper.</p>}
  <ol>{steps.map(s=><li key={s.id} className={`step ${s.done?'done':''} ${s===now?'now':''}`}><b>{s.title}</b>{!s.done&&s.text}</li>)}</ol>
  <p className="controls-note">Arrow keys / WASD or click to walk · Enter to chat · click another player to trade.</p>
 </aside>;
}
