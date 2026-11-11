# Single-screen builder workspace

Historical builder-only pass; superseded by [whole-game viewport integration](game-screen-verification.md).

2026-11-10. Local preview: http://127.0.0.1:18930.

## Changes

The dungeon builder launches from the guild steward into a viewport-sized workspace. Layout, Encounters, Art, Treasure and Open are separate views with persistent save, undo/redo and rehearsal controls. Floor geometry scales into the available space; encounters are edited one socket at a time. Owned treasure can be selected in the workspace in pages of four, using the same selection and publication checks as before. Geometry/funding problems are paginated, not hidden below the fold.

The interior builder uses the same frame with Layout, Art and Check views, plus a fitted walk-through preview. Art selection has 12-tile pages and a separate source/NFT view. Unapplied art drafts survive switching editor tabs. Rehearsal has Map, Bag and Journal views; bag items are paginated. Its journal shows the latest four events.

The frame makes background content inert, locks background scrolling, traps Tab focus and restores focus to the correct launcher on close. Confirmation waits disable editing/closing. Long editor status messages are paginated. Closing a dungeon workspace keeps its in-memory session while the guild remains mounted; Save drafts is still required before leaving the guild. Interior Close discards unapplied layout changes. Applying a tileset is independent and browser-wide.

## Verification

- Browser matrix at 1366×768, 390×844 and 390×667: all five dungeon views, rehearsal Map/Bag/Journal, and interior Layout/Art/Check/preview fit the viewport with no off-screen controls or scroll panels.
- Uploaded a 64-cell synthetic PNG through the file input, paged the atlas, assigned floor tile 13, switched tabs and confirmed the unsaved art selection remained.
- Populated art panel checked down to 320×568. A small-screen overlap was found and corrected; see final small-screen output.
- Duplicated/reordered a floor, used undo/redo, selected and deselected owned funding through the new Treasure view. No publication or economy command submitted.
- Focus returns to “Open dungeon builder” after closing. Browser matrix captured no window errors.
- Typecheck, web build, game suite (57 tests) and whitespace checks pass.

Evidence lives in `docs/evidence/studio/`. Viewport screenshots use explicit CDP clips: Aside's regular screenshot path stitched fixed overlays repeatedly across the underlying document, so those initial captures were replaced.

## Scope

This changes the builders and their previews. Other town service screens retain their existing layouts. Art remains local cosmetic data; no NFT ownership, minting or hosted upload was added. Tests cover normal browser zoom at the recorded viewport sizes; virtual-keyboard behavior and arbitrary accessibility zoom need physical-device testing.
