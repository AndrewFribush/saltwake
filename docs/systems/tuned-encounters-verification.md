# Configurable encounters verification

Rules v7 adds creator-set enemy health (1–30), damage (1–12), alert distance (1–8), and trap period (2–8), armed duration, starting phase and damage (1–12). Blank values retain defaults. Trap cycles must have a safe turn. The same authored compiler supplies rehearsal and admitted play. V7 modules allow 4096 bytes; earlier versions retain their schema and limits. Optional directed connections retain room-state memory.

The builder exposes a paginated Tuning inspector for the selected encounter. Removing an encounter remaps tuning indices; disabling an enemy or trap removes its incompatible settings. Drafts retain bounded unfinished settings, while rehearsal/publication reject invalid definitions. Blueprint v7 preserves tuning and imports earlier versions under their original restrictions.

A warning defect was also fixed: an initially unalerted charger within its wake radius already had a committed charge, but its first-turn warning was suppressed. Visible threat tiles now warn before that attack. Legacy combat behavior is unchanged. Independent review identified misleading “Spikes alternate” help; it now describes armed/safe appearance without promising a two-turn cycle.

## Evidence

- `docs/evidence/tuned-encounters/game-tests.txt`: 130 passed. Configured health/damage/alert, first-turn charge warnings, trap timing and graph return memory, malformed/incompatible tuning, editable unfinished drafts, blueprint roundtrip and legacy stripping.
- `server-tests.txt`: 87 passed. Added actual local-WASM v7 publication, funded admission, exact materialized parameters, saved-run retrieval and original reward return through the mixed-pool integration test.
- `contract-tests.txt`: 11 focused WASM tests passed, including three v7 cases and prior format regressions. Covers bounds, types, null/unknown fields, socket compatibility, optional graph validation, byte limits and funded reservations.
- `contract-build.txt`, `typecheck.txt`, `build.txt`: passed.
- `browser.txt`: Aside entered all seven settings, ran an unarmed rehearsal (7 damage to player; 5 trap damage to enemy), and checked visible controls at 1366×768 and 390×844 without page overflow.
- `reload-browser.txt`: a separate browser invocation reopened the saved draft, verified all seven values, and exercised reset.
- `local-refresh.txt`: backup-preserving existing local contract refresh and exact pre/post economic snapshot assertion.

## Limits and remaining work

This extends configuration of two enemy behaviors and one trap, not arbitrary executable behavior or a complete component catalog. Floors remain limited to 2–4 at publication and 5–31 tiles per dimension. Lifecycle settings and broader resource limits remain outstanding. Browser geometry checks are not visual or human fun acceptance. This is a verified increment toward BRIEF.md, not completion of the game goal. No paid calls, testnet transactions, hosted uploads or production changes.
