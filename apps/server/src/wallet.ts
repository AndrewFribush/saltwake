import {catalog} from '../../../packages/shared/src/catalog';
import type {EconomySnapshot} from '../../../packages/shared/src/types';
import type {WalletView} from '../../../packages/shared/src/wallet';
import type {Store} from './db';

/** Read authoritative balances, never reconstruct cash from quotes or optimistic commands.
 * Active run fees have already left the purse. Pending maker fees/wages are not cash.
 * Receipt coverage is intentionally limited to this server's persisted actor operations.
 */
export function walletView(world: EconomySnapshot, db: Store, profile: string): WalletView {
  const sum = (amounts: string[]) => amounts.reduce((total, amount) => total + BigInt(amount), 0n).toString();
  const active = world.runs.filter(run => run.status === 'active');
  const editions = new Set(world.editions.filter(edition => edition.maker === profile).map(edition => edition.id));
  const owned = world.items.filter(item => item.location.kind === 'owned' && item.location.profile === profile);
  const operations = db.operations().filter(op => op.command.actor === profile);
  return {
    profile,
    purse: world.credits[profile] ?? null,
    reservedRunFees: sum(active.filter(run => run.player === profile).map(run => run.fee)),
    pendingMakerFees: sum(active.filter(run => editions.has(run.edition)).map(run => run.fee)),
    pendingRecoveryWages: sum(world.batches.filter(batch => batch.actor === profile && batch.recovery && batch.status === 'active').map(batch => batch.wage_reserved)),
    ownedItemCount: owned.length,
    ownedItemCatalogValue: sum(owned.map(item => String(catalog[item.item_type].value))),
    // Snapshot run records are authoritative even when the other party submitted
    // settlement. Void refunds are excluded, never counted as maker revenue.
    runFeeHistory: world.runs.flatMap((run): WalletView['runFeeHistory'] => {
      if (run.status === 'void') return [];
      const entry = {runId: run.id, editionId: run.edition, amount: run.fee, status: run.status};
      return [
        ...(run.player === profile ? [{...entry, role: 'player' as const}] : []),
        ...(editions.has(run.edition) ? [{...entry, role: 'maker' as const}] : []),
      ];
    }),
    receipts: operations.flatMap(op => {
      const receipt = op.receipt;
      if (!receipt || (receipt.status !== 'Applied' && receipt.status !== 'Rejected') ||
          receipt.status !== op.status || receipt.op_id !== op.id || receipt.payload_hash !== op.hash) return [];
      return [{id: op.id, action: op.command.action.type, status: receipt.status, result: receipt.result}];
    }).reverse(),
    unresolved: operations.flatMap(op => op.status === 'Pending' || op.status === 'Unknown'
      ? [{id: op.id, action: op.command.action.type, status: op.status}] : []).reverse(),
  };
}
