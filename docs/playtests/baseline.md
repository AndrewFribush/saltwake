# Gameplay baseline

Branch build/dungeon-loop; revision and dirty-file hashes in `docs/evidence/loop-v1/baseline-manifest.json`; tracked source patch in baseline-source.patch. Existing untracked source remains in the working tree and is identified by hashes; this is an audit record, not a complete archival checkout. No keys/state exported.

Baseline: game57 passed, typecheck and build passed (logs alongside). Local web127.0.0.1:18930/API18931 unchanged. Existing fixed-window browser evidence in docs/evidence/ui-polish and transparency; new gameplay UI will be checked again.

Invariants map: packages/game/test/disposition.test.ts covers origin partition; inventory.test.ts covers consumables/use/equip; apps/server/test/run-recovery.test.ts covers durable actions/terminal replay; tests/contract covers admission/settlement/concurrent stock/closure (exact test names to be recorded before paid promotion). Transparency denominator/coverage checks in apps/server/test/edition-record.test.ts. No gameplay fun acceptance claimed.
