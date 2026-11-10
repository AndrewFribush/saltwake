import React, {useRef, useState} from 'react';
import type {WalletView} from '../../../packages/shared/src/wallet';
import './wallet.css';

export type WalletProps = {
  world: {profile: string; wallet?: WalletView};
  busy?: boolean;
  refresh: () => Promise<void>;
};

/** Parent supplies its guarded /api/world response and existing refresh/recovery flow. */
export function Wallet({world, busy = false, refresh}: WalletProps) {
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
    <header><div><h2>Your purse</h2><p>Local game account · {world.profile}</p></div>
      <button type="button" disabled={busy || working} onClick={() => void reload()}>Refresh wallet</button></header>
    <p>Demo custody: the operator controls these profiles. Game credits are not real money.
      No external wallet is connected.</p>
    <p role="status">{notice?.profile === world.profile ? notice.text : working ? 'Refreshing wallet…' : ''}</p>
    {!wallet ? <p>Wallet data unavailable for this profile. Refresh to load its authoritative balance.</p> : <>
      <dl className="wallet-balances">
        <div><dt>Purse · available credits</dt><dd>{wallet.purse ?? 'Unavailable'}</dd></div>
        <div><dt>Reserved run fees</dt><dd>{wallet.reservedRunFees}</dd></div>
        <div><dt>Pending maker fees</dt><dd>{wallet.pendingMakerFees}</dd></div>
        <div><dt>Pending recovery wages</dt><dd>{wallet.pendingRecoveryWages}</dd></div>
      </dl>
      <p>Reserved run fees have already left your purse; they are not deducted again here.
        Maker fees and recovery wages are not spendable until settlement.</p>
      <p><strong>{wallet.ownedItemCatalogValue} catalog value</strong> across {wallet.ownedItemCount} available town items.
        This is not cash or a sale quote. Listed, funded, crafting and expedition items are excluded.</p>
      <h3>Awaiting confirmation</h3>
      {wallet.unresolved.length ? <><p>These operations have no final receipt. Their cash effect is not estimated. Refresh to reconcile.</p>
        <ul>{wallet.unresolved.map(op => <li key={op.id}><strong>{op.action.replaceAll('_', ' ')}</strong> · {op.status}<code>{op.id}</code></li>)}</ul></>
        : <p>No unresolved operations recorded for this profile.</p>}
      <h3>Run fee history</h3>
      <p>Exact fees from authoritative run records for you as player or edition maker.
        Active player fees are reserved; active maker fees are pending income. Settled maker fees have been paid.
        Voided runs are excluded: their fees are refunded to the player, not paid to the maker.</p>
      <p>This is not a complete cash ledger. It excludes trades, crafting wages, initial allocations and void refunds.
        Records follow snapshot order, not payment date. Playing your own edition shows both roles.</p>
      {wallet.runFeeHistory?.length ? <ul className="wallet-receipts">{wallet.runFeeHistory.map(entry => <li key={`${entry.runId}:${entry.role}`}>
        <div><strong>{entry.role === 'player' ? 'Outgoing entry fee' : 'Incoming maker fee'} · {entry.amount} credits</strong>
          <span>{entry.status === 'active' ? entry.role === 'player' ? 'Reserved' : 'Pending' : 'Settled'}</span></div>
        <code>{entry.runId} · {entry.editionId}</code><p>Role: {entry.role} · Run: {entry.status}</p>
      </li>)}</ul> : <p>No non-void run fee records available for this profile.</p>}
      <h3>Operation receipts</h3>
      <p>Confirmed results for this profile’s operations saved by this server, newest recorded first.
        This is not a complete cash ledger; incoming payments and initial allocations may not have a receipt here.</p>
      {wallet.receipts.length ? <ol className="wallet-receipts">{wallet.receipts.map(receipt => <li key={receipt.id}>
        <div><strong>{receipt.action.replaceAll('_', ' ')}</strong><span>{receipt.status}</span></div>
        <code>{receipt.id}</code><p>{receipt.result}</p>
      </li>)}</ol> : <p>No confirmed operation receipts recorded yet.</p>}
    </>}
  </section>;
}
