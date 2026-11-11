I'll write my independent plan now, with no tool use, grounded only in the source and constraints you supplied.

# Dungeon/Economy Loop v1 — Independent Implementation Plan (Claude)

## 0. Framing

**Goal.** Turn the existing walkable town, paid gate, authored floors, shops, artisan batches and transparency pages into a loop that humans choose to repeat: enter a maker-funded floor, make two or three real tactical decisions, leave with or without loot, and feel the economy respond.

**What this plan does not do.** It does not touch death disposition, maker refund rules, the max_runs=4 concurrent cap, the funded-and-reserved reward rule, or any transaction, restart or idempotency guard. It does not add mandatory oil, new recipes, commissions or replays. It does not claim any playtest has happened. It does not promise that makers or players profit.

**Scope assumption.** The only new gameplay content is the proposed tactical experiment: club shove, one authored floor with an optional cache, and escape without a full clear with enemies responding first. Everything else is wiring, UI containment, testing, human playtesting and refinement.

**Task sizes.** S is under one hour, M is one to three hours, L is half a day. Each step has one owner (Claude or Codex, assigned at merge) and ends with evidence written to disk, not a verbal claim.

**Evidence locations.** Engine and server evidence goes in `docs/evidence/loop-v1/`. The verification doc is `docs/loop-verification.md`. Human session notes go in `docs/playtest/loop-v1/`. Existing `docs/transparency-verification.md` and `docs/integration-verification.md` are referenced, not rewritten.

---

## Phase 0 — Baseline and guardrails

### P0-1 Freeze a baseline evidence snapshot (S)
Depends on: nothing.
Run the full existing suite and store exit codes and summary output.
Files: `docs/evidence/loop-v1/00-baseline.md`.
Commands: `npm run typecheck`, `npm run test:game`, `npm run test:server`, `npm run build`, `npm run build:contract`, `npm run test:contract`.
Acceptance: every command's exit code recorded. If any fails today, that failure is written down as pre-existing and is not attributed to this work later.

### P0-2 Write the invariant list the loop must not break (S)
Depends on: P0-1.
One file listing, in plain language with the source rule beside each: death disposition partition, town gear forfeit to bank, consumed stays consumed, closure leftovers to bank, no maker refund, fee retention on ordinary outcomes, reward funded and reserved before admission, concurrent cap of 4, no-reward attractions valid, idempotent settle and void, restart recovery.
Files: `docs/design/loop-v1-invariants.md`.
Acceptance: Andrew reads it and marks each line "correct" or "wrong" before Phase 3 starts. This is the only human gate in Phase 0.

### P0-3 Name the exact test files that already cover each invariant (S)
Depends on: P0-2.
Read `apps/server/test/`, `packages/game/test/`, `tests/contract/` and map each invariant to the existing test name, or write "uncovered".
Files: `docs/design/loop-v1-invariants.md` (append a coverage column).
Acceptance: no invariant is left blank. Uncovered rows become new tests in Phase 6 (V6-3).

---

## Phase 1 — Tactical experiment in the pure engine

All Phase 1 work is in `packages/game/` only. No UI, no server. Each step adds a test before it adds behaviour.

### T1-1 Add the `shove` action type and validation (S)
Depends on: P0-1.
Files: `packages/game/src/actions.ts`, `packages/game/src/state.ts`.
Change: extend `Action` with `{type:'shove';enemyId:string}`. Validation mirrors `attack`: target adjacent, player weapon is `club`. Allowed key list gains the `shove` entry.
Acceptance: `packages/game/test/shove.test.ts` proves an invalid shove returns the same state object unchanged, and that a sword holder cannot shove. Rationale is written in the test header: the club is the cheap town starter, shove gives it a reason to exist next to the sword.

### T1-2 Implement shove displacement (M)
Depends on: T1-1.
Files: `packages/game/src/actions.ts`, `packages/game/src/combat.ts`.
Rule: the enemy moves one tile directly away from the player along the axis of contact. If that tile is not walkable or is occupied by another living enemy, the shove is rejected (returns `s`). Shove deals no damage. Shove spends the turn, so `resolveEnemies` runs afterwards with the existing turn-local guard semantics unchanged. A shoved enemy onto an armed spike tile takes damage through the existing trap loop, with no special case added.
Acceptance: tests for push into open tile, push rejected against wall, push rejected into another enemy, push onto armed spikes applies the existing 3 damage, charger lane is recomputed by the existing `revealIntents` after displacement. Log line format recorded in the test.

### T1-3 Decide and test "stagger" as a tunable, default off (S)
Depends on: T1-2.
Files: `packages/game/src/combat.ts`, `packages/game/src/state.ts`.
Add an optional `rules.shoveStaggers` flag on `RunState` (default false). When true, a shoved enemy gets `recovering=true` and loses its next action. This is the one tactical knob the playtest will turn.
Acceptance: one test per flag value. The default-off path produces byte-identical results to T1-2's tests.

### T1-4 Add the `escape` action (M)
Depends on: T1-1.
Files: `packages/game/src/actions.ts`, `packages/game/src/generation.ts`.
Rule: `escape` is valid when the player stands on the room exit and at least one enemy is alive. Existing `extract` is unchanged and still requires a cleared exit. Resolution order: increment turn, call `resolveEnemies` with guard false, then if `player.hp>0` set `status='extracted'` and log "You escaped with enemies still breathing." If hp reaches zero the existing died path applies.
Acceptance: tests for escape succeeds when the alerted pursuer is two tiles away, escape fails when a charger lane covers the exit and damage kills the player, escape with a guard action on the previous turn does not carry the guard into the escape turn, and escape is rejected when the room is already clear (player must use `extract`). Items held at escape are whatever is in `items` at that moment; no new inventory rule.

### T1-5 Author one floor with an optional cache (M)
Depends on: T1-2, T1-4.
Files: `packages/game/src/generation.ts`, `packages/game/src/funded-layout.ts`, `packages/game/test/floor-cache.test.ts`.
Content: a single `RoomLayout` titled "Flooded Larder". Spawn, a short main corridor to the exit, one pursuer on the main route, and a side room reachable through a doorway on the grid that holds one reward slot flanked by a charger lane and an armed spike tile. The reward slot is mapped through the existing socket room and slot indices so that a maker can fund the cache or leave it empty. The side room must be optional: a player can reach the exit without entering it.
Acceptance: test asserts a walkable path spawn to exit that never touches a cache tile, asserts the cache slot resolves to a socket index that `funded-layout.ts` can fill, and asserts a scripted sequence (walk, shove charger onto spikes, pick up reward, escape) ends `extracted` with the reward in inventory. A second scripted sequence (ignore cache, walk to exit, escape) ends `extracted` with no dungeon items. If `funded-layout.ts` cannot express an off-path slot with its current indices, stop and report rather than change `Socket` in `packages/shared/src/types.ts`.

### T1-6 Deterministic replay fixture for the floor (S)
Depends on: T1-5.
Files: `packages/game/test/fixtures/flooded-larder.json`.
A fixed seed, fixed socket funding, and the two scripted action lists from T1-5, stored as data so the server and UI phases can reuse the same scenario.
Acceptance: a test loads the fixture and reproduces the two outcomes.

**Phase 1 gate.** `npm run test:game` and `npm run typecheck` pass with evidence in `docs/evidence/loop-v1/10-engine.md`. Codex reviews the engine diff against the invariants file. No UI work starts until that review is written down.

---

## Phase 2 — Fixed-window UI for the new actions

### U2-1 Confirm the current run window inventory of controls (S)
Depends on: nothing.
Read `apps/web/src/Run.tsx` and `apps/web/src/GamePanels.tsx` and list the existing action controls, keyboard bindings and panel sizes. Do not change anything.
Files: `docs/design/loop-v1-ui-inventory.md`.
Acceptance: list exists. This prevents inventing a layout that collides with the fixed-window rules in `apps/web/src/fixed-windows.css`.

### U2-2 Add shove and escape controls inside the existing run window (M)
Depends on: U2-1, T1-4.
Files: `apps/web/src/Run.tsx`, `apps/web/src/GamePanels.tsx`, `apps/web/src/game-screen.css`.
Shove appears only when the player holds the club and an adjacent enemy exists; it is targeted the same way attack is. Escape appears only when the player stands on the exit with enemies alive, with the hint text "Enemies act first." No new panel, no new window, no page scroll, no modal.
Acceptance: window dimensions before and after the change are identical at the project's fixed viewport. Evidence screenshot pair in `docs/evidence/loop-v1/20-run-window-before.png` and `-after.png`, plus a line in `docs/loop-verification.md` confirming `document.scrollingElement.scrollHeight` equals the viewport height in both states.

### U2-3 Telegraph shove destination and escape risk (M)
Depends on: U2-2.
Files: `apps/web/src/Run.tsx`, `apps/web/src/tileset.tsx`, `apps/web/src/tileset.css`.
When hovering or selecting shove, highlight the destination tile and show whether it is spikes. When standing on the exit with enemies alive, highlight every enemy whose current intent or charger lane reaches the player tile. These reuse the existing `intent` and `lane` data; no new engine query.
Acceptance: a Vite dev screenshot with the fixture from T1-6 at the moment before the scripted shove, and one before the scripted escape, both filed under evidence. Readability itself is judged by humans in Phase 4, not here.

### U2-4 Floor Builder exposure of the cache slot (S)
Depends on: T1-5.
Files: `apps/web/src/FloorBuilder.tsx`, `apps/web/src/Maker.tsx`.
The maker sees the cache socket labelled "optional cache" and can fund it, or leave it unfunded as a no-reward attraction. Fee entry and refresh paths are untouched.
Acceptance: screenshot of the builder with the cache labelled, and a typecheck pass.

**Phase 2 gate.** `npm run build` and `npm run typecheck` pass. Andrew confirms in one line that the run window still fits the fixed screen on his machine.

---

## Phase 3 — Server and economy wiring

The engine change must not alter any settlement or disposition rule. Phase 3 is mostly proof.

### S3-1 Server accepts the new actions through the existing action path (S)
Depends on: T1-4.
Files: `apps/server/src/runs.ts`, `apps/server/src/http.ts`.
If the server validates action shapes before passing to `act`, add `shove` and `escape` to that allow list. If it forwards opaque actions to the engine, record that fact and change nothing.
Acceptance: a server test posts the two fixture action lists from T1-6 and gets the expected terminal status.

### S3-2 Prove escape settles identically to extract (M)
Depends on: S3-1.
Files: `apps/server/test/escape-settlement.test.ts`.
Play the fixture to an escape with the cache reward in hand. Assert the settle command has `outcome:'extracted'`, the reward id appears in `dungeon_extracted`, loadout town items appear in `town_returned`, and the maker's fee position is unchanged relative to a cleared extract on the same edition. Then play to a death during the escape turn and assert the reward id appears in `dungeon_returned` and the town club appears in `town_forfeited`.
Acceptance: test passes; the assertion text quotes the invariant line from P0-2.

### S3-3 Restart and idempotency under the new actions (M)
Depends on: S3-2.
Files: `apps/server/test/run-recovery.test.ts` (extend, do not fork).
Kill the server mid-escape sequence, restart, replay the settle, and assert one applied operation with matching `op_id` and `payload_hash`, mirroring the existing recovery test structure.
Acceptance: existing recovery assertions still pass, plus one new case named for escape.

### S3-4 Concurrency cap unchanged (S)
Depends on: S3-1.
Files: `apps/server/test/` (extend the existing admission test).
Admit four runs on the Flooded Larder edition, assert the fifth is refused, settle one by escape, assert the fifth now admits. The cap is concurrent, not lifetime.
Acceptance: test passes; evidence line in `docs/evidence/loop-v1/30-server.md`.

### S3-5 Contract tests: confirm no Rust change is required (S)
Depends on: S3-2.
Files: `tests/contract/`.
Add one contract test that feeds the escape settle payload to the sandbox and asserts the same `EconomicEdition` extracted and consumed values as the cleared-extract payload. If the Rust handler in `contracts/economy/src/settlement.rs` or `runs.rs` rejects it, that is a finding to report, not a reason to edit Rust in this phase.
Acceptance: `npm run test:contract` passes, or a documented blocker.

### S3-6 Transparency record shows the new floor without new fields (S)
Depends on: S3-2.
Files: `apps/server/test/edition-record.test.ts` (extend).
Assert that escape runs are counted as `extracted` in `editionRecord` and that a zero-loot escape pushes a loot sample of zero. No change to `apps/server/src/edition-record.ts` or `packages/shared/src/edition-record.ts`.
Acceptance: test passes.

**Phase 3 gate.** `npm run test:server` and `npm run test:contract` pass. Codex reviews S3-2 and S3-3 line by line against the invariants file.

---

## Phase 4 — Human playtesting

Humans only. No agent output may be recorded as a playtest result. Sessions are local, in person or on Andrew's own machine, with no messages sent to anyone by an agent.

### H4-1 Session kit (S)
Depends on: Phase 2 gate, Phase 3 gate.
Files: `docs/playtest/loop-v1/kit.md`, `docs/playtest/loop-v1/session-template.md`.
The kit is a one-page start checklist: local server up, sandbox reset, a seeded Flooded Larder edition with the cache funded, a second edition with the cache unfunded, a starting wallet that can afford at least five admissions, and the transparency page open in its fixed window.

### H4-2 Human test script (S)
Depends on: H4-1.
Files: `docs/playtest/loop-v1/script.md`.

Script, about thirty minutes per tester:
1. **Cold start, 3 minutes.** Tester walks the town with no instruction except "find a dungeon door and go in." Observer notes whether they find the gate and whether the fee display was understood.
2. **Run one.** No hints. Observer records outcome, duration, loot value, cause of death if any, and whether the cache room was entered.
3. **Run two.** Observer asks "what did the highlighted tiles mean?" before the run, then records the same fields.
4. **Run three.** Tester is told once that the club can shove and that escape is allowed with enemies alive. Same fields.
5. **Shop stop.** Tester visits a shop with finite stock, buys or declines, observer notes whether price and remaining stock were read correctly.
6. **Maker flip, 5 minutes.** Tester opens the transparency page for the edition they played and answers "would you fund this floor, and at what fee?" Observer records the answer verbatim.
7. **Questionnaire.** Five questions on a 1 to 5 scale: I wanted another run; I understood why I died or survived; the cache felt worth the risk; the shop prices made sense; I understood what the maker earns. One free-text question: what would you change first.

### H4-3 Run the first round with at least four humans (L, human time)
Depends on: H4-2.
Files: `docs/playtest/loop-v1/round-1/<tester-number>.md`, `docs/playtest/loop-v1/round-1/summary.md`.
Testers are numbered, not named, in the files. The summary tabulates the recorded fields and the questionnaire medians.
Acceptance: four completed session files exist. Agents may format the summary from the raw files but may not fill in any score.

### H4-4 Stop and refine gates (S)
Depends on: H4-3.
Files: `docs/playtest/loop-v1/round-1/gates.md`.
- **Readability gate.** If two or more testers could not explain the highlights before run two, Phase 5 starts with telegraph fixes only. No content work.
- **Cache gate.** If no tester entered the cache in runs two or three, the cache is either invisible or not worth it; Phase 5 addresses placement before rewards.
- **Economy gate.** If the median on "I understood what the maker earns" is below three, the transparency window wording is the first fix.
- **Fun gate.** The round passes only if the median on "I wanted another run" is four or higher across at least four humans and Andrew signs the summary. An agent never marks this gate.

---

## Phase 5 — Refinement cycles

### R5-1 One hypothesis per cycle (S each)
Depends on: H4-4.
Files: `docs/playtest/loop-v1/round-<n>/hypothesis.md`.
Each cycle states one change, the gate it targets, and the expected questionnaire movement. Candidate knobs, in the order I would try them: stagger flag from T1-3, cache placement within the side room, charger lane length, spike position, escape hint wording.

### R5-2 Apply the change with tests first (S to M each)
Depends on: R5-1.
Files: the Phase 1 or Phase 2 file the hypothesis names, plus its test.
Acceptance: engine and server suites still pass, evidence appended to `docs/evidence/loop-v1/50-refine-<n>.md`.

### R5-3 Re-run the script (L, human time)
Depends on: R5-2.
Same script, at least two returning testers and two new ones where possible.
Acceptance: a new round folder and summary.

### R5-4 Cycle limit (S)
After three cycles without passing the fun gate, stop and hold a design review with Andrew. The plan does not authorise adding content beyond the experiment to force a pass.

---

## Phase 6 — Technical verification

### V6-1 Full suite with evidence (S)
Depends on: all refinement cycles complete.
Commands as in P0-1. Evidence: `docs/evidence/loop-v1/60-final-suite.md` with commit hash.

### V6-2 Verification document (M)
Depends on: V6-1.
Files: `docs/loop-verification.md`.
Sections: what changed by file, each invariant from P0-2 with its covering test name, the fixed-window check from U2-2, the playtest rounds with their gate outcomes, and a plain statement of what was not verified. It must state that transparency does not prove maker incentive safety and that maker results exclude acquisition costs.

### V6-3 Close uncovered invariants (M)
Depends on: P0-3.
Write the tests for any invariant that P0-3 marked uncovered, in the matching test directory.
Acceptance: the coverage column in the invariants file has no blanks.

### V6-4 Independent re-run (S)
Depends on: V6-2.
Codex re-runs V6-1 from a clean checkout and records matching exit codes. Disagreement blocks the merge.

---

## Minimum deliverable versus later expansion

**Minimum deliverable for this plan to be called done:**
- Shove, escape, and the Flooded Larder floor in the engine with tests (T1-1 to T1-6).
- Controls and telegraphs inside the existing fixed run window (U2-2, U2-3).
- Cache slot visible to makers (U2-4).
- Proof that settlement, recovery, concurrency and transparency are unchanged (S3-1 to S3-6).
- One completed human round with four session files and a signed gate file (H4-3, H4-4).
- Verification doc and clean suite (V6-1, V6-2, V6-4).

**Later expansion, each needing Andrew's separate approval:**
- An `escaped` count in the edition record, which touches `packages/shared/src/edition-record.ts` and the four-page transparency view.
- A third enemy behaviour that punishes shove, to keep stagger from dominating.
- A second authored floor so makers have a real choice.
- Cache take rate in transparency, so makers can see whether optional rewards are being claimed.
- Artisan minigame variants per good type, inside the existing per-batch structure.

---

## Merge protocol with Codex

- Both plans are compared by phase. Where IDs map to the same work, keep whichever has the tighter acceptance evidence.
- Engine changes are written by one side and reviewed by the other against `docs/design/loop-v1-invariants.md`. Server proofs (S3-2, S3-3) are reviewed by the side that did not write them.
- Any step that would change a user-fixed rule is struck, not merged.
- Conflicts on tuning defaults, such as stagger, go to the playtest, not to argument.

---

**Recap.** This plan adds only the proposed tactical experiment, contains it inside the existing fixed windows, proves the economy and guards are untouched with named tests, and makes human sessions the sole judge of fun through a written script and explicit stop gates. The minimum deliverable is one floor, two actions, one verified settlement proof and one completed human round. Expansion items are listed but not authorised.
