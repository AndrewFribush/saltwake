# Wallet HTTP integration and external admission discovery

Wallet mode is now an explicit httpServer configuration, separate from the default demo custody mode. It exposes local challenge/verify/logout/register routes. Configuration binds the exact origin, network and contract and must match the session verifier; arbitrary request data cannot choose those destinations.

Authenticated wallet commands use the account-bound Outbox path and return the exact unsigned execute_player transaction descriptor. The player signs it; the server polls the authoritative receipt. Repeating the same request preserves its ID, action, hash and status. No operator spending fallback is available. Registration similarly returns a wallet transaction descriptor and grants no balance. /api/profile rejects wallet-mode profile switching.

Session identity is rechecked after awaited reconciliation/snapshot reads. Logout clears both cookies, cancels unused and in-flight challenge proofs, and invalidates sessions minted from an older challenge while a logout request was already in flight. Verification that finishes after logout cannot silently restore the login. Wallet craft/recovery start remains explicitly disabled until its prepared-challenge integration is complete.

## Admissions made outside the game request flow

Runs.discoverPlayerRuns accepts only the configured chain's authoritative snapshot. It discovers active wallet-account runs even when no local prepared command exists. It validates the edition's active reservation plus exact loadout and reward ownership, socket and source-pool references. It uses the confirmed effective seed and the same authored-layout compiler as ordinary runs.

Discovery does not fabricate an admission command, receipt, signature, action history or start timestamp. Unknown admission timing remains unknown in public statistics. Existing turns, health, consumed goods and sequence numbers survive repeated discovery and restart. Discovered runs reserve local terminal capacity.

Late-discovered runs can expire and settle their exact item partitions through the limited oracle. Externally completed runs receive durable terminal markers so an older snapshot cannot resurrect them. Existing local progress imports the actual terminal outcome without fabricating a settlement receipt or detailed local disposition. Terminal markers, saved-run updates and new materialization commit atomically; a tested interruption cannot leave a durable terminal marker alongside playable stale state.

The HTTP reconciler also avoids recreating play from a historical Applied admission receipt when final chain state is already terminal and local play data is absent.

## Verification

Evidence directories: docs/evidence/wallet-http/ and docs/evidence/wallet-discovery/.

- Six real-chain discovery tests pass: exact fixed/random reservations with town gear; restart and replay preserving progress; absent-server late expiry; stale-snapshot terminal protection; malformed ownership rejection; external terminal import; and interrupted durable-write protection (some scenarios share a test).
- Disposable-chain HTTP tests use independent full-access keys and NEP-413 signatures, not demo-profile switching. They verify zero-credit registration, exact transaction descriptors, account-bound ownership, confirmed receipt recovery, profile-switch denial, forged actor rejection, logout/expiry and no operator spending.
- Authentication regressions cover logout before verification, during a pending key read and immediately after session creation using an older challenge cookie.
- Existing demo HTTP paid-run and player-shop regressions pass.
- Independent review reproduced a stale-terminal interruption bug; the atomic fix passes its regression. Initial failure logs remain in the evidence directory.
- Completed full server suite:132 tests passed,0 failed; typecheck and web build passed. A subsequent focused HTTP run passed2/2, including a newly added direct-admission/play/settlement case not counted in132. That case uses a free no-stock v11 fixture, rejects foreign-account reads/actions, and verifies exactly one operator signature/broadcast solely for owner settlement. It does not prove paid-loot or browser acceptance.

## Scope

The persistent demo remains in demo mode; no contract refresh or external action occurred. Wallet mode is exercised through disposable local-chain HTTP tests. The browser wallet adapter, user-facing login/onboarding and prepared wallet crafting/recovery remain required. This is not completed public onboarding or a claim of self-custody/trustless gameplay; the result oracle, upgrade authority and prototype capacity limits remain as documented in player-identity-verification.md.
