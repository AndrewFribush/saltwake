# Gameplay and Economy Implementation Plan — independent Codex draft

> **For agentic workers:** Execute task-by-task using superpowers:subagent-driven-development or superpowers:executing-plans. Keep checkboxes open until their evidence exists. This draft is input to cross-review, not the merged authority.

**Goal:** Make preparing, adventuring, extracting or losing, trading and authoring form a repeatable game people choose to play.

**Architecture:** Deepen the existing deterministic tile engine first in free practice. Promote accepted mechanics through explicit versioned server/contract boundaries, then improve economic choices and maker feedback using authoritative records. Preserve the fixed-window shell.

**Tech Stack:** TypeScript, React/Vite, SQLite authoritative server/outbox, Rust local NEAR sandbox.

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
4. Reused/gifted/seeded/transformed goods must not create fictitious profit or double-count costs (P13).
5. Human tests must expose confusion, coercive recovery and small-sample bias rather than optimize only success rates (P07/P15/P18).

## Working method and sizing

Each engineering card targets one reviewable deliverable, roughly 30–120 focused minutes after prerequisites; estimates are planning ranges, not deadlines. Split any card that exceeds this into subcards before marking progress. Human sessions are separate scheduled work, not agent time estimates. Correctness tests should fail for the intended missing behavior, then pass after implementation; no tests that merely mirror a CSS change. Commit only task-scoped files when appropriate; preserve existing uncommitted work, never `git add .`, no push or production merge. A second model reviews source when the eventual implementation warrants it; the cross-review here concerns plans only.

## Baseline and experiment contract

### P01 — Freeze a reproducible baseline (no dependencies)
Files: new `docs/playtests/baseline.md`; existing package scripts and verification reports.
- [ ] Record git revision plus dirty diff inventory/hash; do not print `.state/sandbox.json` or include keys in artifacts.
- [ ] Record existing catalog/combat values, tested viewport sizes and local startup commands. Capture a free-practice trace and current shop/return path without spending or resetting live local state.
- [ ] Run game tests/typecheck/build; document baseline failures separately from new regressions. Preserve current practice as a comparison fixture rather than replacing its evidence.
Output: reproducible fixture ID/version and baseline evidence, not a fun verdict. Checkpoint: reviewer can replay the same starting situation.

### P02 — Pin the experimental rules and observations (P01)
Files: new `docs/playtests/smugglers-choice-rules.md`, `docs/playtests/session-template.md`.
- [ ] Record proposed one-floor/two-space fixture, club/sword/tonic kits, optional cache and reachable extraction tile. Preserve existing HP/damage/healing initially.
- [ ] Specify shove targeting, displacement, cooldown, collision, intent interaction and turn costs before code. Proposed safety default: club only, adjacent target, one empty cardinal tile away, no collision damage; one intervening non-shove action before another shove. No extra enemy phase on an invalid action. A displaced committed attack may only resolve if its original path/adjacency is still legal; otherwise fizzles without retargeting. Threat preview must predict this. These are tuning proposals; record any change.
- [ ] Pin escape resolution: standing on designated exit, action takes a turn, enemy/hazard response, death takes priority, otherwise extraction. Old rules unchanged. No enemy-clear requirement in experimental rules.
- [ ] Define event schema `PlayEvent {runId, rulesVersion, fixtureId, seq, turn, action, hpBefore, hpAfter, cause?, outcome?}`; no credentials or hidden reward locations in public views. Record optional-cache visit, kit and extraction choice as private test observations.
Output: reviewable rules table and session script. Gate: resolve conflicting mechanics in writing, no implementer silently chooses them.

## One excellent expedition

### P03 — Implement displacement in practice (P02)
Files: `packages/game/src/actions.ts`, `combat.ts`, `state.ts`; new `packages/game/test/shove.test.ts`; `apps/web/src/Run.tsx`, `controls.ts` as needed.
- [ ] Tests cover wall/occupied boundary, wrong weapon, remote target, inactive run, cooldown, spike phase, displaced charger path and no silent re-aim.
- [ ] Add `{type:'shove';enemyId:string}` with explicit experimental rules guard and saved cooldown state. Older saved states default to legacy rules, never opt in implicitly.
- [ ] Expose an action beside attack with a clear disabled reason; preview committed response without hidden-state leakage.
- [ ] Run focused/game tests and keyboard/pointer rehearsal. Record one useful shove and one rejected move; inspect potential infinite pinning.
Output: deterministic practice shove; no new economic item type or paid mechanic yet.

### P04 — Implement extraction under threat (P02; can develop separately from P03)
Files: `actions.ts`, `generation.ts`, `state.ts`, `Run.tsx`; new `packages/game/test/risky-extraction.test.ts`.
- [ ] Tests: wrong tile invalid; living enemies allowed under experimental rules; response kills player means death; surviving response means extraction; old rules still require clear; repeated terminal action inert.
- [ ] Add separate exit eligibility from cleared-exit continuation so changing extraction cannot accidentally change floor descent/shrine eligibility.
- [ ] Preview danger and action timing on the extract button. Keep a safe path out possible; do not force taking optional loot.
Output: one unambiguous terminal result and an understandable decision.

### P05 — Author the encounter and two variants (P03/P04)
Files: new `content/playtests/smugglers-choice.json`; game fixture loader and new fixture-validation test.
- [ ] Build baseline geometry with charger lane, pursuer, two readable spikes and optional reward detour; no spawn ambush or mandatory damage.
- [ ] Build two small alternatives changing one variable each: cache placement or escape access. Keep item/HP budget constant for comparisons.
- [ ] Validate reachability, unique IDs, spawn/exit/socket bounds and deterministic replay. Hand-play plausible clear, evade and early-escape routes; no assertion that a solver proves fun.
Output: fixtures A/B/C and intended decisions; no production content expansion.

### P06 — Make consequences legible and loggable (P03–P05)
Files: `Run.tsx`, `GamePanels.tsx`; new `packages/game/src/play-events.ts` and tests; `docs/playtests/`.
- [ ] Produce bounded complete test-session action trace from pre/post authoritative engine states, rather than relying on the eight-line combat display log.
- [ ] Show selected target, intent, recovery, damage source, inventory action cost and extract warning. Fixed-window paged journal; no map shift or page scroll.
- [ ] Return screen offers a concise outcome and retry/re-equip choice. Free practice awards no goods. No full replay editor.
- [ ] Check 1366×768 and 390×844, keyboard, reduced motion, and a longer damage message; capture viewport/console evidence.
Output: reproducible decisions, not just final HP screenshots.

### P07 — Observe first human sessions (P06)
Files: `docs/playtests/session-<anonymous-id>.md`, consented event exports.
- [ ] Andrew first: up to three short attempts, initially without coaching; ask him to choose kit, assess a threat and decide when to leave. Record interventions explicitly.
- [ ] Then recruit 3–5 willing people through user-arranged sessions; do not message anyone automatically. Include different prior roguelike experience; offer keyboard/pointer choice.
- [ ] After each run ask: what did you expect; what surprised you; what would you do differently? After final run offer stop/another run neutrally. Do not imply payout is the reason to continue.
- [ ] Record actions, understandable/unclear loss, kit/route change, optional-loot decision, replay choice and exact comments. No inferred emotions or fabricated users.
Gate: Andrew accepts that the core is worth iterating and external participants show legible choices. Small samples diagnose problems, not prove retention. If no people available, technical work may continue in parallel; gameplay gate stays OPEN, not passed.

### P08 — Refine one cause at a time (P07)
Files: rules/fixtures, tuning log, affected tests.
- [ ] Classify observed failures: unclear input, unreadable threat, dominant kit, tedious safe loop, arbitrary loss, irrelevant treasure or no reason to return.
- [ ] Choose highest-impact failure, state hypothesis, change one primary variable and retain prior version. Example: relocate charger approach before adding enemy types.
- [ ] Re-run regression tests and 2–3 short human sessions; include an unfamiliar participant when possible. Stop after two unsuccessful rounds for explicit redesign review, not endless tweaking or content padding.
- [ ] Record accepted/rejected variants and why. Do not optimize for forced deaths or mandatory abandoned loot.
Gate G1: accepted core decision loop with evidence. If rejected, keep P09 onward out of paid-facing integration; source-independent accounting work may proceed.

## Connect the accepted loop to the economy

### P09 — Define promotion boundary (G1)
Files: new `docs/protocol/gameplay-v4.md`; `types.ts`, Rust `model.rs`/validation source identified during execution.
- [ ] Trace every rules-version check, saved-state decoder and builder publication path; enumerate migrations and existing in-flight versions.
- [ ] Define new version for accepted gameplay and how authored layouts opt in. Old layout/terms hashes unchanged. New tests prove legacy runs resume with their admitted rules.
- [ ] Map new state/action fields to server validation and immutable admitted configuration. No synthetic practice rewards cross admission.
Output: version/migration checklist and backwards-compatibility cases.

### P10 — Promote authoritative gameplay safely (P09)
Files: `apps/server/src/runs.ts`, `http.ts`, shared version validation, Rust edition validation, `FloorBuilder.tsx`; game/server/contract tests.
- [ ] Implement smallest versioned admission and action change; contract still verifies economic partition, not combat truth.
- [ ] Test extraction-vs-death/expiry, duplicate actions, stale sequences, crash after action-before-settlement, restart, void and late settlement. Assert exact item IDs in all origin partitions.
- [ ] Test no-reward version, concurrent reservations, consumed potion then death, old editions plus new editions. Verify quote changes don't affect admitted runs.
- [ ] Run affected server/contract suites, WASM build and typecheck. Use isolated local sandbox; never migrate/reset user's current state as a shortcut.
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

### P13 — Record costs before displaying profit (parallel after P01; integration after P11)
Files: new `apps/server/src/cost-basis.ts`, new server tests; existing market/craft receipt handling, `Maker.tsx`, `Wallet.tsx`.
- [ ] Specify immutable cost events linked to authoritative receipt/lot IDs. Purchases use actual prices; crafts allocate known input cost deterministically across outputs; seeded/gifted/unknown history stays labeled unknown, not zero. Labor time separately disclosed.
- [ ] Demonstrate cost lineage through buy→craft→list→sale and buy→fund→refresh→close, with retry/restart and a consumed input. Don't expense an input twice.
- [ ] Maker closed-edition contribution deducts all committed treasure acquisition/placement costs once; leftovers never refunded. Pending fees excluded; open results provisional. If any cost unknown, no unqualified net-profit number.
- [ ] Distinguish cash flow, inventory reference value, realized contribution and replacement-cost estimate in fixed panels.
Output: auditable economic result, not a promised return.

### P14 — Harden transparency and maker feedback (P11; existing feature preserved)
Files: `edition-record.ts` server/shared, `EditionRecord.tsx`, `Maker.tsx`, `matcher.ts`, tests.
- [ ] Re-verify zero-loot losses, mean/median, durations with coverage, confirmed outcomes and exclusion of void/active. Show current fee/pool alongside historical population; no winner-only averages.
- [ ] Maker sees same public record plus room/outcome observations from consenting tests; no hidden player identity or unvisited loot leakage.
- [ ] With several eligible editions, compare cheapest-first against explicit-filter+rotation discovery including an under-observed offer. No fake popularity, guaranteed impressions or completion-rate-only ranking.
- [ ] Test fee changes, refresh depletion, mixed skill, tiny samples and alt profiles. Clearly label limitations; don't claim Sybil resistance.
Output: informed player choice and useful maker feedback without changing return rules.

### P15 — Test the full human loop (P11–P14)
- [ ] 3–5 people, roles chosen freely; sequential sessions can expose usability, simultaneous play not required to prove plumbing. Record whether low population prevents a desired trade.
- [ ] Observe preparation→run→return→sale/craft→another plan. Include a loss, cheap recovery path and voluntarily chosen no-reward attraction; never force spending for test success.
- [ ] Run a maker iteration: watch problems, revise a new edition, keep old record, test again. Record attendance intention and costs separately.
- [ ] Ask players to explain fees, loot averages, gear loss and maker incentives. Averages understood incorrectly trigger UI refinement.
Gate G2: participants can complete and explain the circuit; at least some voluntarily seek another attempt or transaction. This is formative acceptance, not a stable-market claim.

### P16 — Stress low-population and depleted-budget scenarios (P13/P14)
Files: new `scripts/simulate-economy.ts`, tests and `docs/playtests/economy-scenarios.md`.
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
- [ ] Reviewer traces one success, loss, void and crash/recovery using source+evidence; reconcile technical findings before final verification.
- [ ] Run `npm run typecheck`, `npm run test:game`, `npm run test:server`, `npm run test:contract`, `npm run build:contract`, `npm run build` as relevant to final changes. Record actual counts, failures and retries.
- [ ] Aside walkthrough fixed desktop/phone windows, keyboard, invalid actions, transactions/pending states and transparency; no external actions.
- [ ] Human acceptance explicitly separate: Andrew's verdict, participant sessions, unresolved feedback, market limitations and next measured experiment. Link artifacts in a final report. Stop before any release/testnet step.

## Minimum and later

Minimum convincing local deliverable is P01–P11 plus truthful existing transparency: a human-accepted expedition and working supply/trade cycle. P13 becomes mandatory before any profit claim. P12/P14–P17 establish better economy play, not prerequisites to observing the first run. Later catalog expansion, buy orders, procedural families and social luxuries must earn a place through evidence. No contest-date promise; estimate the next card only after its dependencies are observed.
