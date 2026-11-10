# Floor and house builders — local verification

2026-11-10. Implemented locally on `build/dungeon-loop`. No paid inference, public-chain transaction, hosting or production deployment.

## What is playable

**House interiors:** enter any house and select Edit interior. Paint walls/floors, move arrival and the south-wall door, place the service counter/account book, and furnish with beds/shelves/barrels/chests. Undo, restore-default draft and walk-through preview are available. Saving installs the validated arrangement into the actual room; services retain their real economy behavior. Layouts persist per house in this browser, shared across its demo characters. Furniture is cosmetic and does not mint or spend economic items.

**Dungeon floors:** visit the guild steward. Draw 2–4 bounded 13×9 floors, move spawn/stairs/four sockets per floor, and choose enemies, traps and fixed rewards. Costs and required funding update. Save multiple per-character drafts, undo/reset, and play a synthetic rehearsal. Publishing uses selected owned item IDs and charges the contract's existing placement rules. No-reward editions are supported. Published geometry is immutable; editing a draft does not mutate sold attempts.

Version 3 stores authored floor JSON inside existing module strings, capped at 2,048 bytes each. This avoids changing the persisted contract schema. Rust publication and TypeScript materialization validate dimensions, walls, traversable unique markers and full floor connectivity. Version 1 and 2 stay supported. Server runs retain fog/redaction, exact reserved identities, deadlines and durable settlement.

## Evidence

- 54 game tests passed, including authored interior reachability, blocked/isolated stations, malformed layouts, door movement and path routing.
- Initial full verification: 32 of 33 actual-WASM contract tests passed; the existing fee/cutoff test timed out at 120 seconds. That test passed in isolation in 18.2 seconds. The initial full command therefore did **not** exit successfully; all 33 cases passed across the suite plus isolated retry. No timeout was increased and no case skipped.
- 49 server tests passed, including custom-layout validation, exact v3 materialization, hidden identities, restart and settlement coverage.
- Final typecheck, web build and whitespace check passed. Contract build passed.
- Independent code review found publication retry timestamps changed the saved payload. The editor now reuses the still-pending publication's times while preserving the parent command's payload-mismatch guard. It never resurrects a cleared receipt. Saved active draft selection also now restores on reload.

[Initial full log](evidence/builders/full-verification-initial.txt), [isolated fee retry](evidence/builders/fee-test-isolated-retry.txt), [server tests](evidence/builders/server-tests.txt).

## Browser and economy proof

Aside exercised the UI, not direct mutation of game state:

1. Moved the market service station and south door, previewed walking through the changed exit, saved, and reloaded. New station and door positions persisted. At 390px viewport, page width remained 390px.
2. Drew a wall, moved stairs to (3,1) and reward socket 0 to (2,1), selected a fine tonic reward, saved and reloaded the active draft. Free rehearsal used the authored geometry and moved normally.
3. The proprietor published “Builder verification” (edition-1), paying 3 synthetic coins and funding the actual owned `maker-fine-tonic-2`. No preview item IDs were submitted.
4. The mercenary entered through the gate, started at (1,1), took that tonic at (2,1), reached the authored exit at (3,1), and extracted. Applied settlement recorded `dungeon_extracted: maker-fine-tonic-2`, then returned to town.
5. A second no-reward edition tested retry behavior. Browser fetch was deliberately made to fail once before a publication request reached the server. Retrying the unchanged design created exactly one “Interrupted request proof” edition, charging its 2-coin placement once.

[Interior flow](evidence/builders/interior-browser.txt), [floor editor/publication](evidence/builders/floor-browser.txt), [actual authored run](evidence/builders/authored-play-browser.txt), [interrupted publication](evidence/builders/publication-retry-browser.txt), [interior screenshot](evidence/builders/interior-builder-final.jpg), [floor screenshot](evidence/builders/floor-builder-final.jpg).

The existing local sandbox was upgraded with `scripts/upgrade-local.ts`, without reinitializing it. The helper held the API's database writer lock, refused unresolved transactions, deployed only to loopback, and asserted complete before/after economy snapshot equality: 53 items, one prior edition and two prior runs. The API was restarted on port 18931. Subsequent browser actions intentionally added the two proof editions and extracted the funded tonic.

## Limits and remaining gates

- Interiors and drafts are local-browser persistence, not shared multiplayer property records. Room editing itself has no economy price or ownership enforcement.
- Dungeon builder currently uses fixed rewards, not a random-loot-table editor. It has 2–4 floor indices, not a library of four themed generated modules or drag-to-reorder navigation. Preview uses a synthetic club kit rather than the selected real loadout.
- Authored geometry is public edition data. In-run fog controls normal presentation; it is not secrecy against someone inspecting published terms. Undiscovered funded reward identities remain redacted from run views.
- The operator remains trusted for custody, combat, timing and settlement. No external wallet login is added.
- This proves local editing/publication/play and invariants; it does not establish fun, balance, creator demand or human acceptance of the original four-module checklist. Canonical M26/M27 move to in-progress, completed tally remains 30/48, and human/external-release gates stay open.
