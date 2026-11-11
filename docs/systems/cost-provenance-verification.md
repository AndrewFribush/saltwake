# Prospective cost provenance

Implemented a local single-writer observation journal around Outbox submissions. Before signing a new operation, it persists the current snapshot and cost state. After a matching Applied receipt, it observes ownership and records the derived state/disposals atomically. Accounting observation failures never change an Applied transaction to Unknown or cause a fresh economic request. Recovery revisits confirmed operations with an unfinished cost capture. Duplicate observations are idempotent; a revision guard prevents a late old capture from restoring stale basis.

## Accounting policies

- Existing or unobserved goods begin with unknown cost. Catalog value is never acquisition cost.
- Confirmed purchases establish exact integer cost; resale removes the seller's basis and establishes the buyer's paid basis.
- Listing, packing and beginning a craft retain economic ownership/basis.
- Completed crafting transfers input cost to outputs; all costs must be known. Integer division plus remainder assigned by sorted output ID preserves the exact total. If any input is unknown, output cost remains unknown.
- Publishing and replenishing expense committed treasure once. Returning unused dungeon goods to their funded pool does not reopen maker lots. Closure has no maker refund.
- Town consumption/forfeiture removes the player's basis. Extracted treasure has unknown basis; entry fees remain run-level cash expenses and are not arbitrarily allocated to finds.
- Unexpected ownership changes reset current basis to unknown. Reports label scope and continuity gaps. Funding predating observations is counted as unknown funding, not omitted or free.
- Per-edition contribution is settled nonvoid fees minus placement and committed treasure cost, and remains unknown if any committed goods lack cost. Active fees are pending. The report excludes time and external costs.

## Evidence

`docs/evidence/cost-provenance/server-tests.txt`: 75 passing server tests. This includes the actual local NEAR-contract sequence: procure four materials for 8 credits → craft two outputs at 4 cost each → sell one for 7 → fund the other at cost 4. Seller matched contribution is 3; buyer basis is 7; funding expense is 4. Restart/retry does not repeat expenses.

Other cases cover unknown inputs, odd integer allocation, losses, extracted unknown basis, historic unknown funding, pending/void fees, closure, ownership discontinuity and interrupted accounting after transaction confirmation. Existing Outbox, run and wallet tests remain passing.

Typecheck and web build pass. Browser wallet Stock costs / Trading result / Cost rules and maker Accounts fit 1366×768 and 390×844 without page scrolling or offscreen controls. The first maker layout overflowed on phone and was corrected by removing unrelated metadata and separating Account rules. Evidence scripts/output are in the same directory.

The first contract test used the small seed fixture, which contains no materials. It was corrected to the explicit extended economy fixture; no persistent world reset or extra issuance was performed.

## Limits

This is prospective local single-writer accounting, not independently authenticated chain event ordering or a historic ledger rebuild. The captured observation records are retained for audit/restart; no claim is made to recover missing history. An external operator executing unseen round-trip transfers between observations is outside the single-writer assumption; public multi-signer use needs authoritative sequence/event data before these accounts can certify coverage. Missing accounting captures can omit historical sales/losses, which the UI discloses. Trading contribution includes bank and seeded NPC sales, not just organic demand. It is not overall business profit.

No contract code/schema change, testnet write, deployment, paid call or world reset was required. The local API was restarted against its existing state to enable journal observation. Human enjoyment and builder acceptance remain separate gates; accounting correctness does not pass them.

## Independent review correction

Independent source review found an internal single-writer gap: if both observation callbacks failed around a sale and repurchase, unchanged final ownership could restore the old known basis. Applied operations without journal entries now invalidate continuity in reports and subsequent observations. Recovery includes those operations even when no baseline capture exists, records unknown costs conservatively and never rebroadcasts them. Four variants cover absent/present prior capture, restart, later observation, repeated recovery and subsequent funding. This corrects an actual reporting bug, not the separate external multi-signer limitation.
