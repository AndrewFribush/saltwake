# Whole-game viewport integration

2026-11-10 · http://127.0.0.1:18930

## Scope correction

The previous change addressed only the builders, and replaced full-page sections with tabs. That did not meet the requested whole-game brief. This implementation changes the game shell, town and interior views, all service panels, the purse/storage overlays, combat, and both builders.

## Current behavior

- Town and interior maps fit the viewport with square room tiles. Walking into doors and crossing district edges retains the existing movement logic.
- A house service appears beside its room on desktop and below its room on a phone. The map remains visible. Close the service to resume movement.
- Market supplies/listings, stored goods, journal entries, receipts, wallet history, edition management and gate openings use bounded pages. Item identities, quotes, funding constraints and command handlers remain authoritative.
- The character HUD opens stored goods/journal directly, including in districts without an inn. The purse opens account views without navigating away.
- Crafting and free practice fit the same service panel. Station panels stay mounted while switching between goods and the counter, preserving drafts and local selections. Navigation is blocked while the parent reports an operation in flight.
- Dungeon and rehearsal maps remain visible with bag or journal open. Inventory and full combat history are paginated. Settlement categories also use pages.
- Builders keep their map visible with an adjacent inspector for layout, encounters, art, funding and opening. Phone layouts stack the inspector below the map. Uploaded art is independent of geometry and remains local to the browser.
- The body no longer scrolls. The implementation sizes the maps and bounds collections; it does not merely clip the old page at the viewport.

## Verification

Browser tools: gstack browse workflow through Aside. Viewports: 1366×768 and 390×844, normal zoom.

- 56 whole-game view checks cover wallet subviews, HUD storage, crafting, crafting practice before/after input, maker management/results, receipt recovery, every builder inspector, rehearsal Map/Bag/Journal, interior builder views, gate openings/accounts, and free-practice Map/Bag/Journal.
- Market checks additionally cover bank supplies, trader listings, selling/listing, NPC order, stored goods, initial town and initial interior.
- Final matrix has no off-screen controls or captured window errors. Builder/run maps stay present in every relevant inspector mode.
- Screenshot review caught two issues not established by page-height checks: a lingering bag-view rule hid the map; old tile minimum heights caused the small builder grid to overlap its controls. Both were fixed and rechecked.
- A synthetic PNG upload verifies that the atlas and map are simultaneously visible, the art inspector has no overflow, and all floor cells stay within their grid bounds. Screenshots cover desktop and phone versions.
- Selecting one bank good enables its quoted purchase action; it is deselected without purchase.
- A separate synthetic rehearsal creates an unsaved draft with a funded-simulation reward and verifies movement and pickup through the bag inspector while keeping the map visible. No economic publication or purchase is used for this proof.
- Typecheck, web build, 57 game tests, and whitespace validation pass.

Evidence: `docs/evidence/game-screen/`. The first pickup script assumed an existing reward in the browser's active draft and hit a disabled Next item button. The replacement explicitly constructs a disposable rehearsal draft, so it does not depend on stored user state. Screenshot capture uses CDP viewport clips to avoid Aside's fixed-element stitching artifact.

## Limits

This is a local prototype with synthetic money and the existing operator-custody wallet. Economic command semantics and contract/server code were not changed. No production deployment, testnet transaction, paid inference, hosted upload or NFT mint was involved. Real device keyboards, arbitrary browser zoom and every possible window size were not tested. Asset licensing/ownership remains the previously documented unverified reference.
