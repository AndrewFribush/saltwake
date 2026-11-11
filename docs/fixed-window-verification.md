# Fixed game windows

2026-11-10 · Local app at http://127.0.0.1:18930

The frame now reserves its map, inspector, header, control strip and status strip at all times. Window sizes depend on the viewport only. Opening an account, belongings, Session, a shop or a builder changes window content rather than adding a column or resizing the map. An idle inspector occupies the same space when closed.

Builders portal into the existing game stage, preserving the HUD and footer. Their canvas and inspector use the same fixed frame; switching inspector modes never changes canvas bounds. Builder key events no longer bubble into the underlying house. Free practice also retains the regular HUD and game stage.

`apps/web/src/fixed-windows.css`, imported after the other game styles, defines the authoritative window geometry. Desktop uses a permanent right inspector; portrait uses a permanent lower inspector. Resizing the viewport changes the frame; opening or closing content does not.

## Verification

- `invariance-check.js` measures map rectangles before/after wallet open/close, belongings, counter open/change/close, builder open/mode changes/close and returning to town. It also asserts that the builder fills exactly the game stage, rather than the browser viewport. Run at 1366×768 and 390×844.
- Largest observed position/size delta was 0.0078125 CSS pixels from subpixel grid rounding. HUD, stage and builder mode checks were exactly unchanged.
- Session open/close has identical room bounds. Idle and wallet screenshots show the same player and map coordinates.
- The existing 56-view whole-game matrix passes with no off-screen controls or captured window errors. Dungeon/rehearsal Map, Bag and Journal views retain the same board sizes.
- Uploaded synthetic tileset fits the fixed inspector on phone and desktop: zero inspector overflow, zero off-screen builder controls.
- 57 game tests, typecheck, web build and whitespace validation pass.

Evidence is in `docs/evidence/fixed-windows/`. Tests use local UI and synthetic art; no purchases, publishing, paid calls, deployments or production mutations were performed. Physical-device keyboards and arbitrary zoom levels remain outside the tested viewport matrix.
