import type {EconomicRun} from './types';

/** Amounts are integer local-game credits, encoded as strings without precision loss. */
export type WalletView = {
  profile: string;
  purse: string | null;
  reservedRunFees: string;
  pendingMakerFees: string;
  pendingRecoveryWages: string;
  ownedItemCount: number;
  ownedItemCatalogValue: string;
  runFeeHistory: {runId: string; editionId: string; role: 'player' | 'maker'; amount: string; status: Exclude<EconomicRun['status'], 'void'>}[];
  receipts: {id: string; action: string; status: 'Applied' | 'Rejected'; result: string}[];
  unresolved: {id: string; action: string; status: 'Pending' | 'Unknown'}[];
};
