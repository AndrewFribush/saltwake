# Creator-controlled operating terms

New publications use rules v8 with the existing custom7 geometry/encounter schema. Creators configure opening delay (0–1440 minutes), opening length (1–1440 minutes), time per run (1–60 minutes), and simultaneous capacity (1–4). Existing editions retain their pinned terms. The contract accepts v8 run durations from 60,000 to 3,600,000 milliseconds; the builder exposes whole minutes. Legacy rules 1–7 still require 15 minutes and four concurrent runs.

Admission now applies the edition's capacity and computes its deadline from the confirmed block time plus its run duration. Closing stops new admissions; an admitted run keeps its own deadline. Final closure waits for settlement, then sends residual stock to the bank. Capacity returns after settlement; it is not a lifetime attendance limit. Loot reservations remain independent and can reduce available capacity further.

The Terms inspector uses fixed-window pagination. Drafts preserve unfinished settings while publication blocks them; blueprints v8 carry relative settings, not absolute dates or economic stock. Older blueprints ignore later metadata. Opening settings are summarized beside the publish button, and adventurers see minutes per run before payment. Synthetic gameplay rehearsal has no wall-clock expiry; economic deadline evidence comes from server and contract tests.

## Verification

Evidence directory: `docs/evidence/operating-terms/`.

- `game-tests.txt`: 134 passed, including scheduling arithmetic, bounds, malformed/unfinished settings, blueprint compatibility, and opening/capacity/closing availability.
- `server-tests.txt`: 88 passed, including real-WASM v8 funding, admission, authored materialization and reward return.
- `deadline-recovery-tests.txt`: 12 passed, including additional one-minute and one-hour deadlines surviving database restart and expiring exactly once. Those two additions were run after the full server suite.
- `contract-tests.txt`: four WASM operating-term tests passed. These cover invalid boundaries, every legacy version's duration/capacity restrictions, exact receipt-block deadline computation, concurrent-capacity exhaustion/reuse/replay, and closing while a run remains active.
- `contract-build.txt`, `typecheck.txt`, `build.txt`: offline WASM build, TypeScript and web build passed.
- `browser.txt`: desktop1366×768 and phone390×844 Terms/Open controls fit with no page overflow; publication summary matches settings.
- `reload-browser.txt`, `repair-browser.txt`: four saved settings reloaded; invalid capacity blocked publication, survived save/reload and was repaired through the UI.
- `local-refresh.txt`: existing local sandbox backed up and refreshed with exact pre/post economic snapshot equality.

## Remaining limits

This does not remove floor-count, component-catalog, persistent storage or world lifecycle limits. Concurrent capacity remains capped at four by the prototype; the UI makes the limit explicit. Opening delay is bounded by the builder to a day; the contract permits later start dates as long as its opening window is at most 24 hours. No human enjoyment claim follows from these tests. Full completion remains governed by COMPLETION-GOAL.md.

Actual UI publication: `publish-browser.txt` confirms local edition-4 with rules8, capacity1, 120000ms run duration, 7200000ms opening window and scheduled status. This was a labeled empty tooling fixture costing two local demo coins, with no funded treasure. No external deployment, testnet or paid action occurred.

Independent review found no concrete implementation defect. It identified a legacy test still expecting version8 rejection; that unsupported-version case now uses version9. The initial full layout test process had already loaded the old assertion; its failure is retained in `legacy-layout-tests.txt`. The corrected case passed separately in `corrected-version-test.txt`. `final-fit-browser.txt` rechecks the final Terms help text at phone width without overflow.

Legacy-layout follow-through completed: ten unaffected cases passed in the full run; its sole failure was the stale version assertion described above. The corrected eleventh case passed in the focused rerun. No other legacy regression failed.
