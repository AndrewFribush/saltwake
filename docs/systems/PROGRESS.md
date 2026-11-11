# System/kit execution progress

Authority: BRIEF.md. Andrew authorized restart after rejecting the adventure-centered work. Execution proceeds locally; older plans and their paused-goal metadata do not authorize resuming the rejected content direction.

## Restart delivered

- Removed the named Smuggler's Choice import/default/restart choices from the live Run component. It remains an isolated test fixture; no game component imports it.
- Retained existing procedural free practice, with copy directing creators to guild rehearsal. No authored campaign introduced.
- Added shared `packages/game/src/authored-layout.ts` used by BOTH FloorBuilder rehearsal and server rules-v3 materialization. Geometry and encounter definitions now produce the same layout/behavior, instead of duplicate construction loops.
- Compiler validates authored geometry, room/slot references, IDs, duplicate placement and supported enemy behaviors. It does not create economic goods.
- Added explicit synthetic rehearsal constructor and three selectable test kits. Kit switching restarts rehearsal only; draft and actual holdings are untouched. Existing published rules remain unchanged.

## Capability audit — first pass

| Area | Exists | Next system gap |
|---|---|---|
| Geometry | 13×9 authored floors, 2–4 floor publication, floor ordering/undo/drafts | Located repair hints, guide, clone/remove and validated blueprint portability delivered; creator usability evidence remains open |
| Encounters | Two behaviors, spike traps, four sockets per floor | In-tool catalog delivered; broader behavior configuration remains open |
| Rehearsal | Shared authored compiler; club/sword/armored synthetic kits | Located geometry diagnosis and synthetic business rehearsal delivered; human build/play/revise evidence remains open |
| Rewards | Fixed authored placements; contract also supports random tables | Audit and expose random funding in creator tools |
| Economy | Finite listings, batch tonic crafting, admissions, refresh and settlement | Maker procurement workflow and trustworthy acquisition-cost coverage |
| Transparency | Outcomes, mean/median loot/time, sample coverage | Interpretability across term changes; creator comprehension tests |
| Content extension | Versioned modules and limited behavior catalog | Explicit shared schema contract and extension test |

## Verification

73 game tests; 14 focused shared-layout/server/custom-layout/recovery tests; TypeScript and Vite build passed. Browser exercised all three maker rehearsal kits at 1366×768 and390×844, no page overflow/offscreen controls; return to editor worked. Logs/scripts in `docs/evidence/systems-kit/`. Focused tests include four new compiler/rehearsal cases and ten existing server cases, not 14 new features.

Local API restarted with the server refactor. Existing sandbox database was restored on its original RPC port after the processes stopped; no new world was created. No local economic state reset, contract change, deployment or testnet operation performed. Creator-facing Vite rehearsal uses the new code already.

## Remaining work

The product is not complete. Continue the systems brief: authoring catalog/validation and content contract, synthetic business rehearsal, funded creator lifecycle, civilian economy and creator/player testing. No human fun or builder acceptance has been claimed. Experimental shove/escape remain opt-in unused by ordinary authored rules; do not make their fixture the next milestone.

## Creator-kit continuation — 2026-11-10

- [x] Add component guide for current published rules; explain unsupported editor capabilities.
- [x] Add floor diagnostics with repair instructions and tile focus, preserving authoritative validation.
- [x] Add versioned definition-only blueprint export/import, fresh draft identities, cloning and removal. Imports retain existing drafts; saved goods/ownership/funding/artwork never transfer.
- [x] Review creator-kit code with Claude; fix stale import status, import capacity consistency, clone name overflow, library capacity recovery and stale tile focus. Strict reward typing additionally prevents JSON key coercion.
- [x] Add synthetic business rehearsal with copies, attendance, full reward claims and explicit cost assumptions. Unknown stock costs keep contribution/break-even unknown. Committed stock is expensed in full, including closure leftovers. No transactions or selected real goods.
- [x] Enforce the 128-item opening-stock limit in the calculator; disclose sequential-attempt/full-claim simplification, no refresh/void/partial consumption, and no demand prediction.
- [x] Run 85 game tests, 53 server tests, TypeScript and production asset build. Browser checks cover Guide/Check/Library and all four Business pages at 1366×768 and 390×844; no page overflow/offscreen controls or captured window errors. Import failure → success, clone/remove and rehearsal checked.
- [ ] Human creator and unfamiliar-player tests. Automated runs do not establish enjoyment or usability acceptance.
- [ ] Random reward configuration in the builder, authoritative purchase-cost provenance, complete maker procurement lifecycle and subsequent systems-plan work.

Evidence: `docs/evidence/creator-kit/`; detailed scope and review disposition: `docs/systems/creator-kit-verification.md`. No production/testnet changes or world reset. Rehearsal is a hypothetical calculator, not an audited business ledger.

Second independent review (business calculator): launched, still pending at this checkpoint; not counted as passed. Neutral creator-playtest protocol is prepared in `creator-playtest.md`.

## Visible navigation follow-up

Implemented persistent Inventory/Wallet/Help labels, town activity directory, house service choices and visible service-section buttons. Verified paths to all five services and the builder, fixed map position across menu openings, desktop/phone fit, Escape and focus restoration. Typecheck/build pass. See `navigation-verification.md`. Human discoverability remains unmeasured.

## Navigation correction

Andrew rejected the fixed activity directory and counter-navigation menus because towns are player-built. Removed both additions and their portal/state/CSS plumbing. Retained explicit personal inventory/account/help controls and service tabs. Updated the brief so discoverability work cannot silently substitute fixed activity navigation for spatial exploration. Earlier navigation test results are historical, not acceptance of that design.

## Contract-owned player shops and mode connections

- [x] On-chain shop ownership, placement, validated interior, config version, open/closed state and associated finite listings.
- [x] Shop building placement → interior construction → preview → confirmed publication; visiting through placed doors; owner stocking, customer buying, editing and closing.
- [x] Shared dynamic building geometry for rendering, collision and movement; no fixed activity launcher.
- [x] Preserve the existing local world through tested migration and snapshot/receipt checks.
- [x] Browser build-and-trade proof with exact ownership and 3-credit transfer; return paths through shop/dungeon builders and practice.
- [x] Prepare bounded testnet account/proof/runtime scripts and persisted broadcast-cap test.
- [ ] Execute testnet after exact-destination approval and provisioned account; proposals prepared, no external write performed.
- [ ] Wallet authentication, public player onboarding, broader player-authored terrain/land lifecycle and remaining systems-kit tasks.

See `player-shops-verification.md` for evidence, the isolated sandbox expiry retry, and exact limits. The prototype is not fully delivered merely because these shop flows work.

## Random rewards, merchant records and relocation continuation

- [x] Random reward sockets, explicit fixed/random owned-stock assignment, versioned blueprint support and synthetic random rehearsal.
- [x] Replenish published random pools through contract refresh without changing active reservations.
- [x] Owner sales records from matching confirmed receipts, with partial-history disclosure and no unsupported profit claims.
- [x] Correct empty-loadout admission to unarmed damage; preserve old saved-run behavior. Browser verified abandonment leaves unpacked gear in town.
- [x] Choose a district when creating or relocating a shop; browser moved a shop and restored it with stock and credits intact. Contract tests cover occupied-space rejection and unchanged inventory/balances.
- [x] 95 game tests, 60 server tests, two focused shop/migration contract tests; typecheck and build pass. Placement fits desktop and phone.
- [ ] Public wallet/onboarding, broader authored land lifecycle, acquisition-cost provenance, and human creator/player loop evaluation remain open.
- [ ] Exact-destination testnet run remains awaiting approval; no external write performed.

Details and evidence: `random-rewards-and-shop-continuation.md`. Earlier unchecked random-authoring items above are superseded by this completed checkpoint. No acceptance of a developer-authored adventure is implied by correctness fixtures.

## Active-goal accounting continuation

Andrew resumed the goal. The corrected systems brief remains authoritative; the historical goal reference does not restore the rejected adventure plan. The preceding goal-control turn was no progress; this turn changes implementation and adds verification.

- Implemented a wallet cash-flow summary, individual cash movements and coverage/rules views. Counterparty trade revenue is visible even when the other player submitted the purchase.
- Only identity/hash-matching Applied receipts contribute trade amounts. Run/edition snapshots supply entry, pending maker and placement fees without counting admission/settlement commands twice. Voids have zero net fees; integer arithmetic preserves credit precision.
- Explicitly separates bank trades and subsidized NPC orders. Missing history, initial allocations and recovery wages are excluded and disclosed. Does not call recorded cash flow profit or reconstruct costs from catalog values.
- 65 server tests passed, including five new cash-account tests. Browser initially caught mobile overflow; after splitting the views, all three fit at 1366×768 and 390×844 without page scrolling/offscreen controls. Typecheck/build rerun after correction.

Evidence: `docs/evidence/business-accounts/`. S14 remains in progress: actual acquisition-cost provenance, crafting allocations and committed funding contribution still need implementation. Receipt insertion order alone is not authoritative chain order and must not be used to fabricate those costs. Continue the full completion checklist; this is not a completion claim.

## Cost provenance continuation

- [x] Prospective confirmed acquisition basis, exact whole-credit craft allocation, resale disposal/new basis, funding expense and unknown-history handling.
- [x] Persist captures before signing and atomic observed results after confirmation; recovery of interrupted accounting without rebroadcasting an Applied operation.
- [x] Wallet stock/trading accounts and per-edition contribution with pending income separated and historic funding explicitly unknown.
- [x] Real local-contract procurement → crafting → resale → funding → restart verification; 75 server tests, typecheck/build, desktop/phone browser fit.
- [ ] Independent accounting review and ecosystem/loss-loop playtesting remain required by S14/S16/S18. Public multi-signer accounting requires authoritative event ordering; current journal explicitly assumes one local writer.

Details: `cost-provenance-verification.md`. Goal remains active; continue the full completion checklist.

## Loss → work → re-equipment continuation

- [x] Authoritative recovery eligibility and exact recipe readiness, including clear unavailable reasons instead of avoidable rejected transactions.
- [x] Workbench interrupted-request persistence and explicit retry after reload; repeated confirmation preserves original request IDs.
- [x] Actual local-contract death → three finite jobs → club buyback → newly quoted re-entry proof; budget and job cap stay exhausted after another loss.
- [x] Browser lost-response/reload/retry proof with one job, one wage and bank-owned output; idle and active workbench fit desktop/phone.
- [x] 98 game tests, 76 server tests, typecheck/build passed.

Evidence and limits: `recovery-loop-verification.md`. Human fun/creator acceptance and remaining completion-checklist work are still open; these technical checks do not substitute for them.

## Preparation and incoming-threat continuation

- [x] Shared equipment rules/explanations, supply categories and cleared post-trade selections.
- [x] Starting-weapon choice, bag-capacity preview and shared authoritative loadout materialization.
- [x] Visible enemy intent descriptions and hit-count guidance.
- [x] Fixed an unseen charger attacking a visible tile without warning: project visible warning geometry while withholding hidden source/loot.
- [x] 102 game tests, 77 server tests, typecheck/build; shop/loadout/run desktop/phone browser checks.

Evidence, regression details and boundaries: `preparation-and-threats-verification.md`. Continue the active goal; neither these passing checks nor developer play proves the human acceptance gates.

## Creator rehearsal and revision continuation

- [x] Record exact tested design, starting kit/floor, bounded action trace and outcome; explicit profile-local save/reload and export.
- [x] Start at selected floor with synthetic kit; return to preserved editing context and locate recorded turns.
- [x] Detect changed designs, prevent stale location links, copy tested geometry into a new unfunded draft.
- [x] Reject saved records referring to nonexistent floors or off-grid finish positions.
- [x] 107 game tests, 77 server tests for shared changes, typecheck/build and desktop/phone browser verification.
- [ ] Independent accounting review found and fixed an observation-gap bug; human player acceptance remains pending. Creator examples are not an implementation prerequisite.

Details: `creator-trials-verification.md`. Continue the full completion checklist; synthetic rehearsals do not demonstrate fun or organic demand.

## Arbitrary-authorship correction and free placement

Andrew rejected the request for two creator intentions as an implementation gate. BRIEF.md and SYSTEMS-KIT-PLAN.md now explicitly require general composable authorship without that gate. `arbitrary-authoring.md` audits hardcoded limits and tracks the remaining generalization work.

- [x] New drafts have no mandatory encounters; click free floor tiles to place encounters, select/configure/remove them, preserving undo and rehearsal.
- [x] Rules v4 custom modules support 0–16 encounter positions per floor instead of exactly four; legacy rules remain separately validated. Blueprint v3 roundtrips flexible placements while v1/v2 retain prior limits.
- [x] Real local-contract tests publish an empty floor and a fifth-slot reward, enforce slot references, reserve exact goods, materialize fixed/random rewards and preserve reservations through refresh/abandonment.
- [x] 109 game tests, focused contract/codec tests, v3/v4 server integration, typecheck/build and desktop/phone browser checks passed. Full pre-extension contract sweep passed 35 tests; new v4 regression passed separately.
- [x] Independent accounting review found stale basis could return after failed observations around a sale/repurchase. Unjournaled Applied operations now invalidate continuity; recovery handles missing captures without rebroadcast. Four regression variants pass.
- [ ] Variable grid dimensions, authored transition graph, configurable component vocabulary and multiple independently funded loot pools remain required. The placement extension does not complete arbitrary authoring.

Final verification for this continuation: 83 server tests pass, including both v3/v4 funded authoring paths and the four accounting recovery regressions. The existing local sandbox contract was backed up and refreshed without a schema migration; exact pre/post snapshots match. Local API restarted with the new materializer and accounting recovery. No testnet, production or paid call occurred. Six freely placed encounters survived explicit draft save and browser reload; evidence is in `docs/evidence/free-placement/`.

## Variable floor dimensions continuation

- [x] Rules v5 rectangular 5–31 tile dimensions with legacy schema isolation and Blueprint v4 support.
- [x] Safe selected-floor resizing, undo, editor panning and player-following dungeon viewport with world-coordinate actions.
- [x] Dimension-aware diagnostics and trial location validation/focus.
- [x] 113 game tests, 84 server tests, five focused WASM cases, typecheck/build and desktop/phone browser route proof.

Details: `variable-floors-verification.md`. Arbitrary transition graphs, component configuration and independent loot pools remain next systems work. The overall goal remains active.

The existing local sandbox now runs v5 code after a backed-up refresh with an unchanged economic snapshot. The local API restarted successfully. A 31×17 authored draft survived explicit save/reload and its remote exit remained playable. Evidence: `docs/evidence/variable-floors/local-upgrade.txt` and `save-browser.txt`.

## Authored connections and room memory continuation

- [x] Optional connected-room definitions with walk-on passages, branches, return routes, self-links and clear-room gating; existing linear drafts retain their rules.
- [x] Per-run enemy/trap memory and exact global item identity across reentry; safe arrival when spawn is occupied.
- [x] Versioned schema/contract validation, Blueprint v5, destination-preserving reorder, protected linked-floor removal, saved-draft reload.
- [x] 119 game tests, 85 server tests, eight focused WASM tests, typecheck/build and desktop/phone browser proofs.
- [x] Funded graph traversal and retry survive database restart; consumption and abandonment settle exact items once.
- [x] Independent engine/schema review; local sandbox code refreshed with an unchanged economic snapshot and API restarted.

Details and explicit limits: `room-links-verification.md`. The current 2–4 floor bound, broader component controls, independent loot pools, public identity and remaining completion checklist are still open. Do not treat this graph implementation as complete arbitrary authoring or human fun acceptance.

## Independent random pools continuation

- [x] Named per-encounter pools, exclusive physical-stock assignment, per-table limits and least-pool capacity.
- [x] Blueprint/draft compatibility, stale-assignment rejection and per-pool synthetic trial samples with immutable capture.
- [x] Existing per-table replenishment connected to independently authored tables; real-contract concurrent reservations, isolated refresh, replay and correct abandonment returns verified.
- [x] 124 game tests, 86 server tests, typecheck/build, desktop/phone browser interaction and saved-name reload checks.
- [x] Independent source review completed without concrete issues.

Details: `independent-pools-verification.md`. Existing local contract already supports the commands; no upgrade or economic-world change was needed. Continue broader reusable component controls and the remaining completion checklist.

## Configurable encounter rules v7

Implemented bounded creator-set enemy and trap rules across drafts, blueprints, rehearsal, authoritative play and contract validation. Fixed first-turn charge warnings and misleading spike instructions. 130 game tests, 87 server tests, 11 focused WASM tests, typecheck/build and Aside desktop/mobile/reload checks passed. See [verification](tuned-encounters-verification.md). General authoring and completion checklist remain active; this is not human fun acceptance.

## Creator operating terms v8

Added saved/portable opening delay, opening length, run duration and concurrent capacity. New admissions honor edition-specific capacity/deadlines; old editions retain pinned terms. Contract boundary, concurrency/reuse, exact block deadline, expiry and closure tests passed. Game tests:134; server suite:88 plus two new restart deadline cases in the focused 12-test recovery suite. Aside verified desktop/mobile fit, saved/invalid draft repair, and actual local edition-4 publication with capacity1, two-minute runs and a two-hour scheduled opening. Local code refresh preserved the economic snapshot. See [verification](operating-terms-verification.md). Independent review found a stale unsupported-version assertion, corrected to version9; legacy regression follow-through is recorded in the evidence directory. Goal remains active; broader authorship/lifecycle and human acceptance remain outstanding.

## Single-floor and extended floor-count authoring

Rules v9, blueprint/draft v9 and new one-floor defaults now support1–16 floors with64total encounter positions. Updated connected/linear rehearsal, persisted trial floor indices, reordering, removal protection and actual server materialization. Saved library/export size checks prevent writes the loader cannot reopen. Review revealed request/gas limits for larger valid designs; fixed v9-only command envelope/signing/gas support, proved actual37789byte HTTP publication, and retained legacy caps. Also reproduced and fixed an existing signed-size retry bypass. Evidence:138game tests,94server tests,3floor contract tests+2large-envelope contract tests,10final Outbox/HTTP tests, typecheck/build, desktop/mobile creation, save/reload/reorder/return play, and actual local16floor publication. Local refresh preserved economic state. See [floor-count-verification.md](floor-count-verification.md). Full goal remains active; arbitrary composition, ecosystem and human acceptance are not complete.

## Reusable signal switches and doors

Implemented rules10/custom10 devices, blueprint/draft10, editor placement and configuration, per-run channels, walk-on toggle/set/clear switches, inverse doors, sight/pathfinding/charge blocking and visible-only public projection. Actual funded server play proves exact-once switching across retry/restart and extraction of reserved loot. Independent review caught and resolved full-arrival overlap and ill-formed Unicode IDs. Verification:146 game,97 server,6 focused WASM tests; typecheck/build; desktop/mobile edit and play; saved/invalid draft repair; actual local edition-6 publication. Local refresh preserved the economic snapshot. See [mechanisms-verification.md](mechanisms-verification.md). The whole-game goal remains active; these composable primitives do not complete the component catalog, economy/world lifecycle or human acceptance.

## Configurable departure rules

Rules11/custom11, blueprint/draft11 now supports extraction permission, independent clearance requirements and optional on/off signal conditions per floor. Onward-only stairs remain usable; new departures resolve their danger turn before leaving. Creator rehearsal has no invented shrine, while pinned older content retains its rules. Independent review fixed malformed-Unicode passage IDs. Evidence:152 game tests; full server suite98 plus separately verified two-outcome departure suite; six focused WASM tests; typecheck/build; desktop/mobile controls, save/reload/repair and local edition-7 publication. Backed-up local code refresh preserved the economic snapshot. See [exit-rules-verification.md](exit-rules-verification.md). Full completion remains active.

## Informed admission, exact replenishment and bounded economy stress

- [x] Exact-edition pre-admission rules/hazards/track record, including tuned enemies/traps and authored exit conditions. Unsupported definitions refuse entry.
- [x] Explicit matching-vs-archive browsing; no silent unfiltered fallback; discoverable no-treasure creations. Preparation and offer views fit fixed desktop/phone windows.
- [x] Fixed random-pool name collision in Maker replenishment; shared payload validation and actual contract proof cover fixed/random:fixed identities, retries and reservation preservation.
- [x] Four bounded real-WASM economy stress scenarios cover absent demand/unsold stock, finite recovery/NPC/bank budgets, repeated losses/voids, concentrated extraction/coordinated buyback and coin/goods accounting.
- [x] 158 game tests, focused replenishment contract proof, typecheck/build and Aside saved edition11 disclosure checks pass. Stress suite: three initial passes and one focused successful retry after a retained RPC timeout.

Details: [admission-and-replenishment-verification.md](admission-and-replenishment-verification.md) and [economy-stress-verification.md](economy-stress-verification.md). No public action occurred. Economy sustainability, human acceptance, public identity, broader authoring/world lifecycle and the whole completion goal remain open.

## Player identity and account-authorized command foundation

Implemented I01/I02 of the player identity plan and durable player-command queue recovery. NEP-413 challenges bind origin/network/contract/account and final FullAccess key ownership; concurrency, expiry, replay, restricted/revoked keys and RPC capacity are tested. Contract registrations create zero balances in a reserved wallet namespace; ordinary wallet spending requires account transactions, while bound game results retain explicit oracle authority. Account operation IDs, submitted hashes, derived admission seeds and exact retries are verified.

Player requests cannot fall into operator signing on uncertainty/restart. Review fixes protect owner-specific terminal reserves, concurrent terminal slots, independent player/operator scheduling and bounded cost observations with no late writes. Actual disposable-chain runs prove admission recovery and final oracle settlement.

Final evidence:123 server tests pass,7 new authority contract tests and2 compatibility tests pass, offline contract build, typecheck and web build pass. The five-test/subtest real-key proof and targeted queue tests overlap the full server count. A populated pre-identity contract upgrade preserved state/hashes/receipts and active obligations. Persistent demo contract remains unchanged. See [player-identity-verification.md](player-identity-verification.md).

This is backend foundation, not completed wallet onboarding. HTTP wallet mode, prepared wallet crafting/recovery, generic external-admission discovery, adapter/browser UI and full multi-account gameplay acceptance remain I03–I06 work. Global receipt/run/storage capacities still block public-scale acceptance. No external action was taken; the whole goal remains active.

## Wallet HTTP ownership and external-run discovery

Implemented explicit wallet-mode HTTP login, registration descriptors, account-bound unsigned economic commands, ownership checks and logout cancellation. Final chain snapshots can recover admissions made outside the HTTP command flow without invented receipts or start times. Atomic terminal markers prevent stale snapshots or interrupted discovery from resurrecting finished runs; discovered obligations retain settlement capacity.

Verified the completed full server run:132 tests passed,0 failed; typecheck and web build passed. Logs are in docs/evidence/wallet-http/. Six real-chain discovery tests cover recovery, exact reservations, expiry, terminal import and interruption. The subsequent focused HTTP suite passed2/2: its additional gameplay case proves external v11 admission discovery, foreign-account denial, owner movement/extraction and exactly one bound oracle settlement. This new case is not included in the132-test full-suite count; it uses a free, empty-stock fixture and does not establish paid-loot or browser acceptance. See [wallet-http-and-discovery-verification.md](wallet-http-and-discovery-verification.md).

Persistent demo and contract remain unchanged. Wallet crafting/recovery, browser adapter/onboarding and full multi-account game acceptance remain unfinished; this backend evidence does not establish gameplay enjoyment. The full systems goal remains active.


## Account-signed batch contract and browser signing boundary

Wallet crafting/recovery starts now require the account/request operation ID as batch ID and a zero deadline sentinel. The contract derives a120-second deadline at confirmed execution after submitted-command hashing and receipt replay checks. Player completion remains prohibited; operator ordinary starts remain prohibited. Existing demo deadlines/state encoding are unchanged. Outbox checks matching account/request batch identity and reserves terminal headroom.

Verification:8 authority WASM tests pass including registration, ownership, upgrade compatibility and new recovery/replay/deadline assertions;1 additional actual-WASM extracted-supplies → craft → list-outputs test passes;11 player queue tests pass. Browser signing boundary14 tests pass; typecheck, web build and diff checks pass. Evidence:docs/evidence/wallet-crafting/.

The new isolated browser transport binds NEP-413/session/account/network/contract and transaction descriptors, verifies the exact account/request operation ID using browser SHA256, rejects changed identity during approval, and preserves uncertain submissions without automatic resubmission. Added test:web to the verification command so these tests remain part of normal verification.

This is not completed wallet crafting or browser onboarding. Craft controller prepared challenges, direct-batch discovery, HTTP integration, an actual supported wallet adapter, reload-persistent intents and UI integration remain in progress. The transport is not imported by the running app yet. Contract support is verified in disposable sandboxes only; persistent local demo remains on its earlier contract. Human fun acceptance and the full completion checklist remain open.


## Wallet crafting through HTTP and direct-batch recovery

Completed I04 server integration: durable wallet preparation, exact unsigned transaction descriptors, chain-deadline adoption, authenticated minigame events, restart recovery and bound oracle completion. Direct unprepared batches are discovered and settle at normal quality after expiry; no successful challenge is fabricated. The workbench explains missing-challenge recovery.

Independent review found and fixed changed direct submissions conflicting with saved preparations, discovery history exhaustion, overlong terminal IDs, and exhausted local queue capacity—including emergency settlements displacing a previously prepared batch's reserved finish. Conflicting preparation evidence is retained; terminal imports are atomic; bounded owner/kind-checked emergency finishes preserve recovery. See [wallet-crafting-verification.md](wallet-crafting-verification.md) for mechanisms, limits and evidence.

Full server run passed141 tests including actual NEP-413 wallet HTTP preparation, start, mid-step restart, completion, direct external recovery discovery and chain-clock expiry. The latest additional prepared-reservation regression passed in the18-test focused controller/queue run; that added case is not in141. Final typecheck/build and diff checks passed; independent final source re-review reported no further substantive finding. Logs:docs/evidence/wallet-crafting/.

I05/I06 browser adapter, visible wallet onboarding/approval and full multi-account game acceptance remain unfinished. No persistent demo refresh or external action occurred. Technical success is not human fun acceptance; the whole systems goal remains active.


## Browser approval recovery and prepared crafting transport

The browser wallet boundary now persists exact account/request intents in sessionStorage scoped to origin/network/contract before opening approval. An uncertain submission survives reload and only polls its original receipt; explicit cancellation remains retryable. Invalid or unwritable stored state prevents approval rather than silently discarding history. Resume validates an existing authenticated session without prompting a signature. No keys, cookies or login proofs are stored in the intent journal.

Added prepared crafting transport: validate account, derived batch ID, inputs, commitment, zero deadline, receiver and gas; then use the same durable transaction-approval path as ordinary commands. Identity changes during preparation reject before wallet approval. A public configuration endpoint returns exact auth mode and destination without creating a session or reading chain state, enabling truthful unauthenticated onboarding.

Verification:19 browser transport tests pass;1 config endpoint test passes; typecheck and diff checks pass. Evidence:docs/evidence/wallet-crafting/persistent-transport-tests.txt and config-tests.txt. The separate wallet UI wrapper and concrete supported adapter are in progress; App still uses the existing demo. I05/I06 and full goal remain open.

## Paused at Andrew's wrap-up request

Saved the current implementation and verification state in [HANDOFF-2026-11-10-WALLET-UI.md](HANDOFF-2026-11-10-WALLET-UI.md). The browser transport passed an actual local HTTP/WASM loop after fixing prepared-command reconciliation. Wallet UI components are saved with25 markup/seam/transport tests passing, but App integration, concrete adapter verification and mounted-browser acceptance remain incomplete. The draft Nightly adapter must not be activated until custom-network isolation is verified. Both agents stopped. No public action or persistent demo refresh occurred.
