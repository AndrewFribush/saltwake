import {Pages,Reading} from './GamePanels';
import React, {useRef, useState} from 'react';
import type {WalletView} from '../../../packages/shared/src/wallet';
import './wallet.css';
import {BuyCoins} from './BuyCoins';

export type WalletProps = {
  world: {profile: string; wallet?: WalletView};
  busy?: boolean;
  refresh: () => Promise<void>;
};

/** Parent supplies its guarded /api/world response and existing refresh/recovery flow. */
export function Wallet({world, busy = false, refresh}: WalletProps) {
  const [view,setView]=useState('Balances');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{profile: string; text: string} | null>(null);
  const inflight = useRef(false);
  const wallet = world.wallet?.profile === world.profile ? world.wallet : undefined;
  async function reload() {
    if (busy || inflight.current) return;
    inflight.current = true;
    setWorking(true);
    setNotice(null);
    try { await refresh(); }
    catch (error) { setNotice({profile: world.profile, text: error instanceof Error ? error.message : 'Could not refresh wallet.'}); }
    finally { inflight.current = false; setWorking(false); }
  }
  return <section className="game-wallet" aria-label="Game wallet" aria-busy={working}>
    <div className="desk-nav"><label>Account <select aria-label="Wallet view" value={view} onChange={e=>setView(e.target.value)}>{['Balances','Pending','Run fees','Cash flow','Cash movements','Cash rules','Stock costs','Trading result','Cost rules','Receipts','About'].map(v=><option key={v}>{v}</option>)}</select></label><button disabled={busy||working} onClick={()=>void reload()}>Refresh wallet</button></div>
    <Reading text={notice?.profile===world.profile?notice.text:working?'Refreshing…':''}/>
    {!wallet?<p>Balance unavailable. Refresh this profile.</p>:<>
    {view==='Balances'&&<><BuyCoins/><dl className="wallet-balances">{[['Coins in purse',wallet.purse??'Unavailable'],['Reserved run fees',wallet.reservedRunFees],['Pending maker fees',wallet.pendingMakerFees],['Pending recovery wages',wallet.pendingRecoveryWages]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{wallet.ownedItemCount} goods · {wallet.ownedItemCatalogValue} catalog value, not cash.</p><p>Reserved fees already left your purse. Pending income is not spendable until settlement.</p></>}
    {view==='Pending'&&(wallet.unresolved.length?<Pages items={wallet.unresolved} label="Pending operations" render={op=><article><h3>{op.action.replaceAll('_',' ')}</h3><p>{op.status}</p><Reading text={op.id}/><p>No final receipt yet. Refresh to reconcile; cash effect is not estimated.</p></article>}/>:<p>No unresolved operations.</p>)}
    {view==='Run fees'&&<><p>Authoritative fees in snapshot order, excluding voided runs. This is not a complete cash ledger.</p>{wallet.runFeeHistory?.length?<Pages items={wallet.runFeeHistory} label="Run fee history" render={e=><article><h3>{e.role==='player'?'Outgoing entry':'Incoming maker'} fee · {e.amount}</h3><p>{e.status==='active'?e.role==='player'?'Reserved':'Pending':'Settled'}</p><Reading text={`${e.runId} · ${e.editionId}`}/></article>}/>:<p>No run fee records.</p>}</>}
    {view==='Cash flow'&&wallet.business&&<><p>Recorded in {wallet.business.recordedIn} · out {wallet.business.recordedOut} · net {wallet.business.recordedNet} coins.</p><p>Pending income: {wallet.business.pendingIncome} coins.</p><p>Partial cash history, not profit. Initial allocations and recovery wages are excluded. Choose Cash movements for entries or Cash rules for coverage.</p></>}
    {view==='Cash movements'&&wallet.business&&<Pages items={wallet.business.entries} label="Cash movements" empty="No recorded movements." render={e=><article><h3>{e.pending?'Pending':e.direction==='in'?'Received':'Paid'} · {e.amount} coins</h3><p>{e.detail}</p><Reading text={e.id}/></article>}/>}
    {view==='Cash rules'&&wallet.business&&<Reading limit={180} text={wallet.business.limitations.join(' ')}/>}
    {view==='Stock costs'&&wallet.costs&&<><p>Stored goods: {wallet.costs.knownOwnedCost} coins of known cost; {wallet.costs.unknownOwnedItems} goods have unknown cost.</p><p>Committed treasure: {wallet.costs.fundingCost} coins of known cost; {wallet.costs.unknownFundedItems} funded goods have unknown cost. Committed treasure is expensed once, including closure leftovers.</p></>}
    {view==='Trading result'&&wallet.costs&&<><p>Tracked sale proceeds {wallet.costs.saleProceeds} · matched known cost {wallet.costs.matchedSaleCost}.</p><p>Sale contribution: {wallet.costs.recordedSaleContribution===null?'Unknown':wallet.costs.recordedSaleContribution+' coins'} · {wallet.costs.unknownSaleItems} sales have incomplete cost.</p><p>This excludes dungeon entry, placement, lost gear and your time. It is not overall profit.</p></>}
    {view==='Cost rules'&&wallet.costs&&<Reading limit={170} text={`Prospective local single-writer records: ${wallet.costs.trackedOperations} observed actions, ${wallet.costs.gaps} continuity gaps. Old goods and extracted treasure have unknown cost. Purchase costs transfer through crafting; whole-credit remainders go to sorted output IDs. A gap resets current stock costs to unknown. Bank buybacks and seeded NPC sales count in the trading result; they are not organic demand. Missing observations can omit expenses or sales. Funding owned goods is not another cash purchase. No historical or overall profit is certified.`}/>}
    {view==='Receipts'&&<><p>Confirmed server-recorded operations, newest first; not a complete cash ledger.</p>{wallet.receipts.length?<Pages items={wallet.receipts} label="Operation receipts" render={r=><article><h3>{r.action.replaceAll('_',' ')} · {r.status}</h3><Reading text={`${r.id}: ${r.result}`}/></article>}/>:<p>No confirmed receipts.</p>}</>}
    {view==='About'&&<Reading text={`Local profile: ${world.profile}. Operator custody, synthetic credits, no external wallet. Item catalog values exclude listed, funded, crafting and expedition items. Run fee history excludes trades, crafting wages, initial allocations and void refunds. Voided entry fees return to the player rather than the maker. Playing your own edition shows both roles. Incoming payments may not have an operation receipt.`}/>}
    </>}
  </section>;
}
