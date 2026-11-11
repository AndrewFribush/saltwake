# Builder improvements and local tileset studio

2026-11-10. Local work only.

## Delivered

- Interior undo/redo; dungeon draft undo/redo.
- Duplicate a floor with its encounter configuration; move floors earlier/later with placements attached. Existing 2–4 floor bounds and publication validation remain.
- Tileset studio in both builders: PNG upload, tile-size selection, atlas picker, separate wall/floor assignment, browser persistence and default-art reset.
- Shared cosmetic rendering in both editors, interiors, and dungeon runs/rehearsals. Characters, loot, exits and encounter markers remain separate overlays. Unexplored cells render no uploaded art.
- PNG limit 2 MB, dimensions 8–2048 pixels, at most 1,024 selectable cells. Invalid images/storage failures produce messages. A failed save leaves the previously applied skin active.
- Optional attribution/NFT reference is plain unverified text. No remote media fetch, mint, purchase, ownership check, or licence verification occurs.

## Verification

- `npm run typecheck`, `npm run build`, `npm run test:game` (57 passing), and `git diff --check`.
- Aside browser exercised interior paint/undo/redo, an actual File input change using a generated two-tile PNG, Apply, room preview, floor duplication/reordering, dungeon undo/redo, and free rehearsal.
- Browser results: undo restored floor; redo restored wall; 99 editor art cells; 99 room art cells; third floor added; moved selection became Floor 1; 23 explored dungeon art cells; zero unexplored art cells; no captured window errors.
- Screenshot caught an avatar layering issue, corrected with explicit positioned sprite stacking. Browser sequence rerun after correction.
- Evidence: `evidence/tilesets/browser-check.js`, `evidence/tilesets/rehearsal.jpg`.
- Verification resets default art and leaves existing saved floor/interior drafts unchanged. No economy commands were submitted.

## Limitations and next design step

This is one browser-wide cosmetic floor/wall skin, not per-tile decoration or a shareable art pack. Town exteriors, furniture and actors keep built-in artwork. Uploads are local browser storage, not uploaded to a server or included in an expedition's contract terms. Art applies immediately and independently of room/dungeon Save or Cancel.

For a future NFT art marketplace, define an immutable content-hashed pack manifest (atlas, mappings, author, licence), a reliable media store, ownership verification on the selected chain, and explicit rights for players to view a maker's art without owning the NFT. Pin a pack/version to each edition so transfers cannot change a running dungeon. NFT ownership alone does not establish copyright or usage rights. No marketplace or wallet authorization was implied by this prototype.
