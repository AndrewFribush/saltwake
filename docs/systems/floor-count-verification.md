# Single-floor and larger authored dungeons

New rules v9 allow 1–16 authored floors using the existing custom7 geometry/tuning/connection schema and v8 operating terms. New drafts start with one floor. Old publication versions and blueprint versions retain their original floor limits. The current version has at most 64 encounter positions across the design, at most 16 per floor, 5–31 tiles per dimension and 8 connections per floor. These are explicit resource bounds, not a whitelist of experiences.

The builder supports adding, duplicating, removing and reordering up to sixteen floors. Referenced floors cannot be removed until incoming links are changed; reordering preserves destination identity. Rehearsal, saved/imported designs, trial records and server materialization retain high-index floors. A single-floor dungeon extracts without a mandatory extra room. A connected layout can return through previously visited floors without duplicating goods.

Draft saves now check the same 500 KB bound as the loader before replacing storage, preventing a large library from becoming unreadable after reload. Blueprint exports likewise enforce their 100 KB import bound. Invalid or oversized work remains in the current editor for repair/export; existing saved storage is preserved.

## Transport and execution limits found during review

A valid sixteen-floor design exceeded the historical 32 KiB request cap. New v9 publication commands now receive a bounded 128 KiB envelope in the server and contract. Other commands and prior publication versions retain 32 KiB. The HTTP command route streams at most 128 KiB; other routes retain 32 KiB, and the Outbox checks the exact bound before recording an operation. The builder checks the serialized command before submission. V9 signed transaction storage permits 256 KiB of base64 data; other transactions retain 64 KiB.

The actual HTTP test then exposed prepaid gas exhaustion at 100 Tgas, despite direct contract tests succeeding with a larger allowance. The server now attaches 300 Tgas only to v9 publications; other operations retain 100 Tgas. `large-http-diagnostic.txt` retains the failed transaction status, and `large-http-tests.txt` proves a 37,789-byte actual HTTP publication succeeds after the fix. The test also rejects oversized and legacy requests without new operations or economic changes. All execution was on disposable local sandboxes.

## Evidence

Directory: `docs/evidence/floor-count/`.

- `game-tests.txt`: 138 passed, including single-floor extraction, sixteen-floor sequential progression, directed graph traversal/return, trial persistence on floor16, destination-preserving reorder, legacy blueprint limits and total encounter budget.
- `contract-tests.txt`: three focused WASM tests passed for floor-count boundaries, aggregate encounter count, v1–v8 restrictions, graph reachability and exact last-floor funded reservations.
- `large-command-tests.txt`: two additional WASM tests passed for Publish/PublishRandom, sixteen 31×31 floors with 64 tuned traps and four links per floor, exact 128 KiB v9 and 32 KiB legacy boundaries, and atomic rejection beyond them.
- `browser.txt`: created a sixteen-floor ring entirely through the builder, exercised floor limits, played to floor16 and checked controls at desktop1366×768 and phone390×844 without page overflow.
- `reload-browser.txt`: reopened saved sixteen-floor design, verified destination15, checked incoming-reference removal protection, reordered a floor and played the ring back to its entrance.
- `contract-build.txt`, `typecheck.txt`, `build.txt`: offline WASM build, TypeScript and web build passed.

## Remaining scope

This removes the mandatory 2–4 floor shape, not all authoring limits. Broader reusable components, terrain/land lifecycle, identity/onboarding, ecosystem stress and human acceptance remain on COMPLETION-GOAL.md. Automated traversal and DOM fit checks do not establish fun or visual acceptance. No testnet, production, paid inference or hosted action was performed.

Final integration evidence: `server-tests.txt` reports 94 passing tests, including both funded floor-count cases and the actual large HTTP publication. A subsequent independent review found a pre-existing signed-size retry bypass. `signed-size-red.txt` reproduces it for both legacy and v9 limits. The guard now checks new signatures before persistence and existing signatures before every broadcast. `final-outbox-tests.txt` reports ten passing tests, covering the entire Outbox suite plus actual large HTTP publication, repeated processing, database restart and previously stored oversized signatures. Typechecking passed after that fix; the local API was restarted with it.

`local-refresh.txt` proves a backup-preserving contract refresh with identical economic snapshots. `publish-browser.txt` confirms local edition-5 was created through the builder with rules9 and sixteen floors. It is an empty labeled tooling fixture, costing two local demo coins, without funded treasure.
