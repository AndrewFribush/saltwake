# Independent creator loot pools

Creators can name a pool for each random encounter. Matching names share a draw pool; different names isolate stock. Treasure assigns every selected physical item to either fixed funding or one named random pool. Moving an assignment removes it from the previous pool. Complete-copy capacity is the minimum supported by every required fixed type and random table, not total stock divided by total draws.

## Limits and compatibility

Pool IDs are 1–40 UTF-8 bytes with no surrounding whitespace. The builder enforces the existing contract limits: at most 16 tables, 16 draws per table and 128 total opening goods. Prototype-key names are handled as data through Maps and own-property checks. Stale assignments to renamed/removed pools block publication rather than silently rerouting goods. Unselected IDs cannot be committed. Draft changes clear transient assignment/sample choices; owned inventory IDs are not exported with the design.

Blueprint v6 preserves explicit names. Legacy unnamed random placements retain the `creator-loot` pool. Named-pool metadata is rejected in older blueprint formats rather than merged silently. Draft format v6 retains unfinished text for repair; publication and rehearsal still require valid pool configuration.

Each pool has a synthetic rehearsal type. Every random socket in that pool receives that type in rehearsal; this is deliberately not a simulation of finite without-replacement draws, current stock or odds. Samples are cloned into trial records and displayed in a paginated Samples view. Actual play uses exact contract-reserved goods. Business rehearsal still models uniform complete copies, not unequal surplus stock in individual pools; confirmed accounts report actual committed funding.

Published editions already support per-table replenishment through the Maker Stock view. No new contract schema or operation was required.

## Evidence

- 124 game tests: exclusive funding, least-pool capacity, missing/invalid names and limits, explicit blueprint roundtrip, prototype-safe sample lookup and immutable sample capture.
- 86 server tests. The new real local-contract test funds blades and medicine separately, admits concurrent profiles, proves insufficient medicine blocks entry despite spare blades, replenishes each table without reallocating active goods, retries both local and on-chain refresh receipts, rejects a fresh request to redeposit the same goods, and returns carried and unvisited items to their original pools after abandonment. It audits conservation throughout.
- Typecheck and asset build pass.
- Aside browser verifies desktop/phone Pools and Treasure panels, transfer of one selected good between pools and resulting capacity, separate trial samples, saved-name reload and 40-byte pool-name fit. Browser selection changes do not publish or transfer economic goods.
- Independent read-only helper/schema/UI review found no concrete correctness issue; it is separate from passing tests.

Evidence: `docs/evidence/loot-pools/`. No contract upgrade, world reset, testnet transaction, paid call or production action occurred. This is an authoring capability and economic correctness result, not a human enjoyment or organic demand claim.
