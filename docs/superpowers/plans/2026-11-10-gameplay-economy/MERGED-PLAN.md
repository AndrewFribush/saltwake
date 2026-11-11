> SUPERSEDED by Andrew’s correction: build a game system and construction kit, not a specific adventure. Execution stopped. See [SYSTEMS-KIT-PLAN.md](SYSTEMS-KIT-PLAN.md). Historical plan retained for audit.

# Gameplay and Economy Implementation Plan — merged

> **For agentic workers:** Execute task-by-task using superpowers:subagent-driven-development or superpowers:executing-plans. Keep checkboxes open until their evidence exists. This is the merged planning authority. Both independent drafts and reviews are retained in this directory. User instructions override all plans. Planning is complete; implementation and human gates remain open.

**Goal:** Make preparing, adventuring, extracting or losing, trading and authoring form a repeatable game people choose to play.

**Architecture:** Deepen the existing deterministic tile engine first in free practice. Promote accepted mechanics through explicit versioned server/contract boundaries, then improve economic choices and maker feedback using authoritative records. Preserve the fixed-window shell.

**Tech Stack:** TypeScript, React/Vite, SQLite authoritative server/outbox, Rust local NEAR sandbox.

**Review record:** `merge-decisions.md` documents accepted suggestions, corrections and remaining disagreements. This plan was synthesized by Codex after both cross-reviews; it is not a claim that Claude approved the final merged text.

**Spec:** `docs/design/economy-gameplay-review/review-decisions.md`, its transparency follow-up, and `../design/dungeon-economy/GAME-DESIGN-v1.2-reviewed.md`. User rules prevail over numerical proposals.

## Global constraints

- Local development/simulation only. No paid calls, testnet, production, deployments, submissions or unsolicited participant messages.
- Maker funds treasure; ordinary completion/death fees go to maker; unconsumed dungeon loot returns to pool on loss; town gear goes to bank; consumed goods remain spent; closure residual goes to bank.
- Preserve finite funded stock, item origins/IDs, admission quotes, reserves, concurrent capacity, void refunds and exactly-once settlement. Four simultaneous runs is not four lifetime admissions.
- No-reward attractions remain supported. Operator is bank, not an unlabeled player-maker. Demo grants/accounts remain disclosed.
- Fixed map and inspector geometry, one screen, no page scrolling; keyboard and click equivalent actions.
- Historical completion counts are not new evidence. Existing telemetry does not establish fun or organic demand. Unknown acquisition cost is not zero.
- No mandatory oil, new token, PvP, permanent stat progression, broad crafting catalog or speculative multiplayer expansion in the first slice.

## Review focus

1. Displacement invalidating committed intent must never silently retarget a hit (P03).
2. Extraction response, death, expiry and duplicate requests must select exactly one terminal result (P04/P10).
3. A restart during promotion must not reinterpret admitted runs under new rules (P10).
4. Reused/gifted/seeded/transformed goods must not create fictitious profit or double-count costs (P13a–c).
5. Human tests must expose confusion, coercive recovery and small-sample bias rather than optimize only success rates (P07/P15/P18).

## Working method and sizing

Each engineering card targets one reviewable deliverable, roughly 30–120 focused minutes for bounded engineering cards after prerequisites; cost provenance and version promotion may need several such slices; estimates are planning ranges, not deadlines. Split any card that exceeds this into subcards before marking progress. Human sessions are separate scheduled work, not agent time estimates. Correctness tests should fail for the intended missing behavior, then pass after implementation; no tests that merely mirror a CSS change. Commit only task-scoped files when appropriate; preserve existing uncommitted work, never `git add .`, no push or production merge. A second model reviews source when the eventual implementation warrants it; the cross-review here concerns plans only.

## Baseline and experiment contract

### P01 — Freeze a reproducible baseline (no dependencies)
Files: new `docs/playtests/baseline.md`; existing package scripts and verification reports.
- [ ] Record git revision plus dirty diff inventory/hash; do not print `.state/sandbox.json` or include keys in artifacts.
- [ ] Record existing catalog/combat values, tested viewport sizes and local startup commands. Capture a free-practice trace and current shop/return path without spending or resetting live local state.
- [ ] Map each economic invariant to an existing test name or mark uncovered; close gaps before promoting affected behavior. Run game tests/typecheck/build; run affected server/contract baseline suites before their respective work. Record exit codes and document baseline failures separately from new regressions. Preserve current practice as a comparison fixture rather than replacing its evidence.
Output: reproducible fixture ID/version and baseline evidence, not a fun verdict. Checkpoint: reviewer can replay the same starting situation.

### P02 — Pin the experimental rules and observations (P01)
Files: new `docs/playtests/smugglers-choice-rules.md`, `docs/playtests/session-template.md`.
- [ ] Record proposed one-floor/two-space fixture, club/sword/tonic kits, optional cache and reachable extraction tile. Preserve existing HP/damage/healing initially.
- [ ] Specify shove targeting, displacement, cooldown, collision, intent interaction and turn costs before code. Proposed initial default: club only, adjacent target, one empty cardinal tile away, no collision damage, cooldown/stagger off. No extra enemy phase on an invalid action. Write a truth table for a shoved pursuer, aligned charger, charger displaced off its committed lane, recovering enemy and armed/unarmed spikes. No attack may silently retarget. A displaced attack executes only if its committed path still legally starts from the new position; otherwise it fizzles. Spikes resolve after the enemy phase, not automatically at shove contact. Pin whether the moved enemy may step off the spike in each case and make the preview match. These are explicit experimental defaults; if indefinite pinning appears, test one intervening-action cooldown as a separate recorded variant. Do not ship two unobserved tuning systems.
- [ ] Pin escape resolution: standing on designated exit, action takes a turn, enemy/hazard response, death takes priority, otherwise extraction. Old rules unchanged. No enemy-clear requirement in experimental rules.
- [ ] Define event schema `PlayEvent {runId, rulesVersion, fixtureId, seq, turn, action, hpBefore, hpAfter, cause?, outcome?}`; no credentials or hidden reward locations in public views. Record optional-cache visit, kit and extraction choice as private test observations.
Output: reviewable rules table and session script. Gate: resolve conflicting mechanics in writing, no implementer silently chooses them.

## One excellent expedition

### P03 — Implement displacement in practice (P02)
Files: `packages/game/src/actions.ts`, `combat.ts`, `state.ts`; new `packages/game/test/shove.test.ts`; `apps/web/src/Run.tsx`, `packages/game/src/controls.ts` as needed.
- [ ] Tests cover wall/occupied boundary, wrong weapon, remote target, inactive run, spike phase (and cooldown if that variant is adopted), displaced charger path and no silent re-aim.
- [ ] Add `{type:'shove';enemyId:string}` with one explicit saved rules version/configuration. Optional cooldown state is added only if the measured variant needs it. Older saved states default to legacy rules, never opt in implicitly.
- [ ] Expose an action beside attack with a clear disabled reason; preview committed response without hidden-state leakage.
- [ ] Run focused/game tests and keyboard/pointer rehearsal. Record one useful shove and one rejected move; inspect potential infinite pinning.
Output: deterministic practice shove; no new economic item type or paid mechanic yet.

### P04 — Implement extraction under threat (P02; can develop separately from P03)
Files: `actions.ts`, `generation.ts`, `state.ts`, `Run.tsx`; new `packages/game/test/risky-extraction.test.ts`.
- [ ] Tests: wrong tile invalid; living enemies allowed under experimental rules; response kills player means death; surviving response means extraction; old rules still require clear; repeated terminal action inert.
- [ ] Add separate exit eligibility from cleared-exit continuation so changing extraction cannot accidentally change floor descent/shrine eligibility.
- [ ] Preview danger and action timing on the extract button. Keep a safe path out possible; do not force taking optional loot.
Output: one unambiguous terminal result and an understandable decision.

### P05 — Author one encounter and reproducible routes (P03/P04)
Files: new `content/playtests/smugglers-choice.json`; game fixture loader and new fixture-validation test.
- [ ] Build baseline geometry with charger lane, pursuer, two readable spikes and optional reward detour; no spawn ambush or mandatory damage.
- [ ] Record two reproducible routes: ignore the cache and escape; take the detour and extract a funded-in-practice find. Label all practice items synthetic, not economic funding. Additional fixtures are created only when a playtest hypothesis needs one.
- [ ] Validate reachability, unique IDs, spawn/exit/socket bounds and deterministic replay. Hand-play plausible clear, evade and early-escape routes; no assertion that a solver proves fun.
Output: one fixture, deterministic action traces and intended decisions; no production content expansion.

### P06a — Capture a bounded diagnostic trace (P03–P05)
Files: new `packages/game/src/play-events.ts` and tests; practice integration in `apps/web/src/Run.tsx`; `docs/playtests/`.
- [ ] Implement the P02 event contract from pre/post engine state; capture damage causes before the combat display truncates its log. Keep 2,048 events per test session with an explicit truncation indicator, never unbounded storage.
- [ ] Test repeated action IDs/sequence interpretation, terminal events, HP deltas and export without credentials or undiscovered item/location data in public output. Diagnostic observer access must remain local and deliberate.
- [ ] Replay the P05 action traces and compare outcomes. Record fixture/rules version and kit in the export.
Output: reproducible test-session evidence, not a public replay product.

### P06b — Make consequences readable in existing windows (P06a)
Files: `Run.tsx`, `GamePanels.tsx`, existing `tileset.tsx`/`tileset.css` only if needed; preserve `fixed-windows.css` geometry.
- [ ] Show shove destination, committed response, recovery, damage source, inventory action cost and extract warning. Use the existing paged journal; no new window or replay editor.
- [ ] Return screen gives a concise outcome and retry/re-equip choice. Free practice awards no economic goods.
- [ ] Check 1366×768 and 390×844, keyboard, pointer, reduced motion and longer messages. Compare map bounding boxes before/after opening panels; assert document scrollHeight ≤ viewport height and scrollWidth ≤ viewport width, and visible controls remain inside the inspector.
- [ ] Capture screenshot/console evidence through Aside. These sizes preserve existing verified behavior, not a claim of support for every mobile device.
Output: legible decisions with the current fixed layout retained.

### P07 — Observe first human sessions (P06b)
Files: `docs/playtests/session-<anonymous-id>.md`, consented event exports.
- [ ] Andrew first: one initial attempt, then neutrally offer stopping or another (up to three), initially without coaching; ask him to choose kit, assess a threat and decide when to leave. Record interventions explicitly. Separate voluntary repeats from assigned learning trials; any 1–5 scores are descriptive, not a numerical certification of fun.
- [ ] Then recruit 3–5 willing people through user-arranged sessions; do not message anyone automatically. Include different prior roguelike experience; offer keyboard/pointer choice.
- [ ] After each run ask: what did you expect; what surprised you; what would you do differently? After final run offer stop/another run neutrally. Do not imply payout is the reason to continue.
- [ ] Record actions, understandable/unclear loss, kit/route change, optional-loot decision, replay choice and exact comments. No inferred emotions or fabricated users.
Gate: Andrew gives an explicit observed-play verdict on whether the core is worth iterating. Collect outside-player observations when available; missing outside sessions remain missing evidence and prohibit claims of broader acceptance. Small samples diagnose problems, not prove retention. If Andrew and other human testers are unavailable, technical work may continue in parallel; gameplay gate stays OPEN, not passed.

### P08 — Refine one cause at a time (P07)
Files: rules/fixtures, tuning log, affected tests.
- [ ] Classify observed failures: unclear input, unreadable threat, dominant kit, tedious safe loop, arbitrary loss, irrelevant treasure or no reason to return.
- [ ] Choose highest-impact failure, state hypothesis, change one primary variable and retain prior version. Example: relocate charger approach before adding enemy types.
- [ ] Re-run regression tests and 2–3 short human sessions; include an unfamiliar participant when possible. Stop after two unsuccessful rounds for explicit redesign review, not endless tweaking or content padding.
- [ ] Record accepted/rejected variants and why. Do not optimize for forced deaths or mandatory abandoned loot.
Gate G1: accepted core decision loop with evidence. If rejected, keep P09 onward out of paid-facing integration; source-independent accounting work may proceed.

## Connect the accepted loop to the economy

### P09 — Define promotion boundary (G1)
Files: new `docs/protocol/gameplay-v4.md`; `types.ts`, Rust `model.rs` and `editions.rs` (the latter currently permits only rules 1, 2 and 3).
- [ ] Trace every rules-version check, saved-state decoder and builder publication path; enumerate migrations and existing in-flight versions.
- [ ] Define new version for accepted gameplay and how authored layouts opt in. Old layout/terms hashes unchanged. New tests prove legacy runs resume with their admitted rules.
- [ ] Map new state/action fields to server validation and immutable admitted configuration. No synthetic practice rewards cross admission. Keep the existing `extract` action name and version its eligibility/response; do not add a second `escape` API verb.
Output: version/migration checklist and backwards-compatibility cases.

### P10 — Promote authoritative gameplay safely (P09)
Files: `apps/server/src/runs.ts`, `http.ts`, shared version validation, Rust edition validation, `FloorBuilder.tsx`; game/server/contract tests.
- [ ] Implement smallest versioned admission and action change; contract still verifies economic partition, not combat truth.
- [ ] Test extraction-vs-death/expiry, duplicate actions, stale sequences, crash after action-before-settlement, restart, void and late settlement. Assert exact item IDs in all origin partitions.
- [ ] Test no-reward version; four concurrent runs reject a fifth, settling one permits a subsequent admission; zero-loot extraction counts as an extracted attempt and zero loot sample; consumed potion then death; old editions plus new editions. Verify quote changes don't affect admitted runs.
- [ ] Run affected server/contract suites, WASM build and typecheck. Update builder publication/version routing without forcing a new global socket shape. Use an isolated disposable local sandbox with explicit test grants; never migrate/reset user's current state as a shortcut. Practice fixture can be one floor, but current funded publications require 2–4 floors: promote the accepted encounter as an authored floor in a valid two-floor edition and human-test the complete run. Relaxing the floor-count contract is not implicitly authorized by this plan.
Output: reliable funded loop with existing custody/trust limitations disclosed.

### P11 — Play one complete trade circuit (P10)
Files: existing Shop/Crafting/Maker/Demo flows; new `docs/playtests/trade-circuit.md`, scenario integration test.
- [ ] Separate labeled artisan, maker and adventurer profiles. Use ordinary finite listings and recorded stock; disclose initial grants.
- [ ] Artisan crafts existing tonic batch; maker buys/funds; adventurer buys kit/potion, enters, consumes or extracts, returns and sells/keeps goods. Record exact inventories/receipts each step.
- [ ] Repeat with death and no-treasure edition. Fees/forfeitures/stock movements must follow fixed rules. Show pending settlement honestly.
- [ ] Observe whether a participant can say what they want to buy or produce next. Local role-switching proves plumbing, not organic demand.
Gate: end-to-end loop works without developer intervention; otherwise fix the transition that fails before more content.

### P12 — Improve one artisan/shop decision (P11)
Files: `Crafting.tsx`, `Shop.tsx`, server craft as needed; `docs/playtests/merchant-loop.md`.
- [ ] Observe production choice, batch minigame and actual sale. Measure repetitive waiting, unclear output, stock visibility and unprofitable pricing misunderstandings.
- [ ] Change one evidenced problem: shorten redundant timing waits, clarify batch cost/output, or expose available buyer/stock information. Do not add recipes simply to fill a menu.
- [ ] Re-test with 2–3 users, including a person who prefers town play. Keep per-batch minigame; label automation limitations.
Output: an observed better production/sale decision. New recipes/buy orders require evidence of unmet demand, not assumed value.

### P13a — Specify economic cost provenance (P01; independent of combat)
Files: new `docs/protocol/cost-provenance.md`; inspect market/craft receipts and item history.
- [ ] Define `CostRecord` with item ID, currency, known actual amount or explicit unknown reason, source receipt IDs, derivation and schema version. Immutable idempotent event key includes receipt ID and output item ID; never overwrite history to make a margin look better.
- [ ] Pin deterministic batch allocation: known total input/acquisition fees divided by number of outputs in smallest units; remainder assigned by sorted output ID. Record free grants as provenance with unknown economic acquisition basis rather than assert profit. Gifted items lack recipient market acquisition cost; do not silently infer donor cost.
- [ ] Distinguish current-owner acquisition basis, maker edition expense, cash flow and replacement-value scenarios; consumption/transfer is not a second purchase expense. Enumerate missing historical data; no retroactive fabricated basis.
Output: schema, concrete worked examples and unknown-cost display contract. This work is mandatory before an unqualified profit claim, not before first human combat feedback.

### P13b — Implement and verify the provenance projection (P13a)
Files: new `apps/server/src/cost-basis.ts`, `apps/server/test/cost-basis.test.ts`; existing receipt processing/SQLite records as needed.
- [ ] Implement idempotent observation of confirmed purchase/craft events with the defined event keys. Read canonical receipts, never browser prices. Pending/rejected operations cannot create cost entries.
- [ ] Test buy→craft→list→sale and buy→fund→refresh→close; same receipt twice; restart/rebuild; unknown seed/gift; uneven batch allocation; sold-then-resold item and consumed input. A new owner's basis is that purchase, not accumulated previous owners' costs.
- [ ] Preserve all inventory/credit behavior. Reconcile known projection totals against source receipts and surface gaps explicitly.
Output: auditable known/unknown cost records, no changed market or settlement rules.

### P13c — Display qualified business results (P13b/P11)
Files: `Maker.tsx`, `Wallet.tsx`, relevant read-only API view and tests.
- [ ] Closed-edition contribution deducts all committed treasure acquisition/placement costs exactly once; closure leftovers are never a maker refund. Pending fees excluded; open edition provisional. Any unknown cost suppresses unqualified net profit.
- [ ] Distinguish cash flow, reference inventory value, known contribution and replacement-cost estimate in existing fixed panels. Labor time is separately disclosed, not invented wages.
- [ ] Show a participant a profitable fixture, losing fixture and unknown-cost fixture; verify they can explain the difference. Browser/test evidence covers layout and arithmetic, not economic viability.
Output: truthful results that support maker decisions.

### P14 — Harden transparency and maker feedback (P11; existing feature preserved)
Files: `edition-record.ts` server/shared, `EditionRecord.tsx`, `Maker.tsx`, `matcher.ts`, tests.
- [ ] Re-verify zero-loot losses, mean/median, durations with coverage, confirmed outcomes and exclusion of void/active. Show current fee/pool alongside historical population; no winner-only averages.
- [ ] Maker sees the same public record. Room/outcome observations from consenting tests stay in playtest notes unless later evidence justifies a product feature; no hidden identity or unvisited loot leakage.
- [ ] Only if observed discovery blocks useful offers, and with several eligible editions, compare cheapest-first against explicit-filter+rotation discovery including an under-observed offer. No fake popularity, guaranteed impressions or completion-rate-only ranking.
- [ ] Test fee changes, refresh depletion, mixed skill, tiny samples and alt profiles. Clearly label limitations; don't claim Sybil resistance.
Output: informed player choice and useful maker feedback without changing return rules.

### P15 — Test the full human loop (P11/P12/P14; P13c before profit claims)
- [ ] 3–5 people, roles chosen freely; sequential sessions can expose usability, simultaneous play not required to prove plumbing. Record whether low population prevents a desired trade.
- [ ] Observe preparation→run→return→sale/craft→another plan. Include a loss, cheap recovery path and voluntarily chosen no-reward attraction; never force spending for test success.
- [ ] Run a maker iteration: watch problems, revise a new edition, keep old record, test again. Record attendance intention and costs separately.
- [ ] Ask players to explain fees, loot averages, gear loss and maker incentives. Averages understood incorrectly trigger UI refinement.
Gate G2: participants can complete and explain the circuit; at least some voluntarily seek another attempt or transaction. This is formative acceptance, not a stable-market claim.

### P16 — Stress low-population and depleted-budget scenarios (P13a/P14; P13b for cost-projection checks)
Files: extend scenario tests first; create `scripts/simulate-economy.ts` only if reusable orchestration is needed; `docs/playtests/economy-scenarios.md`.
- [ ] Use deterministic 1/5/20-profile scenarios, repeated players with no new grants, high/low extraction, consumption, empty pool, unsold shop goods, depleted NPC budget, collusive extraction and refunds.
- [ ] Report all coin transfers, budget ownership, item consumption/transformation and inventory buildup. Goods/coins banked are transfers, not burns. Never infer real demand from simulated policies.
- [ ] Verify conservation, no double fill/duplicate credit, complete reservations, closed edition bank transfer, recovery caps and unknown-cost behavior.
Output: explicit dead ends and subsidies. Repair rules only through documented proposals, not concealed minting.

### P17 — Refine the weakest economic link (G2/P16)
- [ ] Choose one evidenced bottleneck: inability to find buyers, recovery too tedious, maker stock loss, unclear price, or insufficient differentiated demand.
- [ ] Pick smallest intervention and forecast its side effects. New orders need escrow/expiry/partial-fill specification; a second recipe needs a combat use and stock source; neither enters automatically.
- [ ] Change, verify, repeat targeted human sessions and stress scenarios. After two unsuccessful rounds, narrow/redesign and report; do not mark viable by fiat.
Output: decision log and revised accepted loop, or honest unresolved blocker.

### P18 — Independent final review and acceptance (P08/P10–P17)
- [ ] Reproduce the intended source snapshot: record revision plus task patch manifest, or use a committed local worktree under `.claude/worktrees/`. A clean checkout omitting dirty work is not reproduction. Never create sibling/home repo copies or perform a broad cleanup.
- [ ] Reviewer traces one success, loss, void and crash/recovery using source+evidence; reconcile technical findings before final verification.
- [ ] Run `npm run typecheck`, `npm run test:game`, `npm run test:server`, `npm run test:contract`, `npm run build:contract`, `npm run build` as relevant to final changes. Record actual counts, failures and retries.
- [ ] Aside walkthrough fixed desktop/phone windows, keyboard, invalid actions, transactions/pending states and transparency; no external actions.
- [ ] Human acceptance explicitly separate: Andrew's verdict, participant sessions, unresolved feedback, market limitations and next measured experiment. Link artifacts in a final report. Stop before any release/testnet step.

## Minimum and later

Minimum convincing local deliverable is P01–P11 plus truthful existing transparency: a human-accepted expedition and working supply/trade cycle. P13a–c become mandatory before any profit claim. P12/P13a–c/P14–P17 establish better economy play, not prerequisites to observing the first run. Later catalog expansion, buy orders, procedural families and social luxuries must earn a place through evidence. No contest-date promise; estimate the next card only after its dependencies are observed.

## Execution roles, boundaries and evidence

One implementer owns a card; the other model reviews its actual source diff and acceptance evidence. Default ownership at execution: Codex owns P01–P06b and P09–P11; Claude owns P13a–c after schema agreement; Codex integrates and both review. Human sessions are facilitated by Andrew or an explicitly arranged observer; agents prepare kits and summarize actual notes only. P12/P14/P16/P17 ownership is assigned once its evidence-triggered scope is known. Do not start concurrent edits to shared types, HTTP routes, Run.tsx or engine state. Work in permitted repo-local isolation when parallel implementation is useful.

Each card records: owner/reviewer, dependency status, exact files, expected/observed result, command exit codes, artifact paths, remaining issues. Reviewer findings are either fixed with evidence or explicitly deferred with consequence. A card cannot be DONE merely because implementation exists. Human-dependent cards remain WAITING FOR HUMAN EVIDENCE if sessions have not happened. Independent accounting/source review may continue meanwhile. None of these statuses authorizes external actions.

## Human script (use with P07 and P15)

1. Explain this is an unfinished local game with synthetic funds. Ask permission to retain anonymous notes; recording/video is optional and separately agreed. Offer stopping at any time. Never reset existing user state; use isolated fixtures.
2. First practice attempt: “Choose a kit, explore, and leave when you think you should.” Observe quietly; record confusion, pause, accidental input and coaching.
3. Ask “What did you expect?”, “Why did that happen?”, “What would you change next time?” Offer stop/another attempt without praising either choice. Optional instructed trials are labeled instructed.
4. Later economy session: ask the player to prepare, enter, return and pursue their next objective. Artisan/maker roles get real finite stock and actual counterpart transactions, not imagined demand. Explain how many starting grants were provided.
5. Show track records: ask what average loot means, whether failures are included, and whether it promises a cash return. Ask a maker what they would change and why, then observe an actual new edition if feasible.
6. Close with “What would make you want to return?” Capture exact words and behavioral evidence. Do not replace negative observations with a mean satisfaction score.

## Gate record and refinement rule

G1 (P08): readable, worthwhile core as judged by Andrew with observed attempts; record outside-player evidence or its absence separately. G2 (P15): complete, understandable trade circuit and reasons to repeat; distinguish plumbing from genuine demand. Final acceptance (P18): technical verification plus documented human verdict; no automatic statistical threshold.

Every refinement record states: observation → hypothesis → one main change → predicted effect → risks → fixture/rules version → test/play evidence → keep/revert/rethink. Two unsuccessful rounds trigger review, not an automatic claim of completion or permanent abandonment. Continue only with a specific new hypothesis or narrowed goal. Lack of participants never becomes synthetic acceptance.
