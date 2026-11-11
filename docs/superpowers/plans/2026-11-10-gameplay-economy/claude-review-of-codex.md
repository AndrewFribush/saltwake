Codex's plan is stronger than mine on sequencing and on versioning, and weaker on scope discipline. The two merge cleanly if the paid promotion waits for the first human gate, and if the economy work past the trade circuit stays conditional.

## Omissions and contradictions in the Codex plan, highest first

1. **Scope creep in the minimum.** Three fixtures in P05, a paged journal window in P06, a cost-basis module in P13, discovery rotation in P14, and an economy simulator in P16 are all new product surface. The brief approved one floor with an optional cache, shove, and escape with enemy response. Variants, journal, cost basis and rotation are evidence-driven refinements or later work. P14's rotation changes the matcher and is not an approved requirement.

2. **Phone viewport is not a user-fixed rule.** P06 and P18 check a phone size. The fixed rule is one screen with no page scroll. Adding a phone gate without Andrew's word risks layout churn. Keep the desktop fixed window as the gate and record phone as an observation only.

3. **Cooldown adds saved state.** P02's shove cooldown is a tuning proposal that puts a field in run state, which the server serializes and recovery replays. My stagger flag has the same cost. Neither should be default on. Both are knobs for the refinement cycle, and the merged plan should carry one rules object, not two ad-hoc fields.

4. **Unverified spec references.** Codex cites a review-decisions document under the design folder. The brief told us not to invent current implementation. The merged plan should treat that file as unverified until read, and user rules prevail regardless.

5. **Escape is not proven in transparency.** P14 re-verifies the record generally but never asserts that an escape run counts as extracted and that a zero-loot escape pushes a zero sample. My S3-6 covers this and should be kept.

6. **No scroll-height evidence.** Codex states no page scroll but gives no measurable check. My U2-2 compares scrolling element height to viewport height before and after. Keep it.

7. **Maker-facing playtest observations in product.** P14 has the maker see room observations from consenting tests inside the app. That is playtest documentation, not a feature. Keep those notes in the playtest folder.

8. **Rust touch is understated.** P10 names Rust edition validation. If the contract rejects an unknown rules version, the bump requires a Rust change. That is acceptable only if the change is version acceptance alone, with contract tests proving the partition is identical to a cleared extract. My S3-5 already frames that as a finding first, edit second.

Neither plan changes treasure disposition, adds mandatory oil, or adds a prize stake role. Codex's P13 states leftovers are never refunded, and P17 explicitly keeps new orders and a second recipe out unless specified and evidenced. Both plans state estimates are ranges, not deadlines.

## What I accept from Codex

- **Human sessions before paid promotion.** Codex runs the first sessions in free practice at P07 and gates promotion on G1. My plan wired the server first. Codex's order is right. A rejected core should never reach the funded path.
- **Versioned promotion.** P09 and P10 are the correct treatment of the engine change. Admitted runs must resume under their admitted rules after restart, and old terms hashes must not move. My S3-1 "change nothing if the server forwards opaque actions" is too weak and is replaced.
- **No silent retarget.** Codex's displacement rule, where a committed attack fizzles if adjacency is lost, matches how the current combat loop treats a stale intent. It needs an explicit test, which my T1-2 lacked.
- **Separate exit eligibility from cleared-exit continuation.** P04 protects shrine and descent eligibility from the escape change. Accepted as written.
- **Andrew first, uncoached.** P07 puts Andrew's own attempts before outside testers and records interventions. My script started with anonymous testers.
- **Trade circuit test.** P11 plays artisan, maker and adventurer through one full circuit with receipts. My script had only a shop stop. P11 joins the second human round.
- **PlayEvent trace.** The engine-side event schema in P06 is testable and gives observers a complete trace instead of the eight-line log. Accepted without the journal window.
- **Two unsuccessful rounds, then redesign.** Stricter than my three. Accepted, since the current practice was already judged too basic.
- **Failure taxonomy in P08.** Classifying unclear input, unreadable threat, dominant kit, tedious safe loop, arbitrary loss and irrelevant treasure is better than my ordered knob list.

## What I revise in my plan

- T1-3 becomes a single experimental rules object on run state, versioned, defaulting to legacy. Stagger and cooldown are fields inside it, both off.
- T1-2 gains the fizzle-without-retarget test and an infinite pinning inspection.
- Phase 3 is rebuilt around Codex P09 and P10. My S3-2, S3-3, S3-4 and S3-6 become named cases inside P10 rather than a separate phase. S3-5 stays as the contract check that gates any Rust edit.
- Phase 4 splits. Round one is free practice with my script steps one to four and the questionnaire, plus Codex's open questions. Round two runs after promotion and adds the fee display, shop stop, maker flip and the P11 circuit.
- H4-4 gates keep the questionnaire medians but add Codex's qualitative prompts. Andrew signs both rounds. Agents format summaries and fill in no score.
- U2-3 telegraphs must predict the fizzle rule, as Codex's P02 requires.

## What stays conditional on human evidence or separate approval

- Fixtures B and C. Built only if round one names cache placement or escape access as the failure.
- Paged journal window, cost-basis module, discovery rotation, economy simulator, artisan minigame timing changes. Each waits for an observed problem and for Andrew's go-ahead, since each touches product surface beyond the experiment.
- An escaped count in the edition record and cache take rate. Both change the shared record type and the four-page view.
- Any Rust change beyond version acceptance.
- The fun gate itself. No agent marks it. Transparency figures do not prove incentive safety, and maker results exclude acquisition costs until a cost-basis module exists and is approved.

## Merged dependency order

1. P01 baseline, merged with my P0-1. Record exit codes, dirty diff inventory, no secrets.
2. P0-2 and P0-3 invariants with coverage column. Andrew marks each line.
3. P02 pinned rules table, merged with the T1-3 rules object design. Conflicts resolved in writing.
4. T1-1, T1-2 with fizzle test, T1-3 rules object. Engine only.
5. T1-4 escape, merged with P04 exit-eligibility split. Parallel with step four.
6. T1-5 and T1-6, one fixture, merged with P05 validation checks. Variants deferred.
7. P06 PlayEvent trace in the engine, with tests.
8. U2-1, U2-2 with scroll-height evidence, U2-3 telegraphs predicting fizzle. Journal window deferred.
9. Phase 1 and 2 gates, Codex reviews engine diff against invariants.
10. Round one humans, free practice. Andrew first, then three to five people arranged by Andrew. Gate G1 and my readability and cache gates. P08 refinement, at most two rounds.
11. P09 promotion boundary, P10 versioned promotion carrying my S3-2 through S3-6 as named cases. Codex reviews settlement and recovery tests line by line.
12. U2-4 builder exposure of the cache slot.
13. P11 trade circuit test, then round two humans with the paid script and maker flip. Gate G2 with Andrew's signature.
14. V6-1 through V6-4 with P18 independent re-run. Disagreement blocks merge.

Minimum deliverable is steps one through fourteen with one fixture, two actions, one versioned promotion, two signed human rounds and a clean suite. Everything in the conditional list waits.
