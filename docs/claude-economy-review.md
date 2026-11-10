I reviewed only the pasted source. I did not compile the contract, run any test, or compare the paste against the working tree.

The rules mostly hold as written. The Borsh field order and enum indices in `protocol.ts` match the Rust `Command` for all six actions. Partitions, consumable-only consumption, the loss and void destinations, fee escrow and refund, self-entry, the 4-per-edition and 1-per-profile caps, and the closure preconditions are all enforced. The problems are below.

## Correctness flaws

1. **Receipt capacity can strand active runs permanently (highest impact).** Every command counts against the 256-receipt cap, rejections included. Settle, Void and FinalizeClose get no reserved headroom.
   - Repro: publish, then submit 253 rejected commands under distinct op IDs (for example Debit with amount 0). Admit buyer as receipt 256. That admission is Applied, but settle and void for `run-0` now panic with "Receipt capacity exhausted".
   - Result: the club stays in loadout, three rewards stay reserved, the 3-credit fee stays escrowed, and `finalize_close` can never run.
   - Fix: reserve one terminal receipt per active run and per open edition when admitting or publishing. Alternatively, let terminal commands on live targets bypass the cap.
   - Related: `runs.len()>=64` and `editions.len()>=32` also count terminal entries, so both are lifetime caps. They only block new work, not existing state.

2. **The deadline does not bind any outcome except Expired.** After `deadline_ms`, the operator can still submit Extracted, so the player keeps the rewards. They can also submit Void, which refunds the player and leaves the maker unpaid.
   - Repro: admit, fast-forward past 900 s, then settle as Extracted with `maker-sword-0`. It is Applied.
   - Combat is trusted, but the deadline is something the contract can check itself. Decide whether non-Expired outcomes, or at least Extracted, should be rejected after the deadline.

3. **Debit is still a live, hashed Action.** Through `execute`, the operator can move any profile's credits, the maker's included, into the bank. No rule in your list allows that.
   - Deleting the variant later shifts every Borsh index after it. That breaks TS parity and every stored `payload_hash`. Replace it with a tombstone variant that always rejects.

4. **The compatibility `debit()` method breaks "rejections persisted".** Its `assert_eq!` panics after `execute` has inserted the Rejected receipt, so the whole transaction reverts, receipt included.
   - Repro: maker publishes (balance 91). `debit('d1','maker',92)` panics and leaves no receipt. Buyer admits and extracts, so maker reaches 94. The same op ID with the same payload now applies.

5. **`init_demo` is not `#[private]`.** On anything other than a local sandbox, whoever calls init first becomes the operator. This is low risk while the demo stays local.

## Test and audit gaps

**Rejections are checked by status, not by reason.** Several negative tests would still pass if the check they target were deleted:
- `early-expired` keeps `town_returned` and `dungeon_extracted`, so IllegalDestination rejects it even without PrematureExpiry.
- `past` is also invalid because closes is before opens.
- `again` never asserts TerminalRun.

Assert `r.result` in every negative test.

**`unacquired` proves nothing about acquisition.** The carried set and `dungeon_extracted` both come from the same command, so the check is self-consistency only. On loss outcomes the carried set is validated and then discarded. That is acceptable under a trusted operator, but the test name overstates it.

**The admission race may be flaky and is not a real race.** Two concurrent calls from one access key can collide on nonce, which I have not verified. NEAR also orders the two calls anyway, so the test proves sequential behavior.

Missing tests:
- Expired after the deadline, and Abandoned. Neither happy path is tested.
- Void reason that is empty, whitespace-only, or over 200 bytes.
- Each IllegalDestination case: died with `town_returned`, extracted with `town_forfeited`, void or died with `dungeon_extracted`.
- WrongProfile and MissingRun on settle.
- A player-owned tonic in `town_consumed` (positive case), and a sword in `dungeon_consumed` (must reject).
- Carried set with a duplicate, a consumed ID, or an ID from outside the run.
- Conflicting-payload replay through `execute` for settle, publish and admit. Today only the Debit compatibility path tests this.
- Receipt capacity, plus the 64-run and 32-edition caps.
- Admission rejections: InsufficientCredits, BagCapacity, more than 8 loadout items, UnknownProfile, MissingEdition, and a loadout item that is Reserved or EditionFixed.
- Publish rejections: InsufficientCredits, UnusedFundingType, title too long, more than 4 modules, duplicate socket ID or slot, room out of range.
- Recycling: items returned via `dungeon_returned` are readmitted by a later run and reserved only once.
- FinalizeClose: WrongMaker, and closing an edition that never had runs.
- Hash parity for a `reward:null` socket, `no_reward:true` with empty sockets and funding, and a non-ASCII title. Also check that an executed receipt's `payload_hash` equals the TS `commandHash`.

`invariants.ts` gaps:
- It checks item→run but not run→item. An active run whose loadout or assignment items have moved would pass.
- It does not check that an `edition_fixed` item's `location.item_type` matches its own type, that it is in that edition's `funded_ids`, or that the edition exists.
- It does not check that closed editions have empty `active_runs`.

## Acceptance gaps

- **No TS types for view shapes.** There are no TS types for Receipt, Run, Edition or Snapshot, and `OperationStatus` lacks the `run` field, so the tests use `any` and those shapes are unchecked.
- **Two constants are unpinned.** `runDurationMs` and `maxRunsPerEdition` in `rules.ts` are not exposed by `rules()`. The contract hardcodes 900000 and 4, and no test compares them.
- **Partial funding is accepted.** Funding that is not a whole multiple of the bundle publishes successfully, and the surplus acts as replacement stock until close banks it. Confirm that matches what you mean by "exact stock."
- **Panics leave no receipt.** Oversized input, a bad op ID, a payload conflict, capacity exhaustion and deserialization errors all revert without a receipt. The server's Pending/Unknown handling has to treat a failed transaction as distinct from Rejected.