# Implementation ledger

Plan: ../design/dungeon-economy/TASKS-MERGED.md

2026-11-10 UTC: started a separate local repository on build/dungeon-loop. Shelved franchise-agents untouched. Compact 48-card checklist lives next to the merged plan.

M01: movement tests first failed on missing implementation, then 2/2 passed. React browser room, click/keyboard movement, focus outline and @ marker implemented. Eight catalog prices pinned. Browser verification in progress.
M02: five combat tests failed against movement-only implementation; now 8/8 game tests pass including movement. Typecheck and build pass. Browser and independent review pending.

Interface review: M01's pure state/action reducer feeds M02 combat; invalid input returns same state and accepted turns clone state. M04 will extend inventory without creating an economic ledger. M06/07's economic authority remains separate and unimplemented.

Ruling: first practice enemy uses 4 HP and 3 damage; armor applies before guard. These are explicit tuning defaults, not final balance. Costs if wrong: retune fixtures; no funded inventory exists.

Dependency check: initially pinned Vite 6.4.1 had advisories. Updated to exact 6.4.6; npm audit reports zero known vulnerabilities.

Not implemented: M03 onward; no contract, paid admission, inventory, persistence, shops or maker UI. Practice resets on refresh and grants no goods. test:contract/server/e2e fail explicitly as unavailable rather than claiming coverage.

Browser evidence: docs/browser-check.txt records wall rejection at turn 0, click move, keyboard move, guard damage, two attacks, cleared room and restart; uncaught/rejection console capture was empty. Screenshot copied through Aside's own filesystem API because its session files were not host-visible; image visually inspected.

Self-review found greedy enemy routing oscillated around the interior wall. Added a reachable-player regression which failed, then replaced greedy routing with breadth-first distances. 9/9 tests, typecheck and build now pass. No economic behavior is represented by this test.

Final first-slice evidence:
- M01 complete; M02 complete. M03–M48 remain unchecked.
- Claude Opus 5.5 reviewed source independently (docs/claude-review.md). Reviewer did not execute tests and reviewed the pre-pathfinding-fix snapshot. No claim of review of the final fixes.
- Fixed medium findings: wall routing, key repeat, semantic board role, player-overlaid warning, disappearing-control focus, threat/result/blocked feedback. Controls regression failed first then passed. Browser post-fix role/warning/focus assertions passed with no page errors (accessibility-after.txt). The attempted before-fix browser recording captured the missing application role but then failed finding the Wait control while edits were underway; it is not a complete baseline flow.
- 10/10 game tests pass; npm run typecheck and npm run build pass. No actual assistive-technology user session performed; role semantics are not proof of full screen-reader usability.
- Low findings 7/8 addressed alongside keyboard fixes: return focus to board and normalize case/ignore modifiers.
- Deferred minor: multi-enemy blocked-intent previews; separate display name/unique ID and locale-independent ordering; coordinate axes/relative target descriptions and wall-button semantics. Current practice has one uniquely named enemy; expand these before multi-enemy content. These do not represent complete accessibility coverage.
- Ruling: no extraction/economic reward for clearing this initial practice room; next modules implement the rest. Cost: this is a mechanics test, not a complete game loop or evidence of fun.
- Local server: 127.0.0.1:18930. No deploy, paid call, testnet transaction, remote repository or public posting.
- Browse operational learning was recorded here because gstack-learnings-log failed (bun missing): Aside session files may be virtual; use its fs API to transfer screenshots.

## Second building session — 2026-11-10 UTC

M03 complete: charger lane commitment, first-creature collision, one recovery turn, alternating traps that affect enemies; reproducible action tests. Changed enemy order from localeCompare to codepoint ID order. Multiple-enemy movement intents avoid currently occupied squares.
M04 complete: six-slot bag, two equipment slots, reachable floor use, gear swaps, town-drop refusal, origin preserved. Invalid actions leave original state unchanged. Browser proved pickups, found armor/sword equips and one-time floor tonic use.
M05 complete: exact source-manifest partitions for death/extraction/void, malformed manifest/consumed-equipment rejection, 32 seeded action traces x three outcomes. These are local derived partitions, NOT contract settlements.

29 game tests pass. Claude source review (claude-gameplay-review.md) found no important correctness defects. Fixed its malformed action and malformed initial inventory findings with two failing regression tests followed by green suite. Deferred: freezing source manifests at paid admission and error containment for corrupt persisted snapshots belong at server admission/recovery integration; current fixtures are internal and the browser has no import/persistence endpoint. No claim these are safe untrusted protocol types yet.

Actual Aside browser: 32-turn full expedition extracted at 9 HP with sword/armor and all five dungeon items. Separate death sequence consumed floor tonic once; death report sent town-club/town-tonic to bank, cache-tonic to consumed, all other unconsumed rewards to dungeon. Exact logs in browser-expedition.txt and browser-death.txt. One tooling retry needed because nested locator.getByRole is unsupported in Aside; CSS locator + filter worked. Full-page screenshot stitching duplicated/scrolled sections; do not treat that artifact as a faithful whole-page layout capture. DOM action assertions passed.

M08 remains in progress: deterministic contrasting loadout observations in play-observations.md. Repair/observe gate blocks M25 expansion, not independent contract work. No independent human gameplay observation claimed.

Rulings: charger hit4/HP6/recovery1; trap hit3 after enemy actions and alternates every valid turn; extract/continue requires cleared-room exit tile. These are explicit tuning defaults within GDD's proposed mechanics. Cost if wrong: tune fixtures/exit flow; no actual assets at risk. Inventory use/equip/pickup/drop takes a turn, including after enemies clear while traps remain active.

M06 started: isolated local sandbox smoke contract, temporary debit command only. Default Rust is 1.87; repo pins installed 1.93.0. Latest transitive near-sdk-env required Rust1.95; lock downgraded to compatible 0.1.6 / near-sys0.2.14. No shelved application modified/reused; only previously working toolchain versions consulted. npm near-sandbox's tar7.5.13 had advisories; override tar7.5.22 removes reported vulnerabilities.

M06 complete: actual WASM deployed and exercised in near-sandbox2.13.4. Init once, retry3-credit debit once, conflicting payload rejected, buyer7/bank3. Compile9.90s, successful sandbox2.21s, initial red to green151s excluding prior dependency setup. First sandbox start failed because test redundantly added the package's default genesis account; inspecting package genesis generation identified duplicate records. Removed duplicate; fresh isolated sandbox passed and torn down. Full pinned tooling/artifact hash in toolchain.md. M07 remains unstarted; smoke command is explicitly temporary.

Final verification this session: 29 game tests; 1 actual WASM sandbox smoke test; typechecking includes game/web/tests/scripts; web build; full browser extraction and death paths; independent Claude source review. No paid calls, testnet, deployment or remote publication. No full-game fun or economic completeness claim.

## Third building session — fixed economy

Local contract implementation now includes shared Rust/TS item locations and canonical commands; fixed funded publication; admission, four-per-edition/one-per-profile limits and quote checks; exact terminal partitions; void/refund; and bank closure after cutoff with no active runs. Browser remains free practice and is not connected to this economy. M14–20 transport/auth/recovery are not implemented.

Rulings: prototype placement costs publication2/pursuer2/charger3/trap1/reward-socket1; stock funded separately. Fixed-only publication accepts enough stock for one full bundle plus any surplus of required types; every admission still requires a complete bundle. This preserves the user's refresh/funded-copy model; surplus alone never buys a partial attempt. Abstract module socket IDs are bounded now; geometric editor integration belongs to M25–27. Numerical defaults and interface field names recorded in docs/protocol/fixed-economy.md.

Independent Claude source review (claude-economy-review.md) identified receipt exhaustion stranding active reservations. Reproduced in actual WASM sandbox: filling receipts made void panic. Fixed by reserving terminal/closure headroom before any success/rejection receipt commit. The test exhausts the actual 256-slot log then voids and closes successfully; final strengthening asserts exactly252 filling rejections so transport failure cannot masquerade as exhaustion.

Removed legacy debit() wrapper; Action index0 is a permanently rejecting tombstone, preserving Borsh order. This addresses both unrestricted smoke transfer and rollback of rejected compatibility receipts. Private initialization prevents outsider preemption. Initial red smoke test demonstrated outsider init vulnerability; updated test proves outsider rejection, init once, stable deprecated-command rejection and payload-conflict rejection. Historical M06 proof is superseded by funded-admission debit evidence, not silently overwritten.

Review decisions: preserve late extraction/void submission because the server may reconcile a pre-deadline durable outcome after a transport outage. Deadline is gameplay time, not receipt-arrival time. This remains a trusted-operator assertion until server action/deadline integration (M18/M20); contract cannot prove acquisition or outcome timestamps. Carried-set equality tests prove internal consistency, not honest combat. Concurrent RPC admission test proves serial on-chain exclusivity, not parallel VM execution. No flaky nonce collision observed; operator signer serialization is still M14 work.

Additional review fixes: view types added in TypeScript; receipt run assignment shape included; duration/concurrency constants compared across Rust/TS; nonce-free command hash parity includes null rewards, no-reward editions, Unicode, u64 maximum and executed receipt hashes. Invariant checks now run in both item→run and run→item directions and validate fixed pool provenance. All existing catalog/item instances and credits+bank+pending escrow are reconciled after each fixture operation.

Expiry test debugging: an initial fixed2000-block advance did not reach the15-minute deadline, so Expired correctly rejected. An extrapolated large jump then timed out. Stopped the isolated nodes and changed to bounded1000-block chunks with an explicit observed contract-clock check. No production/network time altered and no shorter contract deadline substituted. Timeout evidence remains in expiry-test.txt; final suite evidence is separate.

Further expiry diagnosis: observing the still-running sandbox via local read-only RPC showed run-1 already expired correctly; the remaining hang was native sandbox graceful shutdown after fast-forward, not an unsettled run. near-sandbox0.3.4 stop() awaits child exit indefinitely. Fixture now allows five seconds for graceful shutdown then SIGKILLs only its own retained ChildProcess handle, allowing normal port unlock/temp-directory cleanup to finish. Two intermediate logs contain cancelled/time-out tests and are not final green evidence. Final authority: economy-verified-tests.txt. Capacity-final.txt independently verifies the exact252 filling rejections plus successful void/closure.

Third-session completion: M07/M09/M10/M11/M12/M13/M21 complete with evidence in economy-verification.md. Checklist13/48. Final actual-WASM suite13/13, no cancellation,86.77s; strengthened exact-capacity test also passed separately. Game29/29, typecheck, WASM/web build, whitespace check passed. No backend-browser integration claimed. Next critical-path work is M14 durable submission and M15 uncertain-transaction reconciliation, then sessions/admission integration.
