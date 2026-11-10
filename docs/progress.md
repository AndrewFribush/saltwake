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
