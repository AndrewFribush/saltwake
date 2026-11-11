# Wallet crafting and recovery integration

Wallet mode now prepares a durable challenge before returning an unsigned account transaction. Preparation and Outbox persistence share one SQLite transaction. The player authorizes the exact inputs, batch ID and commitment. The contract binds the batch to the account/request operation ID and replaces the submitted zero deadline with chain time plus120 seconds after checking receipt replay. Submitted-command hashes remain unchanged. An existing request cannot reroll its challenge or reset its window.

HTTP exposes the confirmed batch to its authenticated owner. The saved minigame state, timing inputs and sequence numbers survive a server/controller restart. Only the result oracle can finish the batch. Recovery outputs go to the bank and the reserved wage goes to the player; ordinary crafting outputs remain owned and tradeable. Terminal/retry operation IDs use bounded hashes for wallet batches; existing demo IDs remain compatible.

## External starts and recovery

Final configured-chain snapshots discover wallet batches started outside the preparation flow. Ownership, source locations and recipe are checked. No challenge, timing inputs, successful minigame or local start receipt is invented. These batches reject minigame actions and settle at normal quality after the confirmed chain deadline. The workbench explains why the minigame is unavailable.

A direct transaction may use the same account/request ID with a different valid commitment or inputs than the locally prepared intent. Discovery preserves that conflicting preparation separately and follows the actual chain batch as expiry-only. Exact matching prepared batches can confirm from final snapshot evidence even while receipt polling is unresolved.

Terminal observations are durable and atomic with imported results; stale active snapshots cannot resurrect finished work. A tested interrupted terminal import rolls back both marker and row changes. Both server wall-clock expiry and final chain-clock reconciliation are available; premature expiry retries once after the chain deadline.

## Capacity

Prepared history retains its64-record prototype cap. Discovery has separate headroom for the contract's64 lifetime batches, allowing up to128 total saved craft rows. New ordinary queue operations retain the256-operation cap and terminal reserves. Final-snapshot discovery can reveal work after those slots have filled: a bounded emergency lane, up to512 total local operations, accepts only matching-owner, matching-kind oracle finishes for persisted confirmed unfinished batches. It does not authorize new player spending. Prepared batches also qualify so discovered settlements cannot consume their prior reservation. The contract's own receipt and terminal reserves remain authoritative.

These are bounded prototype limits, not public-scale storage management. Unknown signed transactions retain their existing nonce/recovery protections. The result oracle and contract upgrade authority remain trust assumptions. Per-account recovery limits are not Sybil resistance.

## Evidence

- Actual WASM authority tests:8 passes, plus1 focused extracted-supplies → ordinary crafting → output listing proof.
- Controller/queue tests cover prepared restart and deadline adoption, missing challenges, normal expiry, bounded retry IDs, stale terminals, source ownership, atomic import, conflicting preparation, queue exhaustion and preservation of prepared terminal reservations. Latest focused review regressions:18 passes (7 player-craft plus11 queue tests).
- The real-wallet HTTP test covers NEP-413 registration, immutable unsigned preparation, account-signed start, restart mid-step, gameplay completion, bank output/wage accounting, direct unprepared recovery discovery, chain-time expiry and terminal replay. It checks exactly two oracle terminal signatures and zero operator starts.
- Full server run:141 passed,0 failed. The additional prepared-reservation test passed in the18-test focused run and is not included in141. Final typecheck/build and diff checks passed. Logs:docs/evidence/wallet-crafting/.

No persistent demo refresh, testnet operation or external deployment occurred. Browser wallet adapter/login and transaction UI remain unfinished. The browser transport is tested in isolation; HTTP/contract evidence does not establish browser acceptance or enjoyment.
