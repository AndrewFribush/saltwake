import React,{useRef,useState} from 'react';
import {StackRows,stacksOf,chosenIds,countOf,type Stack} from './TradeRows';
import type {Command,Item,Listing} from '../../../packages/shared/src/types';
import {playerLabel,sellerIs,economyProfile} from './presence-names';

/** What the town needs from the game shell to trade. Every trade is an ordinary `list`/`buy`/`cancel_listing`
 * command sent through Demo's command wrapper, so the server binds it to the acting session and quotes are exact. */
export type TradeContext={world:any;busy:boolean;command:(action:Command['action'])=>Promise<void>;refresh:()=>Promise<void>;onBusyChange?:(busy:boolean)=>void};
export const TRADE_RANGE=4;


export function PlayerTrade({partner,distance,trade,onClose,onApproach,announce}:{partner:string;distance:number|null;trade:TradeContext;onClose:()=>void;onApproach:()=>void;announce:(text:string)=>Promise<void>}){
 const {world}=trade;const [buyCounts,setBuyCounts]=useState<Record<string,number>>({});const [offerCounts,setOfferCounts]=useState<Record<string,number>>({});const [price,setPrice]=useState('5');
 const [working,setWorking]=useState(false);const [notice,setNotice]=useState('');const inflight=useRef(false);
 const listings=(world.listings as Listing[]??[]).filter(l=>l.status==='active');const listedItems=(world.listedItems as Item[]??[]);
 const reserved=(world.reservations??{}) as Record<string,string>;
 // Economy profiles keep the `wallet:` prefix that presence ids drop.
 const partnerProfile=economyProfile(String(world.profile),partner);
 const [privateOffer,setPrivateOffer]=useState(true);
 const theirs=listings.filter(l=>sellerIs(l.seller,partner)&&(!reserved[l.id]||reserved[l.id]===world.profile));const mine=listings.filter(l=>l.seller===world.profile);
 const owned=(world.items as Item[]).filter(i=>i.location.kind==='owned'&&i.location.profile===world.profile);
 const unresolved=(world.operations??[]).some((o:{status:string})=>['Pending','Unknown'].includes(o.status));
 const near=distance!==null&&distance<=TRADE_RANGE;const disabled=trade.busy||working||unresolved;
 const validPrice=/^\d{1,7}$/.test(price)&&Number(price)>=1&&Number(price)<=1_000_000;
 const them=playerLabel(partner),themLower=them.startsWith('The ')?'the'+them.slice(3):them;
 const available=(l:Listing)=>l.remaining_ids.filter(id=>listedItems.some(i=>i.id===id&&i.location.kind==='listed'&&i.location.listing===l.id));
 const typeOf=(id?:string)=>listedItems.find(i=>i.id===id)?.item_type;
 const theirStacks:Stack[]=theirs.flatMap(l=>{const ids=available(l),type=typeOf(ids[0]);return type?[{key:l.id,type,ids,price:l.unit_price,...(reserved[l.id]?{note:'Offered to you: only you can buy this'}:{})}]:[];});
 const buyStack=theirStacks.find(s=>(buyCounts[s.key]??0)>0),buyIds=buyStack?chosenIds([buyStack],buyCounts):[];
 const buyTotal=buyStack?BigInt(buyStack.price!)*BigInt(buyIds.length):0n;
 const offerStacks=stacksOf(owned),offerStack=offerStacks.find(s=>(offerCounts[s.key]??0)>0),offerIds=offerStack?chosenIds([offerStack],offerCounts):[];
 const run=async(action:Command['action'],done:string,after?:()=>Promise<void>)=>{
  if(inflight.current||disabled)return;inflight.current=true;setWorking(true);trade.onBusyChange?.(true);setNotice('');
  try{await trade.command(action);setBuyCounts({});setOfferCounts({});await trade.refresh();await after?.().catch(()=>{});setNotice(done);}
  catch(e){setNotice(e instanceof Error?e.message:String(e));}
  finally{inflight.current=false;setWorking(false);trade.onBusyChange?.(false);}
 };
 return <div className="player-trade" role="dialog" aria-label={`Trade with ${them}`} onClick={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onClose();}}}>
  <div className="player-trade-head"><h3>Trade with {themLower}</h3><button autoFocus onClick={onClose} aria-label="Close trade">×</button></div>
  {distance===null?<p className="trade-far">{them} has left this district.</p>:!near&&<p className="trade-far">{distance} tiles away. Walk within {TRADE_RANGE} tiles to trade. <button onClick={onApproach}>Walk over</button></p>}
  <p className="trade-balance">You have <b>{world.credits} coins</b></p>
  {(notice||working||unresolved)&&<p className="trade-notice" role="status">{working?'The steward is recording the trade…':notice||'An earlier action is unresolved. Retry it from Session first.'}</p>}
  <section><h4>{them}’s goods</h4>
   <StackRows stacks={theirStacks} counts={buyStack?{[buyStack.key]:buyCounts[buyStack.key]}:buyCounts} onCount={(key,n)=>setBuyCounts({[key]:Math.max(0,n)})} disabled={disabled} empty={`${them} isn’t offering anything yet. Ask in chat.`}/>
   {theirStacks.length>0&&<button className="primary" disabled={disabled||!near||!buyStack||!buyIds.length||buyIds.length>128||buyTotal>BigInt(world.credits)} onClick={()=>buyStack&&void run({type:'buy',listing_id:buyStack.key,item_ids:buyIds,expected_unit_price:buyStack.price!},`Bought ${countOf(buyIds.length,buyStack.type)} from ${themLower}.`,()=>announce(`Bought ${countOf(buyIds.length,buyStack.type)} for ${buyTotal} coins. Thanks!`))}>{buyIds.length?(buyTotal>BigInt(world.credits)?`Need ${buyTotal-BigInt(world.credits)} more coins`:`Buy ${countOf(buyIds.length,buyStack!.type)} for ${buyTotal} coins`):'Choose goods to buy'}</button>}
  </section>
  <section><h4>Offer your goods</h4>
   <StackRows stacks={offerStacks} counts={offerStack?{[offerStack.key]:offerCounts[offerStack.key]}:offerCounts} onCount={(key,n)=>setOfferCounts({[key]:Math.max(0,n)})} disabled={disabled} empty="Your satchel is empty."/>
   <div className="trade-offer"><label>Price <input type="number" min="1" max="1000000" value={price} disabled={disabled} onChange={e=>setPrice(e.target.value)}/> coins each</label>
    <button className="primary" disabled={disabled||!near||!offerStack||!offerIds.length||offerIds.length>128||!validPrice} onClick={()=>offerStack&&void run(privateOffer?{type:'list_for',item_ids:offerIds,unit_price:String(Number(price)),buyer:partnerProfile}:{type:'list',item_ids:offerIds,unit_price:String(Number(price))},`Offered ${countOf(offerIds.length,offerStack.type)} at ${Number(price)} coins each${privateOffer?` to ${themLower} only`:''}.`,()=>announce(privateOffer?`${them}: I’ve offered you ${countOf(offerIds.length,offerStack.type)} at ${Number(price)} coins each. Only you can buy it. Click me to trade.`:`Offering ${countOf(offerIds.length,offerStack.type)} at ${Number(price)} coins each. Click me to trade.`))}>{offerIds.length?`Offer ${countOf(offerIds.length,offerStack!.type)}`:'Choose goods to offer'}</button></div>
   <label className="trade-private"><input type="checkbox" checked={privateOffer} disabled={disabled} onChange={e=>setPrivateOffer(e.target.checked)}/> Only {themLower} can buy</label>
   <p className="trade-empty">{privateOffer?`A private offer: only ${themLower} can buy it, at this price. Withdraw it any time to get unsold goods back.`:`A public offer: ${themLower} sees it here, and anyone can buy it at the market.`}</p>
   {mine.map(l=>{const ids=available(l),type=typeOf(ids[0]??l.remaining_ids[0]);return <p key={l.id} className="trade-mine">Your offer{reserved[l.id]?` to ${playerLabel(reserved[l.id])}`:' (public)'}: {type?countOf(ids.length,type):ids.length+' items'} at {l.unit_price} coins each <button disabled={disabled} onClick={()=>void run({type:'cancel_listing',listing_id:l.id},'Offer withdrawn. Unsold goods are back in your satchel.')}>Withdraw</button></p>;})}
  </section>
 </div>;
}
