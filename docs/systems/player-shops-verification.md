# Player-built shops and mode connections — 2026-11-10

## Implemented and exercised

Player shops are contract records containing owner, name, district, footprint, validated interior, revision, opening status and listing IDs. An owner can create, rebuild/move, open/close and stock a shop. Purchasers buy exact finite item IDs at the quoted price. The contract checks ownership and versions, rejects occupied placement and inaccessible interiors, prevents buying from closed shops, and uses existing atomic transfer/idempotent-receipt logic.

The town renders these records and uses them for collision, pathfinding and door entry. A shop is visited in space. No activity launcher or counter-travel menu was reintroduced. The town's Build here control opens a grid placement editor for that district; the next step uses the interior construction kit. Preview and back navigation retain the interior draft. Save submits the definition to the contract rather than browser storage. Owners edit the shop they entered; visitors see its stocked goods. Shop stock is separated from the legacy market's general listings.

Existing dungeon publication, reward funding, admission/settlement, listing trades and crafting continue through the same contract/outbox. Shop edits do not change admitted dungeon rules or item disposition. Session now offers retry of the exact stored interrupted request from anywhere outside an actively locked transaction.

## Observed local chain results

- Migrated the existing local world after backing up the contract, snapshot and server database. Every previous snapshot field remained identical; contract tests also verified receipt preservation. A subsequent same-schema validation update retained the new shop and sale too. No world reset.
- Through Aside: maker placed a shop, added shelves to its interior, rehearsed, went back to placement, returned to the retained draft, and confirmed creation. The building appeared in town, and walking into its door loaded the authored furnishings.
- Through Aside: maker stocked `maker-fine-tonic-3` for 3 credits; p2 bought it. p2 credits went 6 → 3 and ownership transferred to p2. Maker credits went 93 → 96. All values came from confirmed contract-backed world responses.
- Mode traversal: placement → interior editor → walk preview → editor → placement → shop/town; shop → edit → return; guild dungeon builder → rehearsal → editor → guild/town; free practice → inn/town. Desktop 1366×768 and phone 390×844 checks found no document overflow or offscreen tested controls; no captured window errors.
- 87 game tests passed. 54 server tests passed, including the new HTTP shop lifecycle and restart proof; the additional persisted-budget test passed separately.
- Full contract suite: 34/35 passed in the combined run; one existing sandbox fast-forward request timed out. That expiry test passed in isolation. Final shop/migration tests passed again after tightening malformed-interior rejection. This is not a clean all-at-once 35/35 claim.
- TypeScript and Vite build passed. Logs and browser scripts: `../evidence/player-shops/`.

## Testnet preparation, not completion

Prepared `scripts/testnet-shop-account.ts` (one approved faucet request), `scripts/testnet-shop-proof.ts` (pinned contract deployment and bounded shop proof), and `apps/server/src/main.ts --testnet` (exact destination/code checks and persistent broadcast budget). The runtime is restricted to localhost and the proposed testnet account/RPC. Failed broadcasts consume the attempt budget; restart cannot replenish it. Receipt reads remain possible after budget expiry. No testnet writes have occurred.

A read-only check returned UNKNOWN_ACCOUNT for `dungeon-economy-demo-20261110.testnet`. A fresh candidate key was generated locally and stored only under git-ignored `.state` with restrictive file permissions. Account creation, funding, deployment and the testnet session still require the user's exact-destination approval. No account exists merely because a key was generated.

Proposals are in `../evidence/player-shops/testnet-account-proposal.json` and `testnet-proposal.json`. Approval manifests are deliberately absent. Scripts refuse external execution without matching unexpired approval. Provisioning has no fallback provider and records an attempt before submitting so an uncertain response cannot trigger blind retries.

## Material limits

This remains a custodial prototype: one operator signer executes for game profiles, and game credits are contract ledger balances, not native NEAR or a NEP-141 token. Public wallet sign-in, player-controlled keys, onboarding arbitrary funded accounts and a public deployment are not implemented. Testnet readiness must not be represented as having deployed or as self-custody.

Player shops have a bounded 3×2 footprint, a one-tile clearance requirement, one 11×9 interior, up to 32 shop records, and the existing 64-listing/256-receipt prototype limits. There is no land price, building-material charge, plot trading or demolition yet. Closing a shop does not destroy stock or release its owned footprint.

The surrounding districts and starter NPC buildings are still prototype terrain. This work adds placed player-owned shops; it does not turn every town tile or starter building into player-owned on-chain land. Legacy NPC interior editing and tileset artwork remain local-only. Rehearsal is intentionally synthetic. Human fun/discoverability acceptance remains outstanding.
