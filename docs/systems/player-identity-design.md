# Account-controlled player identity

This extends BRIEF.md and COMPLETION-GOAL.md; implementation is authorized within the existing local-only boundary.

Wallet authentication must not merely put a login screen in front of operator-controlled spending. Account identity is established with a bounded NEP-413 challenge and a currently authorized full-access key. Ordinary economic commands must be authorized by the account at the contract boundary. Game-result authority remains a separate disclosed trust boundary because dungeon and crafting execution is currently server-authoritative.

Use a reserved profile namespace derived from the NEAR account, never allow a wallet to claim a seeded demo profile by choosing its name. Sign-in includes exact origin, network, contract, account, expiry and random nonce, and is bound to an HttpOnly same-site challenge cookie. Consume challenges before asynchronous verification, reject expired/replayed proofs, and check access-key ownership at final chain state. Sign-in neither creates money nor transfers assets.

Direct account transactions should bind actors on-chain and namespace operation IDs. Preserve transactional validation, exact item/fee/version quotes, receipt payload conflicts, capacity reserves and restart recovery. Player calls cannot supply settlement/crafting results. The operator cannot issue ordinary purchases/listings/publications on wallet actors' behalf. New admission needs a seed not selected by the caller; document block-producer influence and the limits of public-chain randomness rather than pretending cryptographic secrecy.

Onboarding must be separate from sign-in and funded from explicit existing resources. No invisible faucet, native-token purchase or new public deployment is authorized. No existing persistent demo contract migration is needed for initial disposable-sandbox tests.

## End-to-end acceptance

A genuine wallet account can sign in, register its own profile, authorize a quote-bound economic transaction, recover its confirmed receipt after restart, play an admitted run, and have the limited game authority settle only that run's permitted items. Another account, replayed proof or operator ordinary command cannot spend its assets. Browser sign-in must use a real wallet adapter and make transaction approval clear. Custodial demo mode stays explicitly distinct.

This is not full trustless gameplay: the operator remains a result oracle and may upgrade a contract it controls. Public onboarding requires further storage/funding, RPC/origin, wallet-adapter and external-destination work. Local foundation tests do not satisfy the full identity acceptance gate.
