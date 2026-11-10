# Saltwake gameplay slice — 2026-11-10

The local client now starts in a walkable harbor town. The economy is reached through places: market stalls, the alchemist's working bench, the proprietor's guild and the dungeon gate. The inn holds stored belongings, the expedition journal and clearly separate free practice. Click-to-walk uses reachable paths; keyboard movement cannot cross buildings or the waterfront. Places open only on arrival. Character/session controls remain available as an explicitly custodial demo utility.

## What is connected

New version-2 paid editions use server-seeded 13×9 floors with 2–4 chambers linked by narrow corridors. Exact contract socket assignments populate them; the generator creates no free items. Fog hides unexplored geometry, enemies, traps and item identities. Discoveries survive restart. The client uses authoritative exit/continue permissions. Version-1 editions retain their original fixed geometry.

Characters buy supplies with actual local credits, pack selected town goods, pay admission, play, and return after settlement. The first-floor shrine offers healing or health-for-damage. Death still banks town gear and returns unused dungeon goods to their funded pools. Result reports disclose counts for unseen returned items without exposing their identities. Town movement itself has no economic authority.

Fresh sandbox setup spends the existing proprietor's 11-credit placement charge and transfers two sword/two-tonic bundles into a starter edition; remaining tonics stock two finite stalls. No additional assets are minted. The initializer's existing demo issuance remains 176 credits and 51 initial items. `--empty` disables the starter transactions.

## Browser evidence

Actual Aside interactions, without direct state mutation or API-injected rewards:

- Walked from the square to the market and then to the gate; the corresponding interiors appeared on arrival.
- Bought `maker-tonic-4` for 3 test coins, packed it and `buyer-club`, and paid 2 to enter. Purse changed 10 → 7 → 5. The paid dungeon initially hid 98 tiles; a keyboard move advanced turn 0 → 1.
- Played a paid run using only visible DOM tiles and available controls. It cleared the first floor, used the shrine, reached the second floor and extracted. The journal confirmed `maker-sword-0` and `maker-tonic-0` as extracted goods, and the club plus unused bought tonic as returned town goods. This is scripted builder play, not a human fun assessment.
- At the Copper Kettle, the apprentice completed three timed steps in a recovery batch. The bank received two normal tonics and the apprentice received 2 test coins. Remaining labor budget became 4. The benchmark does not establish human difficulty or timing fairness.
- 1280×900 desktop and 390×844 mobile checks found no horizontal overflow. The mobile market opened as a viewport-sized interior.

The first played run exposed a disappearing remembered-stairs marker and a skipped terminal-result screen; both were corrected. A source review then identified stale profile state, crafting input blocked by world refresh, and Enter bubbling from destination buttons. Fixes invalidate stale refresh generations during profile switches, lock switching during child transactions, add expected-profile server preconditions, consume authoritative craft responses immediately, and restrict town movement shortcuts to the focused map itself.

## Verification

48 game tests and 32 actual-WASM contract tests passed. The complete server suite and final typecheck/build results are recorded with the final checkpoint below. Relevant coverage includes all-to-all town reachability, 500-seed chamber/chokepoint checks, V1 compatibility, V2 redaction/restart, exact starter stock, stale-profile rejection, and durable settlement.

A separate fog-limited paid-play test bought a tonic, consumed it in play, cleared both floors and extracted a funded sword through ordinary server actions; it never edited run state. Logs live in `docs/evidence/world/`.

## Scope and remaining design work

Borrowed: Diablo's compact town/preparation/expedition/return rhythm; roguelike exploration, consumables, tactical threats and loss; Pirates!/Mount & Blade's places and different livelihoods within one economy. This does not implement sailing, armies, reputation factions, an MMO or a complete creator editor.

Commerce still uses focused inventory/trade panels inside buildings. Combat has two enemy types and limited content. The town has no autonomous citizens or changing trade routes. Craft timing depends on server receipt time. These are material remaining limitations; a walkable town and passing tests do not establish fun or a living economy. M08 human acceptance remains open. No production, hosted, paid-service or testnet action occurred.

## Final checkpoint

**48 game + 32 contract + 43 server tests passed (123 total)**, followed by a passing typecheck, Vite build and whitespace check. The contract WASM build and real V2 acceptance tests also passed. Final logs: [game](evidence/world/game-tests.txt), [contract](evidence/world/contract-tests.txt), [server](evidence/world/server-tests.txt). Final targeted recovery/redaction and expected-profile guard tests passed after review fixes.

Browser confirmation after the review fixes: Enter on the catacomb destination while standing near the market arrived at the catacombs; the journal reported one undiscovered returned item without exposing its identity. No additional review by Claude is claimed.

Operational note: Aside one-shot REPL deletes its temporary screenshot directory when it exits. Copy images while the owning script remains alive; paths printed only at completion may already have vanished. The retained paid-dungeon screenshot and final desktop/mobile captures are builder evidence, not independent user acceptance.

Final browser regression: a fresh mercenary attempt was admitted, then deliberately abandoned with no packed gear. Its terminal result remained on screen until **Return to Saltwake** was clicked, confirming the homecoming fix. The session was returned to the delver afterward. Final screenshots: [desktop town](evidence/world/saltwake-final-verified.jpg), [mobile town](evidence/world/saltwake-mobile-verified.jpg), [paid dungeon](evidence/world/paid-dungeon.jpg).
