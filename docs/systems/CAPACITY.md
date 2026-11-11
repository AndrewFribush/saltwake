# Capacity: bounded storage for a long-lived world

Branch `feat/capacity`. Contract: `contracts/economy/src/{compact,receipts}.rs`, wired in `lib.rs`.
Server: `apps/server/src/{outbox,history-archive,craft,runs,http,main}.ts`.

## The problem this fixes

Before this change the contract capped records over the whole life of a world and never freed a slot:
64 runs, 64 listings, 64 craft batches, 32 editions and 256 receipts in total. A public world stopped
admitting runs after its 64th run, stopped listing after its 64th listing, and stopped accepting any
operation after its 256th receipt. The server outbox mirrored the 256-receipt lifetime cap, and the
server's craft store capped 64 craft requests in total. `init_simulation` raising the receipt cap was a
stopgap for long simulations, not a fix.

## Design

### Caps apply to active records only

| Record | Active cap (error) | Terminal records kept on chain |
|---|---|---|
| Runs | 64 active runs (`RunCapacity`), 4 per edition (`max_runs`) | newest 64 settled or voided |
| Listings | 64 active listings (`ListingCapacity`) | newest 64 sold or cancelled |
| Craft batches | 64 active batches (`BatchCapacity`), 1 per profile | newest 64 finished (by deadline) |
| Editions | 32 open editions (`EditionCapacity`) | newest 16 closed (plus any a town building points at) |
| Commissions | 32 open (`CommissionCapacity`) | newest 32 filled or cancelled |
| Wallet profiles | 128 (`Wallet profile capacity exhausted`), unchanged | profiles hold balances and are never pruned |

After every committed (`Applied`) command, `Economy::compact` prunes terminal records beyond the kept
history. Pruning is safe because terminal records are immutable and nothing live refers to them:

- Items never point at a terminal run, listing or batch (settlement, cancel, sale and finish move every
  item out). A closed edition holds no items (closure banks them). The audits in
  `tests/contract/long-lived.test.ts` check every item location against kept, active records.
- A pruned edition takes its settled runs with it, and leaves the retired list.
- A pruned listing leaves every shop's `listing_ids` and its private-offer reservation key is removed.
- Ids are never reused. Runs and editions already used counters. Listings and commissions used to be
  numbered by map length, which pruning would make collide (and a private-offer reservation would then
  attach to the wrong listing), so they now use counters in their own storage keys
  (`next_listing.v1`, `next_commission.v1`). On first use, or before the first prune, a counter starts
  one past the largest existing number, which equals the old map length.
- A finished batch can be pruned while its `crafted-<id>-<n>` outputs live on. `BeginCraft` refuses a
  batch id whose outputs still exist (`BatchExists`), so a reused id can never collide with live goods
  and strand its inputs in `crafting`.
- Items are not pruned and need no cap: nothing issues goods at runtime except recipes, and a recipe
  consumes two issued materials for each output, so the item map is bounded by initial issuance
  (at most initial items plus half the initial herbs and flasks).

### Receipts: exactly-once without unbounded storage

Receipts are the duplicate-prevention mechanism: an op id is bound to the hash of its command, and a
replay returns the recorded outcome instead of executing again. Receipts now live in two tiers:

1. **Recent tier** (main state map `receipts`, layout unchanged): the newest `receipt_cap()` full
   receipts (256 on every normal world). Insertion order is kept in `receipt_order.v1`.
2. **Tombstones** (own storage keys): when a receipt leaves the recent tier it becomes a tombstone under
   `rx1:<first 16 bytes of sha256(op_id)>` holding the full payload hash, status, result and the time it
   was written. A FIFO ring (`replay_ring.v1` plus 64-entry pages `rp1:<n>`) orders them. Normal worlds
   keep up to **4,096 tombstones** and never forget one younger than **72 hours**
   (`replay_window.v1`; only the local-sandbox seed `init_demo_capacity_test` can set other values, and
   only at init).

`execute`/`execute_player` check both tiers before anything else. A replay found in either tier returns
the recorded receipt (a tombstone replay omits the `run` copy) and changes nothing; a different payload
under the same op id panics (`Operation payload conflict`). The `operation(op_id)` view answers from
both tiers. Each call forgets at most four tombstones that are past the minimum age, oldest first.

**Guarantees**

- **G1, no early forgetting.** Once an op id has a receipt it can never execute again while that receipt
  is in the recent tier, and afterwards for at least 72 hours after it became a tombstone, so for at
  least 72 hours after its execution.
- **G2, refuse instead of forgetting.** If a new receipt would need a slot held by a tombstone younger
  than 72 hours, the contract refuses the new operation before any state change (`Receipt window full`).
  Terminal headroom works exactly as before: ordinary work needs `1 + reserved` free slots, where
  `reserved` counts active runs, active listings, active batches and open editions, so settlement, void,
  finish and closure always fit (`ReceiptCapacityReserved`). The window is a rate limit of 4,352
  receipts per 72 hours, not a lifetime cap.
- **G3, server never re-signs late.** Operator operations are signed only by the outbox, which persists
  each signature before broadcasting it, so a never-signed operation cannot have executed and may be
  signed at any time. Replacement signatures are made only within 12 hours of the operation's first
  signature (`RESIGN_CUTOFF_MS`, `firstSignedAt`). A NEAR transaction is valid for 86,400 blocks after
  its reference block (about 14 to 29 hours at testnet block times), so every signed copy lands within
  about 41 hours of the first signature, and execution cannot precede that signature: G1's 72 hours
  cover every copy. An existing signature may still be rebroadcast after the cutoff (it expires on its
  own). An operation that would need a replacement after the cutoff becomes `Unknown` with "operator
  recovery required" and is never signed again.
- **G4, upgrade.** Rows written before `createdAt` existed are dated on first sight after the upgrade
  (and a previously signed legacy row uses that date as its first signature).
  That is safe because at upgrade time the contract has forgotten nothing: every old receipt is still in
  the recent tier and only starts its 72 hours when it becomes a tombstone.

What is not guaranteed: after its tombstone is forgotten (72 hours or later), an op id is unknown again,
and a brand-new transaction carrying it would execute. The operator outbox cannot produce one (G3).
Wallet-signed player requests are signed by the player; the web client keeps an interrupted request in
`sessionStorage` and retries it with the same id until it resolves, so a tab left open for more than
three days with an unresolved request is the remaining case. Every action that moves specific goods
(buy, sell, list, publish, settle, finish) also fails naturally on replay because the goods have moved;
admissions and commission posts are the actions that would repeat.

### Server

- **Outbox window.** Capacity counts operations that still occupy the contract's window: unresolved ones
  always, resolved ones for 72 hours after creation (`createdAt`). Old resolved rows stop counting, so a
  long-lived server never stalls on lifetime totals. The default capacity stays 256 for tests;
  `main.ts` and `scripts/simulate.ts` read the contract's `capacity` view and pass recent + tombstone
  slots. Terminal headroom and the emergency lane for confirmed batches are unchanged.
- **Tombstone receipts.** A receipt first observed after it left the recent tier has `run: null`.
  `Runs.materialize` then takes the run from the snapshot by the receipt's result id; the HTTP sync skips
  such an admission unless the run is still active or already saved locally.
- **History archive** (`history-archive.ts`). History views (edition records, business ledger and
  account, run fee history, shop records) were computed from the snapshot's terminal records. The server
  now keeps a bounded copy of every terminal record it sees (1,024 runs, 256 listings, 256 batches,
  128 commissions, 64 editions; oldest dropped first) and merges the ones the chain has pruned back into
  the snapshot from `main.ts`'s `readSnapshot`. The chain wins for any record it still holds, a shop
  regains pruned listing ids only when owner and seller still match, and nothing in the archive feeds a
  safety decision. A record pruned on chain before the server ever polled it (more than 64 newer terminal
  records of its kind in between) is not recoverable.
- **Craft store.** `MAX_CRAFT_REQUESTS` (64) now bounds open requests; rejected and finished requests
  never block new crafting.

### Snapshot compatibility

The snapshot shape is unchanged; pruned records simply stop appearing. Consumers that counted terminal
records from the raw chain snapshot were updated: the server through the archive, and
`scripts/simulate.ts` now counts runs that are new since the previous day instead of differencing totals.
A new `capacity` view reports live counts, active caps, kept history and the receipt window.

### Old deployed state

No migration call. The main state layout, rules versions and Borsh action indices are unchanged (no
action added; the last index is still 27, `CancelCommission`). New storage keys start empty and are
initialised lazily: the receipt order from the existing map, the listing and commission counters from
the largest existing number. Closed editions beyond the kept 16 are pruned at the first applied command
after the upgrade. `tests/contract/capacity-upgrade.test.ts` deploys the pre-capacity build
(`tests/fixtures/economy-pre-capacity.wasm`, commit 8f4c96a), upgrades in place and checks that the
snapshot is unchanged, old receipts replay, and new listing, commission and run ids continue past the old ones.

## Storage bound

NEAR charges 1 NEAR of storage stake per 100 kB, and counts 40 bytes of overhead per storage record.
Sizes are Borsh bytes; "typical" is the demo town and public testnet seed, "worst" uses the largest
inputs the contract accepts.

| Part | Records at steady state | Bytes per record, typical / worst | Bound, typical / worst |
|---|---|---|---|
| Recent receipts (main state) | 256 + order key (256 ids) | 200 (530 with a run copy) / 600 | 85 kB / 170 kB |
| Tombstones (key 20 + value 65..117 + 40 overhead) + ring entry 21 | 4,096 | 146 / 198 | 600 kB / 810 kB |
| Runs | 64 active + 64 kept | 350 / 11 kB (64 sockets, long ids) | 45 kB / 1.4 MB |
| Listings | 64 active + 64 kept | 200 / 6.4 kB (128 items) | 26 kB / 820 kB |
| Batches | 64 active + 64 kept | 500 / 650 | 64 kB / 83 kB |
| Editions | 32 open + 16 kept closed | 10 kB / 131 kB (largest v9-v13 publication) | 480 kB / 6.3 MB |
| Commissions (one key) | 32 open + 32 kept | 300 / 1.1 kB (32 deliveries) | 19 kB / 70 kB |
| Private-offer reservations | at most kept listings | 100 | 13 kB |
| Items | bounded by issuance (public seed: 275 issued, at most 403) | 70 | 28 kB |
| Profiles, balances, recovery jobs, buyer totals | at most 128 wallets + seeded profiles | 150 | 21 kB |

Typical steady state for a busy world is about **1.4 MB (about 14 NEAR of storage stake)**, dominated by
the 72-hour receipt window; a quiet world holds only the tombstones of its last 72 hours (for example
300 operations a day keep about 900 tombstones, about 130 kB). The worst case is about **9.7 MB**, and
6.3 MB of that is open editions with maximum-size custom floors, which was already possible before this
change. The contract account must hold enough NEAR for the bound it is expected to reach, or writes fail
with `LackBalanceForState`.

One kind of record still grows with use: `coin_purchase.v1:<op>` idempotency keys for NEAR buy-ins (about
130 bytes each, needed to make a NEAR payment exactly-once). Each purchase pays at least 0.01 NEAR, about
eight times its own storage stake, so this growth is paid for by the purchases themselves.

The per-call cost is also bounded now: every command loads and rewrites the main state, which no longer
grows with lifetime totals.

## Evidence

- `tests/contract/long-lived.test.ts`, test 1 (capacity seed: 32 recent receipts, 4,096 tombstones, 1 hour):
  210 runs (settled and voided), 120 listings over 90 cycles (cancelled, or sold and bought back),
  80 craft batches, 20 editions opened, retired and closed, and 40 commissions (filled and cancelled):
  about 960 operations. A conservation and integrity audit runs every 40 operations and at the end
  (coins across purses, bank, run and commission escrow; every seeded good kept; only recipe outputs
  added; every item location points at a kept, active record; shops never point at pruned listings).
  At the end the chain holds exactly 64 runs, 64 listings, 64 batches, 17 editions and 32 commissions;
  run, listing and commission ids were never reused; every pruned receipt is a tombstone. Replaying eight
  pruned op ids returns their recorded outcomes and leaves the snapshot byte-identical; a different
  payload under a pruned op id is refused; and a pruned batch id is refused (`BatchExists`) while its
  outputs live.
- Test 2 (4 recent receipts, 4 tombstones, 1 hour): ordinary work stops at `ReceiptCapacityReserved`
  with terminal headroom left; a replay of the evicted publication creates no second edition; void and
  closure still complete; the next operation is refused with all 8 slots holding young receipts; after
  chain time passes the minimum age, exactly four new operations fit and the oldest op id is forgotten.
- `tests/contract/capacity.test.ts`: a 256-slot window (128 + 128) reproduces the old exhaustion test
  (252 fillers, then refusal; void and closure still complete) and receipts pushed out of the recent
  tier are still answered.
- `tests/contract/capacity-upgrade.test.ts`: in-place upgrade from the pre-capacity build, described above.
- `apps/server/test/outbox.test.ts`: resolved operations stop counting after 72 hours, unresolved ones
  never do, 511 operations pass the old 256 lifetime cap, legacy rows are not counted; an operation's
  first signature may come any time, a failed transaction is replaced within 12 hours of it and never
  after; legacy rows are dated on first sight; a tombstone receipt with `run: null` resolves an
  operation with no signature.
- `apps/server/test/history-archive.test.ts`: pruned terminal records come back from the archive, the
  chain wins, shops keep their sales history only for the same owner, and the archive is bounded.
- `apps/server/test/craft.test.ts`: 70 rejected requests never fill the craft store; 64 open requests do.
- `npm run simulate -- --days 30` on a normal world (`init_demo_extended`, receipt cap 256, no capacity
  scale), final build: all 30 days completed with zero conservation drift, 88 runs settled (old lifetime
  cap 64) and 281 receipts recorded (old lifetime cap 256), so the old contract would have stopped
  admitting runs, and then every operation, partway through. Final `capacity`: 0 active runs and 64 kept,
  5 active listings and 11 kept, 6 batches kept, 3 open editions, 7 commissions, 256 recent receipts and
  25 tombstones (of 4,096).
- Under machine load (other lanes' sandboxes running) some existing contract tests time out in
  `sandbox_fast_forward` (a 30-second client abort); each was rerun alone and passed. `S17 support
  exhaustion` takes the same 65 s on this build and on the pre-capacity build when run alone.

## Next step

Coordinator: review, merge, and (with Andrew's approval) redeploy testnet with this build. No migration
call is needed; make sure the contract account's balance covers the storage bound above.
