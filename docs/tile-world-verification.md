# Tile town, enterable houses, and wallet

Local implementation, 2026-11-10. No deployment, public-chain transaction or paid call. Existing sandbox was preserved; API restart loaded the same settled runs, items and purses.

## Delivered

- Saltwake has visible tile terrain aligned with movement collision and cardinal pathfinding.
- All five buildings have 11×9 tile interiors, blocking furniture, walk-to-service interactions, an account book and a south exit. Arrow keys/WASD, click-to-walk, Enter, Escape and touch direction buttons work. The room remains visible during service interactions.
- Click the HUD purse from town or a run, or walk to an account book indoors. Available coins, reserved run fees, pending maker fees, pending recovery wages, available-item catalog value, unresolved commands and verified operation receipts come from persisted server/contract state.
- Expedition fee history records incoming maker/outgoing player amounts and pending/settled status. Voided runs are excluded and explicitly explained. Amount aggregation uses bigint, including above-JavaScript-safe-integer tests.
- Existing commerce, real finite-stock crafting, paid expeditions and journal are connected at their indoor stations. No economy authority was moved into tile geometry.

## Verification

50 game tests and 47 server tests passed. Typechecking and web build passed; whitespace check passed. Contract code was unchanged, so its previous 32-test result is historical, not rerun evidence for this iteration.

Aside browser checks verified every house entered, keyboard movement from (5,7) to (5,6), and departure through the south door. The market service opened after walking to its counter. The physical account book loaded wallet data, and the HUD purse loaded the same account. At 390px viewport, document width was 390px and room width 346px. Desktop and mobile screenshots were inspected.

Cross-review found and resolved stale concurrent refresh responses, queued movement continuing after manual interaction, and practice switching during an in-flight craft request. Final browser smoke checks cover Enter interaction, Escape back to the room, and loaded wallet.

Evidence: [browser checks](evidence/tiles/browser-checks.txt), [game tests](evidence/tiles/game-tests.txt), [server tests](evidence/tiles/server-tests.txt), [town](evidence/tiles/tile-town-final.jpg), [interior](evidence/tiles/tile-room-final.jpg), [mobile](evidence/tiles/tile-mobile-final.jpg). Earlier screenshots in that folder record the caught styling defect; the `final` files show the corrected layout.

## Limits

Wallet is an operator-custodied local game account, not external wallet authentication. No deposit, withdrawal or exchange to real money exists. Operation receipts plus expedition fees are not a complete double-entry cash ledger: incoming trades and initial allocations may lack local receipts, and item catalog value is not a resale guarantee. The UI states these limits.

Town/indoor movement is presentation state, not multiplayer server authority; reloading starts at the town spawn. Furnishings use simple symbols; rooms share a basic floorplan with place-specific stations. This is an implemented spatial game shell, not completed environmental art or human acceptance of game depth. Existing checklist acceptance gates remain unchanged.
