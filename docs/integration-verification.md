# Local integration checkpoint — 2026-11-10

30/48 checklist cards accepted. The game is not finished. Andrew rejected the preceding two-room gameplay as basic/not roguelike; M08 remains a repair gate. The seeded practice repair has not received player acceptance, and paid editions still use fixed templates.

## Verified

`npm run verify` exited 0: 43 game tests, 30 actual-WASM contract tests, 39 server tests, TypeScript checking, release WASM build and Vite build. [Full log](evidence/local-integration-tests.txt). The final reconciliation helper also received a separate passing typecheck and four focused tests after its last edit. [Focused evidence](evidence/reconciliation-after-fix.txt).

Actual HTTP action response samples: 19, minimum 1.379 ms, median 2.484 ms, maximum 4.063 ms on this Mac. These exclude terminal blockchain settlement and do not predict remote performance.

The connected local loop covers funded publication/admission, combat, potion consumption, extraction/death/void, durable restart recovery, finite shops, bank trades, authoritative batch crafting, limited NPC demand and zero-capital recovery work. Browser evidence includes extracting a sword, drinking a funded tonic, and selling the extracted sword to another profile. Separate HTTP tests exercise purchased-potion use and recovery wages.

The latest correction ensures a sync requested during recovery gets a subsequent pass, without delaying earlier callers behind future traffic. Regression evidence includes the original failure, retry after errors, background polling and continuous-request starvation. Fresh independent Codex review findings about malformed command fields, illegal-action retry and action field injection were corrected and tested. Claude did not return a completed review; see claude-integration-review.md.

Authoritative reference-value accounting reconciles original plus refreshed funding against available, reserved, extracted, consumed and banked rewards. It excludes later town-origin use/forfeiture and survives replay/rejection. Reference values are not acquisition costs or market prices.

## Remaining work and limits

The maker layout editor and paid integration of the roguelike repair remain unfinished. Human play observations, crafting feel, complete maker cost/net metrics, clean-checkout rehearsal, demo recording and submission remain open. Consult the canonical checklist for exact card states; implemented components do not imply a finished product.

A fresh local sandbox and API were restarted with the final contract schema, preserving previous epoch databases. Aside confirmed the 117-tile practice and connected town/shop/crafting UI. An optional attempt to prepopulate a new edition hit Aside selector errors three times; no new publication is claimed for this fresh epoch. Maker publication remains available through the UI and was verified in earlier browser and final HTTP tests.

No testnet transaction, paid service, deployment, source upload or public submission occurred. Demo profiles are operator custody; stock and credits are synthetic. The contract does not independently prove combat, randomness or crafting timing. See trust.md.
