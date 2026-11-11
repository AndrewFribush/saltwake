# Player identity and command authority foundation

This implements I01/I02 and the durable command-queue portion of I03 in the player identity plan. It does not complete public onboarding or expose a wallet login UI.

## Account authentication

WalletSessions verifies standard NEP-413 signatures using near-api-js. Challenges bind the configured origin, network, contract, account, issue/expiry times and a random32-byte nonce. The exact challenge is held server-side and tied to an HttpOnly SameSite=Strict cookie. It is consumed before asynchronous verification; concurrent replay cannot create two sessions.

Verification checks the claimed public key against final access-key state and requires FullAccess. This implementation accepts ed25519 keys. Wrong-account keys, revoked keys, function-call-only keys, altered messages/recipients/nonces and expired proofs reject. New session cookies are distinct from challenge cookies and demo custody cookies. Sign-in grants no money, goods or spending authorization.

Default challenge lifetime is2minutes, session lifetime15minutes and verifier response timeout10seconds. Capacity includes outstanding challenge verification calls. A timed-out RPC retains its slot until it actually settles, preventing repeated timeouts from spawning unlimited lookups. Restart invalidates sessions. Sessions are single-process; multi-worker/shared revocation and per-account rate limiting remain public-operation work. Key revocation is checked at sign-in, not continually through an established session; economic transactions remain separately account-authorized.

## Contract boundary

register_player derives wallet:<predecessor account>, creates only a zero-credit profile, and preserves an existing balance on retry. It cannot claim a seeded demo identity. The prototype caps wallet profiles at128.

execute_player binds the actor to its predecessor and isolates operation IDs with a versioned Borsh-domain/account/request hash. It reuses existing atomic validation, exact quotes, ownership, receipt conflict/replay and settlement reserves. Ordinary wallet spending is rejected through the operator execute method. Direct players cannot submit game results. Operator settlement/craft-result calls must reference an existing run/batch owned by that wallet profile, with the correct batch kind. The operator remains a trusted game-result oracle.

New player admissions derive their effective seed from contract entropy, account and operation identity after receipt replay checks. The receipt hash remains the exact submitted command; the run records the effective seed. This removes caller-selected deterministic seeds but does not prove manipulation-resistant lottery fairness. Blockchain state/assignments are public and the operator retains upgrade authority.

Direct wallet craft/recovery starts are deliberately gated until durable server challenge preparation and receipt ingestion are integrated. No hidden faucet or artificial starting balance was added.

## Durable command recovery

Outbox.enqueuePlayer persists the exact account-bound command with player authority. Pending/unknown wallet requests are never operator-signed or broadcast, including after restart or with unexpected stored signed bytes. Only a confirmed receipt with matching operation identity and canonical payload hash is accepted. Contract-level Rejected remains distinct from Applied.

Player tasks are independent from the operator nonce stream. Receipt reads have bounded waits while retaining the original in-flight lookup. Terminal capacity is owner-bound: an unsigned foreign closure cannot discharge another maker's obligation; queued owner-bound terminals occupy their reserved slots without double-counting.

Cost observations have bounded waits and abort signals. CostJournal checks cancellation after awaited snapshots and before writes. A late observation cannot overwrite accounting after timeout. Missing evidence remains unknown. This is not full transaction ingestion/discovery: callers must still supply the exact account/request/action; arbitrary external admissions without locally known intents need a complete discovery policy.

## Evidence

- Seven contract tests: identity/helper boundaries, registration/impersonation, exact IDs/hash/seed replay, ownership/action allowlists, earned-balance preservation,128-wallet cap, and populated pre-identity upgrade.
- Two existing shop/migration compatibility tests pass.
- Pre-identity upgrade preserves snapshot, command hashes, six receipts, active paid run, craft/recovery reservations, shop and listing without migration; existing terminal obligations settle afterward.
- NEP-413 disposable-chain test passes five reported tests/subtests: real final key ownership, wrong account, restricted key, revocation and replay/logout.
- Targeted authentication, Outbox and cost regressions pass. Independent review reproduced and helped fix verifier capacity, foreign closure reservation, signing-stream blocking, queued-terminal double counting and delayed observation writes.
- Actual local-chain server tests prove both prepared-before-signing and known-command-discovered-after-confirmation admission recovery across a database restart. No operator signature is used for admission; exactly one is used for final oracle settlement.
- See docs/evidence/player-identity/ and docs/evidence/player-authority/. Exact final suite counts are recorded in PROGRESS.md after completion.

The current persistent demo contract was not refreshed. No testnet, paid call, hosting, external deployment or production change occurred. The retained pre-identity WASM is a generated regression fixture with its digest recorded.

## Remaining acceptance

I03–I06 still require complete external-admission discovery, HTTP wallet-mode routing, prepared crafting/recovery authorization, wallet adapter/browser integration, explicit onboarding/funding and an end-to-end multi-account game UI test. Public scale also needs receipt/run/storage policy: the existing256-receipt and lifetime record ceilings can be exhausted by public users. The foundation is local-only and is not suitable to publish as a completed wallet game.

COMPLETION-GOAL.md stays active. Human gameplay, builder/economic acceptance and all other open requirements remain unchanged.
