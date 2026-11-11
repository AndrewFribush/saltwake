import React,{useRef,useState} from 'react';
import {ItemIcon} from './ItemIcon';
import {catalog} from '../../../packages/shared/src/catalog';
import type {Command,Item,Listing} from '../../../packages/shared/src/types';
import {playerLabel,sellerIs} from './presence-names';

/** What the town needs from the game shell to trade. Every trade is an ordinary `list`/`buy`/`cancel_listing`
 * command sent through Demo's command wrapper, so the server binds it to the acting session and quotes are exact. */
export type TradeContext={world:any;busy:boolean;command:(action:Command['action'])=>Promise<void>;refresh:()=>Promise<void>;onBusyChange?:(busy:boolean)=>void};
export const TRADE_RANGE=4;


export function PlayerTrade({partner,distance,trade,onClose,onApproach,announce}:{partner:string;distance:number|null;trade:TradeContext;onClose:()=>void;onApproach:()=>void;announce:(text:string)=>Promise<void>}){
 const {world}=trade;const [picks,setPicks]=useState<Record<string,boolean>>({});const [offer,setOffer]=useState<Record<string,boolean>>({});const [price,setPrice]=useState('5');
 const [working,setWorking]=useState(false);const [notice,setNotice]=useState('');const inflight=useRef(false);
 const listings=(world.listings as Listing[]??[]).filter(l=>l.status==='active');const listedItems=(world.listedItems as Item[]??[]);
 const theirs=listings.filter(l=>sellerIs(l.seller,partner));const mine=listings.filter(l=>l.seller===world.profile);
 const owned=(world.items as Item[]).filter(i=>i.location.kind==='owned'&&i.location.profile===world.profile);
 const unresolved=(world.operations??[]).some((o:{status:string})=>['Pending','Unknown'].includes(o.status));
 const near=distance!==null&&distance<=TRADE_RANGE;const disabled=trade.busy||working||unresolved;
 const validPrice=/^\d{1,7}$/.test(price)&&Number(price)>=1&&Number(price)<=1_000_000;
 const offered=owned.filter(i=>offer[i.id]);
 const run=async(action:Command['action'],after?:()=>Promise<void>)=>{
  if(inflight.current||disabled)return;inflight.current=true;setWorking(true);trade.onBusyChange?.(true);setNotice('');
  try{await trade.command(action);setPicks({});setOffer({});await trade.refresh();await after?.().catch(()=>{});setNotice('Done. Recorded by the steward.');}
  catch(e){setNotice(e instanceof Error?e.message:String(e));}
  finally{inflight.current=false;setWorking(false);trade.onBusyChange?.(false);}
 };
 const available=(l:Listing)=>l.remaining_ids.filter(id=>listedItems.some(i=>i.id===id&&i.location.kind==='listed'&&i.location.listing===l.id));
 const name=(id:string)=>{const item=listedItems.find(i=>i.id===id)??owned.find(i=>i.id===id);return item?catalog[item.item_type].name:id;};
 return <div className="player-trade" role="dialog" aria-label={`Trade with ${playerLabel(partner)}`} onClick={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onClose();}}}>
  <div className="player-trade-head"><h3>Trade with {playerLabel(partner)}</h3><button autoFocus onClick={onClose} aria-label="Close trade">×</button></div>
  {distance===null?<p className="trade-far">{playerLabel(partner)} has left this district.</p>:!near&&<p className="trade-far">{distance} tiles away. Walk within {TRADE_RANGE} to trade. <button onClick={onApproach}>Walk over</button></p>}
  <p className="trade-balance">{world.credits} coins · prices are exact listing quotes</p>
  {(notice||working||unresolved)&&<p className="trade-notice" role="status">{working?'The steward is recording the trade…':notice||'An earlier action is unresolved. Retry it from Session first.'}</p>}
  <section><h4>Their goods</h4>
   {!theirs.length&&<p className="trade-empty">Nothing offered yet. Ask in chat.</p>}
   {theirs.map(l=>{const ids=available(l);const chosen=ids.filter(id=>picks[id]);const total=BigInt(l.unit_price)*BigInt(chosen.length);
    return <article key={l.id}><p>{l.unit_price} coins each · {ids.length} left</p><div className="trade-items">{ids.map(id=>{const item=listedItems.find(i=>i.id===id)!;return <label key={id} className={picks[id]?'picked':''}><input type="checkbox" checked={!!picks[id]} disabled={disabled} onChange={e=>setPicks(p=>({...p,[id]:e.target.checked}))}/><ItemIcon type={item.item_type}/><span>{catalog[item.item_type].name}</span></label>;})}</div>
     <button className="primary" disabled={disabled||!near||!chosen.length||chosen.length>128||total>BigInt(world.credits)} onClick={()=>void run({type:'buy',listing_id:l.id,item_ids:chosen,expected_unit_price:l.unit_price},()=>announce(`Bought ${chosen.length} × ${name(chosen[0])} for ${total} coins. Thanks!`))}>{chosen.length?`Buy ${chosen.length} for ${total} coins`:'Select goods to buy'}</button></article>;})}
  </section>
  <section><h4>Offer your goods</h4>
   <p className="trade-empty">Offers are public listings: {playerLabel(partner)} sees them here, and others can buy them at the market too.</p>
   {!owned.length?<p className="trade-empty">Your satchel is empty.</p>:<div className="trade-items">{owned.map(i=><label key={i.id} className={offer[i.id]?'picked':''}><input type="checkbox" checked={!!offer[i.id]} disabled={disabled} onChange={e=>setOffer(o=>({...o,[i.id]:e.target.checked}))}/><ItemIcon type={i.item_type}/><span>{catalog[i.item_type].name}</span></label>)}</div>}
   <div className="trade-offer"><label>Each <input type="number" min="1" max="1000000" value={price} disabled={disabled} onChange={e=>setPrice(e.target.value)}/> coins</label>
    <button disabled={disabled||!near||!offered.length||offered.length>128||!validPrice} onClick={()=>void run({type:'list',item_ids:offered.map(i=>i.id),unit_price:String(Number(price))},()=>announce(`Offering ${offered.length} × ${catalog[offered[0].item_type].name} at ${Number(price)} coins each. Click me to trade.`))}>Offer {offered.length||''}</button></div>
   {mine.map(l=><p key={l.id} className="trade-mine">Your listing: {available(l).length} × {name(available(l)[0]??l.remaining_ids[0])} at {l.unit_price} <button disabled={disabled} onClick={()=>void run({type:'cancel_listing',listing_id:l.id})}>Withdraw</button></p>)}
  </section>
 </div>;
}
