# Fixed economy evidence — 2026-11-10 UTC

## Result

Implemented and locally verified M07, M09, M10, M11, M12, M13 and M21. Final sandbox suite: **13 passed, 0 failed, 0 cancelled**, 86.77 seconds (`economy-verified-tests.txt`). Game suite: **29 passed** (`game-tests-latest.txt`). Typechecking includes shared/game/web/scripts/contract tests. Rust WASM and Vite builds pass; git diff whitespace check passes.

The browser is still the free two-room practice game. This contract is exercised by actual WASM transactions in isolated NEAR sandbox2.13.4, not by a mocked ledger. No paid inference, testnet, external deployment, publication, or real customer funds were used.

Artifact: 592339 bytes, SHA256 `6f86af3335dae15a0fbb0d2fd5558c2404e64a8d06ba00b489d270eb39b72c35`. Rust1.93.0 / near-sdk5.29.1 / locked dependency graph. Older smoke artifact/hash in toolchain.md describes the preceding checkpoint, not this build.

## What the tests establish

- Rust/TS catalog, prices, consumability, duration/concurrency constants, Borsh command hashes and Rust JSON roundtrips agree. Includes large u64, maximum u64, Unicode, null reward and explicit no-reward offers; receipt hashes match submitted commands.
- Publication locks exact owned stock, charges computed costs once, validates bounded terms and requires funding for a complete reward bundle. Invalid/unowned/duplicate/insufficient funding makes no economic changes. Repeated rejected command returns its original rejection.
- Two concurrently submitted admission requests competing for one bundle produce one paid run and one uncharged rejection; on-chain transactions still execute serially. Three funded copies support three runs. Self-entry, stale quotes, reused profile/loadout and fifth concurrent run reject. Technical caps also apply to zero-reward editions.
- Admission receipts contain exact immutable assignments, locked loadout and block-time-derived deadline; fees are escrowed in active runs.
- Exact item partitions reject missing/duplicate/wrong-origin IDs, equipment consumption, inconsistent carried-set claims and premature expiry. Extraction, death, void and actual expiry move items/credits under their declared rules. Re-entered extracted gear becomes town risk and forfeits on later expiry.
- Void refunds fee/surviving town stock and preserves consumable loss. Void can settle after edition cutoff. Closure rejects before cutoff or while active reservations exist, then banks leftovers once without refunding maker funding.
- Replaying accepted operation IDs returns original receipts; conflicting payloads reject. Fresh second terminal settlement/closure rejects.
- Conservation checks after each normal fixture operation reconcile 150 seeded credits across profiles, bank and active fee escrow; all14 seeded item instances; exact run↔item locks; fixed pool provenance; funded reference values; and active edition/run relationships. A seeded permutation exercises extraction/death/void together before closure.
- Actual receipt exhaustion is tested: after publish/admit, exactly252 recorded validation rejections fill all unreserved capacity; a new command cannot consume reserved headroom, but valid void and close still succeed. `capacity-final.txt` independently records the strengthened test.

## Review and fixes

Claude independently read the contract/types/tests (`claude-economy-review.md`); it did not execute them. Its most important finding, exhausted receipts stranding paid runs, was reproduced before the fix and then covered by the actual-capacity sandbox regression. Every active run now reserves one terminal receipt and each open edition one closure receipt. Removed the legacy debit wrapper and tombstoned enum index0; private initialization prevents outsider capture. Added missing view types, constant/hash parity and reverse invariant checks. The reviewer saw a slightly earlier snapshot; the report is not a claim that every final edit was re-reviewed.

Preserved late extraction/void submission intentionally: durable pre-deadline results may arrive after a network outage. The contract trusts operator gameplay assertions; the future server must enforce the gameplay deadline. Declared carried-item equality proves consistency, not honest acquisition. These choices follow the design's recovery semantics.

Intermediate logs are retained, including failing red tests, an insufficient block advance and timed-out sandbox cleanup. They are not final verification. Diagnosing a live isolated node showed expiry had already settled correctly while graceful shutdown hung. The fixture now gives only its own child process five seconds to exit before force termination, then finishes sandbox cleanup. The final suite has no cancellation.

## Limits and next work

This is a bounded, operator-custodial, fixed-reward test economy. Credits/items are disclosed seed grants; no real sale or demand is demonstrated. Contract cap32 editions/64 lifetime runs/256 receipts is not production scaling. Random rewards, refresh, price changes, shops and crafting remain separate unchecked tasks. Existing socket IDs are bounded interface slots; maker geometry/editor integration is still pending.

Durable signed-transaction outbox, authenticated demo sessions, gameplay-to-admission/settlement integration, restart recovery and deadline worker are M14–20. Neither contract atomicity nor sandbox success proves those work. M08 gameplay tuning remains open. No external readiness or full-game completion claim.

Reproduce: `npm ci`, installed pinned Rust toolchain/wasm target, then `npm run verify`. First use may download sandbox tooling. Only disposable local sandbox chains are started.
