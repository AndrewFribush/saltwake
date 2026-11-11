# Creator rewards and connected shop continuation

## Delivered

- Creator encounter sockets can use fixed goods or random draws. Makers explicitly assign owned goods to fixed funding or the random table; the editor checks ownership, duplicates, stock limits and complete funded-copy capacity before publication. Version-2 definition blueprints preserve random semantics without transferring funding IDs; version-1 imports remain supported.
- Rehearsal uses synthetic random samples. It never spends selected holdings. The business rehearsal accounts for random stock and continues to disclose unknown costs and attendance assumptions.
- Existing editions expose their random tables in Manage → Stock. Makers can replenish fixed or random pools through the existing contract refresh action without rewriting active reservations.
- Player-shop owners have confirmed sales records: buyer, goods, unit price, total and operation ID. Missing receipts and cancelled-listing uncertainty produce partial coverage. Recorded revenue is not profit; acquisition costs are not deducted.
- New admissions with no packed weapon start unarmed, with one damage. Club and sword damage require actual equipment. Existing saved runs retain their recorded state. Free practice and creator rehearsals retain explicit synthetic kits.
- Shop placement now offers district selection, including when editing an existing shop. Existing ownership, version, footprint, interior and stock checks apply. This is relocation of the same shop, not duplication or a navigation shortcut.

## Verification

95 game tests and 60 server tests passed for the reward, sales and unarmed work. Typechecking and the web build passed again after district selection. Two focused real local-contract tests passed, covering shop lifecycle, collision rejection, cross-district relocation with preserved goods/balances/listing IDs, and legacy migration. The entire contract suite was not rerun; the prior isolated expiry-test caveat remains in player-shops-verification.md.

Browser evidence:

- `../evidence/random-authoring/browser.txt`: published an explicitly labelled synthetic random-pool fixture using fixed fine tonic and random flasks.
- `../evidence/random-authoring/replenish.txt`: replenished its random table with another owned flask.
- `../evidence/random-authoring/shop-history.txt`: verified the previously recorded three-credit sale.
- `../evidence/random-authoring/unarmed-browser.txt`: p4 admitted with no packed goods; run-3 materialized unarmed. Abandonment settled Applied, and p4-club remained in storage throughout.
- `../evidence/player-shops/relocation-browser.txt`: moved Player-built provisioner from Harbor Square to Market Ward, then restored its original district/position. Listing-2 and the owner's 92-credit balance survived both moves; shop versions advanced to 2 and 3.
- `../evidence/player-shops/relocation-layout.txt`: placement controls fit at 1366×768 and 390×844, with no page scroll or offscreen controls. Geometry checks are not a visual-art review.

The first relocation script used an unsupported Aside role selector; it was replaced with the scoped select locator. An attempted footprint near the Market Ward starter building was correctly blocked; the successful proof selected clear ground at (4,10). A test initially expected the wrong collision error name, then was corrected to OccupiedShopPlacement. Final recorded tests pass.

## Limits and next work

This remains an operator-custodied local prototype. Public wallet authentication, onboarding and general player-authored terrain/land lifecycle remain unfinished. Game credits are not native NEAR or NEP-141 balances. Random authoring currently uses one shared table, not arbitrary per-socket weighted tables. Business rehearsal is hypothetical, sales history depends on retained confirmed receipts, and no player enjoyment or builder usability acceptance is claimed.

No production or testnet writes, external deployment, paid calls or world reset occurred in this continuation. The API restarted on its existing local state to load the unarmed fix. Exact-destination testnet approval remains pending; the prepared testnet proposal has not been executed.
