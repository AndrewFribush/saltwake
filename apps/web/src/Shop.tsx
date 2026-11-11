import {inSupplyGroup,type SupplyGroup} from '../../../packages/shared/src/equipment';
import {Reading} from './GamePanels';
import React, {useRef, useState} from 'react';
import {catalog} from '../../../packages/shared/src/catalog';
import type {BankPrice, Command, Item, Listing, NpcOrder} from '../../../packages/shared/src/types';
import {StackRows,stacksOf,chosenIds,itemName,countOf,type Stack} from './TradeRows';
import {playerLabel} from './presence-names';
import {markDone} from './FirstSteps';

export type ShopProps = {
  onBusyChange?: (busy:boolean)=>void;
  world: any;
  busy: boolean;
  /** Kept for callers that still pass the satchel selection; the counter now picks goods inline. */
  selected?: string[];
  command: (action: any) => Promise<void>;
  refresh: () => Promise<void>;
};

const VIEWS=['Buy supplies','Player offers','Sell','Orders'] as const;
type View=typeof VIEWS[number];
const value=(type:string)=>(catalog as Record<string,{value:number}>)[type]?.value??0;

/** All trades use exact item IDs and quoted prices through the parent's command wrapper.
 * Rows only choose how many of a stack; the ids sent are the first N of that stack. */
export function Shop({world, busy, command, refresh,onBusyChange}: ShopProps) {
  const [view,setView]=useState<View>('Buy supplies');
  const [group,setGroup]=useState<SupplyGroup>('All');
  const [price, setPrice] = useState('5');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState('');
  const inflight = useRef(false);
  const items = world.items as Item[];
  const bankItems = world.bankItems as Item[];
  const listedItems = world.listedItems as Item[];
  const listings = (world.listings as Listing[]).filter(l=>l.status==='active'&&!(world.shops??[]).some((s:{listing_ids:string[]})=>s.listing_ids.includes(l.id)));
  const prices = world.bank_prices as BankPrice[];
  const order = world.npc_order as NpcOrder;
  const unresolved = (world.operations ?? []).some((op: {status: string}) => ['Pending', 'Unknown'].includes(op.status));
  const disabled = busy || working || unresolved;
  const credits = BigInt(world.credits);
  const sale = (type: string) => String(value(type));
  const buyback = (type: string) => String(Math.floor(value(type) / 2));
  const quoted = (type: string, buying: boolean) => prices.some(q => q.item_type === type && (buying ? q.sale_price === sale(type) : q.buyback_price === buyback(type)));
  const setCount=(key:string,n:number)=>{setDone('');setCounts(c=>({...c,[key]:Math.max(0,n)}));};
  const switchView=(v:View)=>{setView(v);setCounts({});setNotice('');setDone('');};

  // Bank supplies, one row per item type.
  const supplyStacks:Stack[]=stacksOf(bankItems.filter(i=>i.location.kind==='bank'&&inSupplyGroup(i.item_type,group)),type=>({price:sale(type),disabled:!quoted(type,true),note:quoted(type,true)?undefined:'Price changed: refresh the shop'}));
  const supplyIds=chosenIds(supplyStacks,counts);
  const supplyTotal=supplyIds.reduce((sum,id)=>sum+BigInt(sale(bankItems.find(i=>i.id===id)!.item_type)),0n);

  // Player offers: each listing is its own row, bought one listing at a time.
  const reserved=(world.reservations??{}) as Record<string,string>;
  // Private offers are only listed for the player they were made to.
  const offerStacks:Stack[]=listings.filter(l=>l.seller!==world.profile&&(!reserved[l.id]||reserved[l.id]===world.profile)).flatMap(l=>{
    const ids=l.remaining_ids.filter(id=>listedItems.some(i=>i.id===id&&i.location.kind==='listed'&&i.location.listing===l.id));
    const type=listedItems.find(i=>i.id===ids[0])?.item_type;
    return type?[{key:l.id,type,ids,price:l.unit_price,note:reserved[l.id]?`Offered to you by ${playerLabel(l.seller)}`:`Offered by ${playerLabel(l.seller)}`}]:[];
  });
  const offer=offerStacks.find(s=>(counts[s.key]??0)>0);
  const offerIds=offer?chosenIds([offer],counts):[];
  const offerListing=offer&&listings.find(l=>l.id===offer.key);
  const offerTotal=offerListing?BigInt(offerListing.unit_price)*BigInt(offerIds.length):0n;
  const mine=listings.filter(l=>l.seller===world.profile);

  // Your own goods, for selling to the bank, listing, or filling the order.
  const owned=items.filter(i=>i.location.kind==='owned'&&i.location.profile===world.profile);
  const sellStacks:Stack[]=stacksOf(owned,type=>({price:buyback(type),note:`Bank pays ${buyback(type)} · catalog value ${value(type)}`}));
  const sellIds=chosenIds(sellStacks,counts);
  const sellTypes=sellIds.map(id=>owned.find(i=>i.id===id)!.item_type);
  const sellTotal=sellTypes.reduce((sum,type)=>sum+BigInt(buyback(type)),0n);
  const validPrice = /^\d{1,7}$/.test(price) && Number(price) >= 1 && Number(price) <= 1_000_000;
  const orderStacks:Stack[]=stacksOf(owned.filter(i=>i.item_type===order.item_type)).map(s=>({...s,ids:s.ids.slice(0,order.remaining),price:order.unit_price}));
  const orderIds=chosenIds(orderStacks,counts);
  const orderTotal=BigInt(order.unit_price)*BigInt(orderIds.length);

  const execute = async (action?: Command['action'], success?: string) => {
    if (busy || inflight.current || (action && unresolved)) return;
    inflight.current = true;
    setWorking(true);onBusyChange?.(true);
    setNotice('');setDone('');
    try {
      if (action) {await command(action);setCounts({});if(success)setDone(success);if(['bank_sell','list','fill_npc_order','buy'].includes(action.type))markDone(world.profile,'sell');}
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      inflight.current = false;
      setWorking(false);onBusyChange?.(false);
    }
  };
  const summary=(ids:string[],lookup:Item[])=>{const by=new Map<string,number>();for(const id of ids){const t=lookup.find(i=>i.id===id)?.item_type;if(t)by.set(t,(by.get(t)??0)+1);}return [...by].map(([t,n])=>countOf(n,t)).join(', ');};

  return <section className="shop-counter" aria-label="Town shop">
    <nav className="shop-tabs" aria-label="Market counter">{VIEWS.map(v=><button key={v} type="button" aria-pressed={view===v} disabled={working} onClick={()=>switchView(v)}>{v}</button>)}</nav>
    <p className="trade-balance"><b>{world.credits} {world.credits==='1'?'coin':'coins'}</b> in your purse <button type="button" className="link-button" disabled={busy || working} onClick={() => void execute()}>Refresh</button></p>
    <div role="status" className="shop-status">{done&&<p className="trade-done">{done}</p>}{(notice||working||unresolved)&&<Reading text={notice || (working ? 'Waiting for confirmation…' : 'An earlier action is unresolved. Use Session → Retry interrupted action before trading again.')}/>}</div>

    {view==='Buy supplies'&&<>
    <div className="shop-row"><h3>Bank supplies</h3><label>Show <select aria-label="Supply category" value={group} onChange={e=>{setGroup(e.target.value as SupplyGroup);setCounts({});}}>{(['All','Equipment','Medicine','Ingredients'] as const).map(g=><option key={g}>{g}</option>)}</select></label></div>
    <StackRows stacks={supplyStacks} counts={counts} onCount={setCount} disabled={disabled} empty={bankItems.length?'Nothing in this category.':'The bank has no stock.'}/>
    <p className="trade-guidance">{!supplyIds.length?'Use + to choose how many. Tonics need 2 herbs + 2 flasks at the Copper Kettle.':supplyTotal>credits?`You need ${supplyTotal-credits} more coins.`:`${summary(supplyIds,bankItems)} · ${supplyTotal} coins`}</p>
    <button className="primary checkout" type="button" disabled={disabled || !supplyIds.length || supplyIds.length > 128 || supplyTotal > credits}
      onClick={() => void execute({type: 'bank_buy', item_ids: supplyIds, expected_unit_prices: supplyIds.map(id=>sale(bankItems.find(i=>i.id===id)!.item_type))},`Bought ${summary(supplyIds,bankItems)}. ${supplyIds.length===1?"It is":"They are"} in your satchel.`)}>{supplyIds.length?`Buy for ${supplyTotal} coins`:'Choose supplies'}</button>
    </>}

    {view==='Player offers'&&<>
    <h3>Goods offered by other players</h3>
    <StackRows stacks={offerStacks} counts={offer?{[offer.key]:counts[offer.key]}:counts} onCount={(key,n)=>{setDone('');setCounts({[key]:Math.max(0,n)});}} disabled={disabled} empty="No one is offering goods here right now. Player stalls in town sell their own stock."/>
    <p className="trade-guidance">{!offer?'Choose from one offer at a time.':offerTotal>credits?`You need ${offerTotal-credits} more coins.`:`${countOf(offerIds.length,offer.type)} from ${playerLabel(offerListing!.seller)} · ${offerTotal} coins`}</p>
    <button className="primary checkout" type="button" disabled={disabled || !offerListing || !offerIds.length || offerIds.length > 128 || offerTotal > credits}
      onClick={() => offerListing&&void execute({type: 'buy', listing_id: offerListing.id, item_ids: offerIds, expected_unit_price: offerListing.unit_price},`Bought ${countOf(offerIds.length,offer!.type)} from ${playerLabel(offerListing.seller)}.`)}>{offerIds.length?`Buy for ${offerTotal} coins`:'Choose an offer'}</button>
    {mine.length>0&&<div className="my-offers"><h4>Your offers</h4>{mine.map(l=>{const t=listedItems.find(i=>i.id===l.remaining_ids[0])?.item_type;return <p key={l.id}>{l.remaining_ids.length} {t?itemName(t):'items'} at {l.unit_price} coins each <button type="button" disabled={disabled} onClick={() => void execute({type: 'cancel_listing', listing_id: l.id},'Offer withdrawn. Unsold goods are back in your satchel.')}>Withdraw</button></p>;})}</div>}
    </>}

    {view==='Sell'&&<>
    <h3>Sell your goods</h3>
    <StackRows stacks={sellStacks} counts={counts} onCount={setCount} disabled={disabled} empty="Your satchel is empty. Buy supplies, craft at the Copper Kettle, or bring finds back from the catacombs."/>
    <div className="sell-actions">
      <button type="button" disabled={disabled || !sellIds.length || sellIds.length>128 || !sellTypes.every(t => quoted(t, false)) || sellTotal > BigInt(world.bank)}
        onClick={() => void execute({type: 'bank_sell', item_ids: sellIds, expected_unit_prices: sellTypes.map(buyback)},`Sold ${summary(sellIds,owned)} to the bank for ${sellTotal} coins.`)}>Sell to the bank · {sellTotal.toString()} coins</button>
      <span className="or">or offer to players at</span>
      <label className="price-input"><input aria-label="Price per item" type="number" min="1" max="1000000" step="1" value={price} disabled={disabled} onChange={event => setPrice(event.target.value)} /> coins each</label>
      <button type="button" disabled={disabled || !sellIds.length || sellIds.length>128 || !validPrice || new Set(sellTypes).size>1}
        onClick={() => void execute({type: 'list', item_ids: sellIds, unit_price: String(Number(price))},`Offered ${summary(sellIds,owned)} at ${Number(price)} coins each. Other players can buy them here or from the trade window.`)}>{new Set(sellTypes).size>1?'Offer one kind at a time':sellIds.length?`Offer ${countOf(sellIds.length,sellTypes[0])}`:'Offer for sale'}</button>
    </div>
    <p className="trade-note">The bank buys at half catalog value (budget {world.bank} coins). Offered goods stay locked until someone buys them or you withdraw them under Player offers.</p>
    </>}

    {view==='Orders'&&<>
    <h3>Standing order</h3>
    <p className="order-card">Wanted: <b>{countOf(order.remaining,order.item_type)}</b> at <b>{order.unit_price} coins</b> each · budget {order.budget} coins.</p>
    <StackRows stacks={orderStacks} counts={counts} onCount={setCount} disabled={disabled} empty={`You have no ${itemName(order.item_type)}. Hit all three marks at the Copper Kettle to brew fine tonics.`}/>
    <button className="primary checkout" type="button" disabled={disabled || !orderIds.length || orderIds.length > order.remaining || orderTotal > BigInt(order.budget)}
      onClick={() => void execute({type: 'fill_npc_order', order_id: order.id, item_ids: orderIds, expected_unit_price: order.unit_price},`Order filled: ${countOf(orderIds.length,order.item_type)} for ${orderTotal} coins.`)}>{orderIds.length?`Deliver for ${orderTotal} coins`:'Choose goods to deliver'}</button>
    <p className="trade-note">Seeded demo demand: a finite order, not a player purchase or guaranteed income. Delivered goods are consumed.</p>
    </>}
  </section>;
}
