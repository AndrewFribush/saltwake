import React, {useRef, useState} from 'react';
import {ItemIcon} from './ItemIcon';
import {catalog} from '../../../packages/shared/src/catalog';
import type {BankPrice, Command, Item, Listing, NpcOrder} from '../../../packages/shared/src/types';

export type ShopProps = {
  onBusyChange?: (busy:boolean)=>void;
  world: any;
  busy: boolean;
  selected: string[];
  command: (action: any) => Promise<void>;
  refresh: () => Promise<void>;
};

/** All trades use exact item IDs and quoted prices through the parent's command wrapper. */
export function Shop({world, busy, selected, command, refresh,onBusyChange}: ShopProps) {
  const [price, setPrice] = useState('5');
  const [picks, setPicks] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const inflight = useRef(false);
  const items = world.items as Item[];
  const bankItems = world.bankItems as Item[];
  const listedItems = world.listedItems as Item[];
  const listings = world.listings as Listing[];
  const prices = world.bank_prices as BankPrice[];
  const order = world.npc_order as NpcOrder;
  const ids = [...new Set(selected)];
  const owned = ids.map(id => items.find(item => item.id === id &&
    item.location.kind === 'owned' && item.location.profile === world.profile));
  const validOwned = ids.length > 0 && ids.length <= 128 && owned.every(Boolean);
  const unresolved = (world.operations ?? []).some((op: {status: string}) => ['Pending', 'Unknown'].includes(op.status));
  const disabled = busy || working || unresolved;
  const key = (id: string) => `${world.profile}:${id}`;
  const picked = (id: string) => !!picks[key(id)];
  const toggle = (id: string, value: boolean) => setPicks(previous => ({...previous, [key(id)]: value}));
  const sale = (item: Item) => String(catalog[item.item_type].value);
  const buyback = (item: Item) => String(Math.floor(catalog[item.item_type].value / 2));
  const quoteMatches = (item: Item, buying: boolean) => prices.some(quote => quote.item_type === item.item_type &&
    (buying ? quote.sale_price === sale(item) : quote.buyback_price === buyback(item)));
  const bankSelection = bankItems.filter(item => item.location.kind === 'bank' && picked(item.id));
  const bankTotal = bankSelection.reduce((sum, item) => sum + BigInt(sale(item)), 0n);
  const sellTotal = owned.reduce((sum, item) => sum + (item ? BigInt(buyback(item)) : 0n), 0n);
  const orderTotal = BigInt(order.unit_price) * BigInt(ids.length);
  const validPrice = /^\d{1,7}$/.test(price) && Number(price) >= 1 && Number(price) <= 1_000_000;
  const execute = async (action?: Command['action']) => {
    if (busy || inflight.current || (action && unresolved)) return;
    inflight.current = true;
    setWorking(true);onBusyChange?.(true);
    setNotice('');
    try {
      if (action) await command(action);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      inflight.current = false;
      setWorking(false);onBusyChange?.(false);
    }
  };

  return <section aria-label="Town shop">
    <h2>The merchants’ stalls</h2>
    <p>Balance: {world.credits} credits. Trades use the exact selected item IDs and displayed prices.
      Stock and quotes can change; the contract checks availability before completing a trade.</p>
    <button type="button" disabled={busy || working} onClick={() => void execute()}>Refresh shop</button>
    <p role="status">{notice || (working ? 'Waiting for confirmation…' : unresolved ? 'An operation is unresolved. Refresh before trading again.' : '')}</p>

    <h3>Sell selected town items</h3>
    <p>{ids.length ? ids.map(id => {
      const item = items.find(item => item.id === id);
      return `${item ? catalog[item.item_type].name : 'Unavailable item'} (${id})`;
    }).join(', ') : 'Select owned items in town to list, sell to the bank, or fill the NPC order.'}</p>
    {!validOwned && ids.length > 0 && <p>Select 1–128 available items owned by this profile.</p>}
    <label>Listing price per item <input type="number" min="1" max="1000000" step="1" value={price}
      disabled={disabled} onChange={event => setPrice(event.target.value)} /></label>{' '}
    <button type="button" disabled={disabled || !validOwned || !validPrice}
      onClick={() => void execute({type: 'list', item_ids: ids, unit_price: String(Number(price))})}>List {ids.length} items at {validPrice ? String(Number(price)) : '—'} credits each</button>
    <p>Listed items are locked until purchased or cancelled.</p>
    <button type="button" disabled={disabled || !validOwned || !owned.every(item => item && quoteMatches(item, false)) || sellTotal > BigInt(world.bank)}
      onClick={() => void execute({type: 'bank_sell', item_ids: ids, expected_unit_prices: owned.map(item => buyback(item!))})}>Sell selected to bank for {sellTotal.toString()} credits</button>
    <p>Bank buyback budget: {world.bank} credits. Buyback pays half the catalog value per item.</p>

    <h3>Goods from local traders</h3>
    {!listings.some(listing => listing.status === 'active') && <p>No active listings.</p>}
    {listings.filter(listing => listing.status === 'active').map(listing => {
      const available = listing.remaining_ids.filter(id => listedItems.some(item => item.id === id &&
        item.location.kind === 'listed' && item.location.listing === listing.id));
      const chosen = available.filter(picked);
      const total = BigInt(listing.unit_price) * BigInt(chosen.length);
      const mine = listing.seller === world.profile;
      return <article key={listing.id}>
        <h4>{listing.id} · Seller {listing.seller}{mine ? ' (you)' : ''}</h4>
        <p>{listing.unit_price} credits per item · {available.length} remaining</p>
        <div className="stock-rack">{available.map(id => {
          const item = listedItems.find(item => item.id === id)!;
          return <label className="item" key={id}><input type="checkbox" checked={picked(id)} disabled={disabled || mine}
            onChange={event => toggle(id, event.target.checked)} /><ItemIcon type={item.item_type}/><span>{catalog[item.item_type].name}<small>{id}</small></span></label>;
        })}</div>
        {mine ? <button type="button" disabled={disabled}
          onClick={() => void execute({type: 'cancel_listing', listing_id: listing.id})}>Cancel listing · return unsold items</button>
          : <button type="button" disabled={disabled || !chosen.length || chosen.length > 128 || total > BigInt(world.credits)}
            onClick={() => void execute({type: 'buy', listing_id: listing.id, item_ids: chosen, expected_unit_price: listing.unit_price})}>Buy {chosen.length} selected for {total.toString()} credits</button>}
      </article>;
    })}

    <h3>The bank’s supply counter</h3>
    <p>Sale prices are catalog values; buyback quotes are shown alongside them.</p>
    {!bankItems.length && <p>The bank has no stock.</p>}
    <div className="stock-rack">{bankItems.map(item => <label className="item" key={item.id}><input type="checkbox" checked={picked(item.id)}
      disabled={disabled || !quoteMatches(item, true)} onChange={event => toggle(item.id, event.target.checked)} />
      <ItemIcon type={item.item_type}/><span>{catalog[item.item_type].name}<small>{item.id}</small>Buy {sale(item)} / sell {buyback(item)} coins</span>
      {!quoteMatches(item, true) && ' · Quote mismatch: refresh required'}</label>)}</div>
    <button type="button" disabled={disabled || !bankSelection.length || bankSelection.length > 128 ||
      !bankSelection.every(item => quoteMatches(item, true)) || bankTotal > BigInt(world.credits)}
      onClick={() => void execute({type: 'bank_buy', item_ids: bankSelection.map(item => item.id), expected_unit_prices: bankSelection.map(sale)})}>Buy {bankSelection.length} bank items for {bankTotal.toString()} credits</button>

    <h3>NPC order · Seeded demo demand</h3>
    <p>This finite NPC order is demo demand, not a player purchase or guaranteed ongoing income.
      Filled items are consumed by the order.</p>
    <p>{order.id}: {catalog[order.item_type].name} at {order.unit_price} credits each · {order.remaining} remaining · Budget {order.budget} credits</p>
    <button type="button" disabled={disabled || !validOwned || !owned.every(item => item?.item_type === order.item_type) ||
      ids.length > order.remaining || orderTotal > BigInt(order.budget)}
      onClick={() => void execute({type: 'fill_npc_order', order_id: order.id, item_ids: ids, expected_unit_price: order.unit_price})}>Fill order with {ids.length} selected for {orderTotal.toString()} credits</button>
  </section>;
}
