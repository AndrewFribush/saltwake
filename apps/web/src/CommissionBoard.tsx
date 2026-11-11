import React,{useRef,useState} from 'react';
import {Pages} from './GamePanels';
import {playerLabel} from './presence-names';
import {itemName,countOf} from './TradeRows';
import type {TradeContext} from './PlayerTrade';
import type {Commission,ItemType,Item} from '../../../packages/shared/src/types';
const TYPES:ItemType[]=['tonic','fineTonic','herb','flask','sword','club','armor','iron'];
/** Escrowed commissions: post an order (coins held until filled or cancelled) or fill someone's order with goods you own. */
export function CommissionBoard({trade}:{trade:TradeContext}){
 const {world}=trade;const me=world.profile as string;const [type,setType]=useState<ItemType>('tonic'),[price,setPrice]=useState('4'),[qty,setQty]=useState('2'),[notice,setNotice]=useState(''),[working,setWorking]=useState(false);const inflight=useRef(false);
 const all=((world.commissions??[]) as Commission[]);const open=all.filter(c=>c.status==='open');
 const owned=(world.items as Item[]).filter(i=>i.location.kind==='owned'&&i.location.profile===me);
 const pending=(world.operations??[]).some((o:{status:string})=>['Pending','Unknown'].includes(o.status));const disabled=trade.busy||working||pending;
 const run=async(action:any,done:string)=>{if(inflight.current||disabled)return;inflight.current=true;setWorking(true);trade.onBusyChange?.(true);setNotice('');try{await trade.command(action);await trade.refresh();setNotice(done);}catch(e){setNotice((e as Error).message);}finally{inflight.current=false;setWorking(false);trade.onBusyChange?.(false);}};
 const validPrice=/^\d{1,6}$/.test(price)&&Number(price)>=1,validQty=/^\d{1,2}$/.test(qty)&&Number(qty)>=1&&Number(qty)<=32,total=validPrice&&validQty?Number(price)*Number(qty):0;
 return <div className="commission-board">
  <p className="trade-note">A commission holds your coins in escrow and pays whoever delivers the goods, at your price. Coins go to the players who fill it, never to the operator; cancel to get the unspent escrow back.</p>
  {(notice||working)&&<p className="trade-notice" role="status">{working?'The steward is recording it…':notice}</p>}
  <Pages items={open} size={3} label="Open commissions" empty="No open commissions. Post one below." render={c=>{const left=c.quantity-c.filled;const mineToGive=owned.filter(i=>i.item_type===c.item_type);const n=Math.min(left,mineToGive.length);
   return <article key={c.id} className="board-entry"><h4>{countOf(left,c.item_type)} wanted at {c.unit_price} each</h4><p>{c.buyer===me?'Your commission':`By ${playerLabel(c.buyer)}`} · {c.filled} of {c.quantity} delivered · {c.escrow} coins in escrow</p>
    {c.buyer===me?<button disabled={disabled} onClick={()=>void run({type:'cancel_commission',commission_id:c.id},`Cancelled. ${c.escrow} coins returned.`)}>Cancel and refund {c.escrow}</button>
     :<button disabled={disabled||n===0} onClick={()=>void run({type:'fill_commission',commission_id:c.id,item_ids:mineToGive.slice(0,n).map(i=>i.id),expected_unit_price:c.unit_price},`Delivered ${countOf(n,c.item_type)} for ${Number(c.unit_price)*n} coins.`)}>{n?`Deliver ${countOf(n,c.item_type)} for ${Number(c.unit_price)*n}`:`You have no ${itemName(c.item_type).toLowerCase()} to deliver`}</button>}</article>;}}/>
  <fieldset className="commission-post"><legend>Post a commission</legend>
   <label>Goods <select aria-label="Commission goods" value={type} onChange={e=>setType(e.target.value as ItemType)}>{TYPES.map(t=><option key={t} value={t}>{itemName(t)}</option>)}</select></label>
   <label>Price each <input aria-label="Commission price" type="number" min="1" value={price} onChange={e=>setPrice(e.target.value)}/></label>
   <label>How many <input aria-label="Commission quantity" type="number" min="1" max="32" value={qty} onChange={e=>setQty(e.target.value)}/></label>
   <button className="primary" disabled={disabled||!total||total>Number(world.credits)} onClick={()=>void run({type:'post_commission',item_type:type,unit_price:String(Number(price)),quantity:Number(qty)},`Posted: ${qty} ${itemName(type).toLowerCase()} at ${price}. ${total} coins held in escrow.`)}>{total>Number(world.credits)?`Need ${total-Number(world.credits)} more coins`:`Post · hold ${total} coins`}</button>
  </fieldset>
 </div>;
}
