# Reusable switches and linked doors

Rules v10 adds a device collection to each custom10 floor. Devices are switches or doors, each with a tile, a local ID and an authored channel name. Signals start off. Stepping onto a switch toggles, sets or clears its channel before enemies act. Doors open when their channel matches their configured on/off condition. Channels can connect devices on different floors and persist for the run, including database restart. A new run starts with signals off.

Closed doors block entry, sight propagation, enemy pathfinding and committed charge lanes. A creature already on a door tile may leave if it closes. Waiting on a switch does not activate it again. Signals do not create goods or money; admission, funded reward reservations and settlement retain their existing rules. Devices have no additional placement fee in this prototype.

The grid editor's Devices inspector provides placement, selected-device configuration and help. Switches and doors use distinct map marks and accessible labels that report current state. Default character rendering is preserved. New drafts/publications use version 10; earlier modules and blueprints ignore device metadata. Blueprint/draft 10 preserves authored devices, including unfinished channel text in saved drafts, while rehearsal/publication rejects invalid wiring or schemas.

## Validation and limits

- 16 devices per floor, 64 across the dungeon; device tiles cannot overlap arrival, exit, encounters, passages or other devices.
- IDs are 1–32 UTF8 bytes, well-formed Unicode and unique per floor. Channels start with an ASCII letter and contain at most 32 ASCII letters/digits/underscores/hyphens.
- Exact tagged schemas distinguish toggle/set/clear switches from boolean-condition doors; unknown fields/types reject.
- Every door channel needs a switch somewhere in the dungeon. This is a wiring check, not proof that the puzzle is solvable. Intentional traps, one-way routes and unreachable switches still require rehearsal judgment.
- Existing 4096-byte module, 1–16 floor, 64-encounter, 128 KiB publication and 300 Tgas new-publication bounds remain. Device budgets are additional, not a replacement for encounter/funding bounds.

## Review findings fixed

A closed door can separate free ground from an occupied arrival area. Room entry now searches before changing current-room state; if no valid unoccupied arrival exists, the player stays in the source room and receives a blocked-passage message. The attempted movement's turn/enemy effects still resolve. Self-links use current live room state.

Shared device-ID validation now rejects unpaired UTF16 surrogates. Without this, TextEncoder replaced them during byte counting while Rust rejected their JSON, allowing a misleading local validation success.

## Evidence

`docs/evidence/mechanisms/` contains:

- Game tests for switch modes, inverse doors, safe property-like channel names, movement/sight, gate closure across a committed charge, graph return persistence, fresh-run reset, codecs/legacy behavior, malformed data, blocked arrival and Unicode.
- Contract build and six focused WASM tests: strict schema, positions, limits, cross-floor wiring, graph validation, legacy stripping, exact funded admission, and large Publish/PublishRandom with sixteen 31×31 floors, 64 devices and 64 tuned traps.
- Server integration: a real funded v10 run hides loot behind a closed door, activates a switch exactly once across action retries and database restart, passes the door and extracts the exact reserved good. Hidden device/channel data is absent from public views.
- `browser.txt`: actual grid placement/linking, editing panels at 1366×768 and 390×844 without page overflow, closed/open labels and walk-through rehearsal.
- `reload-browser.txt` and `repair-browser.txt`: saved channels reopen; invalid unfinished channel text blocks rehearsal, survives save/reload and is repaired. Phone-width journal controls fit.

## Scope

These are reusable primitives, not a named adventure or a puzzle whitelist. This is also not arbitrary uploaded executable code. More component behaviors, economy/world lifecycle work, broader system trials and human judgments remain under COMPLETION-GOAL.md. Technical checks do not establish fun. No paid calls, testnet, hosted upload or production action occurred.

Final counts:146 game tests,97 server tests,6 focused WASM tests, TypeScript and web build passed. Independent follow-up review confirmed both reported fixes. `local-refresh.txt` records the backup and identical pre/post economic snapshot. `publish-browser.txt` confirms edition-6 was published through the actual local builder with rules10 and two linked devices. The labeled empty tooling fixture costs two local demo coins and commits no treasure.
