# Variable floor dimensions

Rules v5 (`custom5:` modules) supports independent rectangular dimensions of 5–31 columns and rows. Modules remain bounded to 2048 bytes, 16 freely placed encounters per floor, and the existing 2–4 floor limit. Legacy v3/v4 modules keep their fixed 13×9 validation. Blueprint v4 carries variable dimensions; prior blueprint versions retain their old constraints.

## Creator and player flow

Size controls resize the selected floor without changing other floors. Growth adds solid rock, keeping all existing geometry and placements. Shrinking rejects attempts to cut off floor tiles or markers, with an instruction to move/paint them first. Undo/redo remains available. Draft format v4 permits variable dimensions while preserving earlier imports.

The editor shows up to 13×9 tiles and provides directional panning. Rehearsal and authoritative play show the same size viewport following the character. Button coordinates remain world coordinates. Located diagnostics and recorded trial positions focus the appropriate distant area. The surrounding game windows remain fixed; panning the map does not scroll the page.

## Evidence

- 113 game tests: resize preservation and rejection, 5×5/5×31/31×5/31×31 rectangles, codec/blueprint compatibility, viewport edges, and saved trace coordinates beyond the old frame.
- 84 server tests, including v3/v4/v5 real local-contract funding, reservation, materialization, refresh and abandonment. The v5 random reward is at 28,15.
- Five focused WASM contract tests, including legacy compatibility, dimension bounds, four maximum-sized floors with 64 placements, malformed/ragged/disconnected/out-of-bounds definitions and exact last-slot funded reservation. Rust source reviewed independently of implementation.
- Typecheck and asset build pass.
- Aside browser: expand to 31×17, pan and carve a route, relocate exit to 29,15, rehearse the route using movement input, locate its finish in the editor. Desktop 1366×768 and phone 390×844 controls fit with no page scrolling or offscreen controls. The phone run viewport retains 117 visible tile buttons; the character reaches 29,15. The saved 31×17 draft survives browser reload.

Evidence: `docs/evidence/variable-floors/`. The browser creation is an explicitly saved tooling fixture, not a supplied adventure or human acceptance result. Tests exercise disposable local contracts; they do not establish arbitrary-topology support, enjoyment or public wallet readiness. Authored transition graphs, broader configurable components and independent loot pools remain on the completion checklist.

## Existing local runtime

The local API was stopped for a backed-up code refresh of the existing loopback sandbox contract, then restarted. The update asserted exact equality of economic snapshots before and after; no schema migration, world reset or state reissuance occurred. The subsequent save/reload browser flow passed. No testnet, paid call, production or hosted deployment was performed.
