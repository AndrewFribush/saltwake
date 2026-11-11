# Preparation and readable threats

## Delivered

- Shared weapon damage, healing and armor reduction values drive both gameplay and item explanations. Shops, storage and run inventory explain effects before the player spends or equips.
- Bank stock can be filtered into equipment, medicine and ingredients. Selections remain quoted across categories, and confirmed trades clear picks so an item returning to stock is not silently selected again.
- The gate previews starting weapon/damage, armor and actual bag occupancy. When packing multiple weapons, the starting-weapon control changes selection order explicitly. Extra weapons/armor consume bag slots. Invalid bags are disabled before admission. The server uses the same loadout planner without changing previously saved runs.
- Visible enemies describe committed attacks, charges, recovery or movement and show the number of hits required with the player's current weapon. Guard's tooltip explains its one-hit reduction.

## Fairness regression found and fixed

An unaware charger at (6,1), with the player at (1,1), is outside the four-tile sight radius. On the first wait it wakes and commits a lane to the player; on the next wait it deals four damage. Previously the server removed the unseen enemy and its lane from the view, leaving no warning on the player's visible tile.

The server now projects only the visible coordinates of committed warning geometry in `incomingDanger`. It still withholds the enemy's identity, position and offscreen geometry. Local practice computes the same visible warning geometry. UI marks and explains the danger without fabricating a visible creature. Combat damage, aggro, turn timing, fogged loot and admission terms remain unchanged. Sleeping/recovering enemies and invalid stationary intents do not generate warnings.

Game and server regression tests recreate this case, prove the source stays hidden, prove the warning reaches the visible player tile, and confirm the same four damage if the player waits.

## Verification

- 102 game tests and 77 server tests passed; typecheck and web build passed.
- Browser shop category checks at 1366×768 and 390×844. The first medicine view overflowed because generated item IDs wrapped; raw IDs moved to tooltips while effects and prices remain visible. Exact IDs remain transaction keys and available in receipts.
- Browser packing check: club + sword, choose sword, preview reads sword (3 damage), armor none, bag 1/6. Balances and operation count remain unchanged by preview.
- Map, Bag and Journal windows and return-to-inn controls fit desktop and phone. This is DOM geometry and interaction evidence, not screenshot art direction approval.
- Evidence: `docs/evidence/preparation/`. The full standalone contract suite was not rerun; server tests include real local contract-backed loops.

The local API was restarted using the existing world. No persistent world reset, economic test purchase, contract change, testnet operation, deployment or paid call occurred in this continuation. Human fun and creator acceptance remain open; technical evidence does not settle them.

Next work: deepen/review the reusable encounter and construction vocabulary, test build → rehearse → revise, and continue the complete checklist. No developer-authored adventure is being promoted to the product milestone.
