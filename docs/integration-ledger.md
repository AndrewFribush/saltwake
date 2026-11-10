# Checklist execution ledger

Plan: ../design/dungeon-economy/TASKS-MERGED.md. Baseline c36b427, 13/48 accepted.

- M14–M15: SQLite FULL/WAL outbox; one process writer; command/hash/seed and signed bytes persisted before broadcast. Unit failures observed before implementation; three unit tests now pass. Actual sandbox recovery test in progress.
- M16: delegated session capability implementation; five unit tests pass; HTTP/browser integration still pending.
- M22–M24: contract additions delegated; acceptance pending review and sandbox tests.
- Interface review M17–M19: contract assignment IDs must replace all practice item fixtures. Only receipt-confirmed admissions materialize; hidden rooms/rewards remain server-side. Gameplay uses the contract edition sockets, not practice enemies.
- Ruling: existing checklist/progress files are the durable ledger; do not duplicate the already completed 13 tasks into generated skill task files. No changes to their acceptance.
- M08 and M42 require independent human gameplay observation. Do not mark these complete based on automation.
- External testnet/publication steps M45/M47 still require exact destination/action authorization; continue all local prerequisites.

## Verified integration results

- M14/M15: SQLite outbox checks command/hash/seed before signing and signed identity before broadcast. Real WASM admission and terminal-death broadcasts survive process loss before response, recover same receipts, and charge/pay once. Confirmed failed transactions can be replaced under the same logical ID; nonce floors and bounded signature history retained. Receipt and local-outbox headroom both reserve terminal obligations.
- M16–M20: independent cookie sessions, actor spoof rejection, CSRF/host guards, confirmed admission materialization, durable sequence/action dedup, restart-preserved potion consumption, exact settlement partitions, expiry and premature-expiry recovery. Hidden seed and unopened assignments removed from terminal views. Unknown does not free inventory.
- Builder browser evidence: Aside funded the actual local edition, admitted buyer, played combat, equipped maker-sword-0, drank maker-tonic-0, and extracted. DOM settlement was Applied: town_returned buyer-club; dungeon_extracted maker-sword-0; dungeon_consumed maker-tonic-0; dungeon_returned maker-tonic-1. No simulation-only substitution for this browser path.
- Extended HTTP loop: separate maker/buyer/worker sessions craft real inputs into stock, list and purchase a tonic, admit the buyer, consume that purchased tonic during gameplay, extract, and pay one bounded recovery wage. Client-supplied fine tier/timing ignored.
- Full verify at first integration checkpoint: game40, contract29, server33, typecheck, WASM/web build all passed. Default parallel sandbox spawning initially caused timeouts; final runner caps contract/server test concurrency at two. Original capacity test passed independently in151.3s and inside capped suite in150.8s. Final proof log is separate from failed initial logs.
- Subsequent strengthening: actual terminal-broadcast restart and consumed-potion restart tests pass. Matcher/authoritative value counters are being verified separately before the final checkpoint.
- M08 user feedback explicitly rejected old gameplay as basic/not roguelike. New seeded exploration practice is a repair iteration, not accepted fun. Paid editions still use fixed templates. M25–27 cannot be claimed complete.

Final fresh source review found three additional defects. All are treated as real findings: (1) string-typed command fields accepted arrays in Borsh encoding, allowing an unrecordable contract deserialization failure to jam the signer; strict runtime string/array/u32 validation now occurs before persistence, and the full execute envelope is size-checked; (2) browser pendingAction survived a definitive 400 and endlessly resent an illegal move; it now clears on definitive 4xx while retaining transport-uncertain retries; (3) an extra itemId on an attack could equip and attack in one turn; action fields are now whitelisted and inventory dispatch is restricted to inventory action types. Two exploit regressions were observed failing before fixes. Browser rejection recovery is being checked separately.

Claude CLI limitation: both attempted reviews stalled without a returned assessment; see claude-integration-review.md. The independent fresh source reviews were Codex, not Claude. No Claude approval is claimed.

Final reconciliation correction: HTTP settlement testing exposed a new command arriving after an in-flight recovery scan. Concurrent callers previously reused that scan and could resolve before their terminal command was sent. The reconciler now requests another pass for foreground calls; periodic polling joins without extending the drain. A deterministic paused-scan regression fails against the previous implementation and passes with the fix; separate cases verify failure/retry and background polling. Evidence: /tmp/reconcile-regression-{red,green}.log. Actual HTTP terminal tests are included in final verification.

Aside rejection recovery passed: a distant invalid move followed by Wait advanced the paid run to turn 1, confirming definitive invalid actions no longer trap the browser in retry. Latest authoritative edition counters were independently verified against real sandbox settlement and closure, including duplicate/rejected commands and excluding town gear.
Reconciliation follow-up: callers now receive the result of their requested pass rather than waiting for all future traffic to stop. Added a paused-second-pass regression to rule out starvation under continuous foreground polling. Background polls still do not queue extra passes.

Final checkpoint: npm run verify exited0, game43/contract30/server39 all passed, plus typecheck and WASM/web build. Durable report: docs/integration-verification.md; full output: docs/evidence/local-integration-tests.txt. Checklist30/48 after recorded M18 latency and M30 matcher proof. Final reconciliation typecheck/focused tests also passed after the last helper edit. No paid/testnet/public action.
