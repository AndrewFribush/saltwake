# Player identity implementation plan

**Goal:** Account-authenticated players with contract-authorized economic ownership, integrated into the game.
**Architecture:** Separate NEP-413 session authentication, account-bound contract commands, confirmed-receipt ingestion and server-authoritative game results. Preserve the existing demo as a distinct local mode.
**Tech stack:** TypeScript/Node, near-api-js NEP-413, Rust near-sdk, disposable NEAR sandbox, React.
**Spec:** docs/systems/player-identity-design.md.

## Constraints

Local work only. No paid calls, testnet, hosting, production or existing persistent-world migration. Do not count sign-in as authorization to spend. Preserve economic invariants, signed-request retry and settlement reserves.

## Tasks

- [x] I01: Implement wallet-session challenge/verifier in apps/server/src/wallet-auth.ts. Test real signatures, account/origin/recipient/nonce binding, final full-access ownership, one-time concurrent replay, expiry during verification, cookie binding, logout and capacity. Add an actual local-chain key-ownership test.
- [x] I02: Review/implement account-bound registration/command contract boundary. Prove two accounts cannot impersonate seeded profiles or each other, operator ordinary wallet spending rejects, oracle-only commands reject direct players, operation IDs isolate accounts and retries preserve exact payload/results. Preserve old state layout/fixtures; do not refresh current runtime.
- [x] I03: Add confirmed direct-command receipt ingestion to Outbox without allowing operator fallback signing. Verify receipt hash/account binding, unknown outcomes, restart, capacity and conservative missing cost observations. Integrate direct admissions with Runs materialization.
- [x] I04: Add explicit wallet mode to HTTP session/command/craft/run routes. Remove demo switching in wallet mode. Bind session validity to account and recheck after awaited work; avoid key/session races.
- [ ] I05: Connect a supported wallet adapter and explicit network/contract configuration to the fixed-window UI. Account creation/funding are distinct from login; no pasted private keys. Keep source local until an exact external destination is approved.
- [ ] I06: Exercise onboarding → shop/trade/build → admission → play → settlement → replay/restart with separate accounts on disposable chain, then browser flow. Independent review. Record oracle/upgrade/storage/seed limitations and any unfinished acceptance.

I01/I02 evidence: docs/systems/player-identity-verification.md. I03 now also discovers external active wallet admissions from final snapshots without fabricated receipts/timing and prevents terminal resurrection. HTTP wallet-mode authentication/transaction descriptors/play ownership are implemented and tested; I04 is verified for prepared wallet crafting/recovery, direct-batch discovery and bounded terminal recovery; see docs/systems/wallet-crafting-verification.md. Existing persistent runtime was not refreshed.
