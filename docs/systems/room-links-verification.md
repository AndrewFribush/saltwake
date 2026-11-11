# Authored room connections

Connections mode replaces automatic next-floor progression with player-authored directed passages. Creators place them on free tiles, choose destination floors and optionally require the source room to be cleared. Separate return passages, branches, self-links and reachable leaf rooms are supported. Moving onto an enabled passage spends one turn; source enemies and hazards resolve before travel. Death prevents travel. Extraction stairs retain their previous cleared-room rules and economic settlement.

## Definitions and editing

Rules v6 uses `custom6:` modules. Each floor declares 0–8 passages; all floors must be reachable from floor 1. Passage IDs are unique per floor and bounded to 32 UTF-8 bytes. Passages cannot overlap spawn, extraction exit, encounters or another passage. Existing 5–31 dimensions, 2–4 floors, 16 encounters per floor/64 total, funding limits and 2048-byte modules remain explicit resource limits. Blueprint v5 preserves connections. Legacy modules discard graph metadata rather than accidentally enabling behavior their rules never supported.

The editor lets creators explicitly convert a linear draft to connected rooms. Reordering preserves destination identity. Duplicating a floor preserves its outgoing targets; a copied floor needs an incoming connection to become reachable. Removal is blocked while another floor points to the selected floor. Resize protects passage tiles alongside other markers. Undo/redo remains available. Existing linear drafts remain linear unless converted.

## Reentry and authority

The run stores remembered enemy and trap state per visited room. Rooms do not respawn enemies or synthesize new loot on return. Off-room enemies/traps are frozen; intents are recalculated on reentry. Arrivals use the target spawn, or the nearest reachable unoccupied floor tile if an enemy occupies spawn. Passage entry does not immediately trigger another passage. Individual destination arrival anchors are not yet configurable.

Economic items remain in the existing global exact-ID run inventory; room memory does not contain item copies. The HTTP view removes remembered rooms and full layout, exposing only discovered connections of the current room. Connection graphs do not enable the old automatic continuation/shrine actions.

## Evidence

- 119 game tests, including graph validation and codec roundtrip, locked no-turn rejection, walk-on travel, enemy/loot preservation, safe return arrival, destination remapping, passage-safe resize, UTF-8 bounds and legacy metadata isolation.
- 85 server tests. The funded graph case publishes actual stock, defeats an encounter, collects its exact tonic, traverses away, reopens the database, retries the same travel request, returns without respawning the enemy or loot, consumes the tonic and abandons. The tonic remains consumed, the town club goes to the bank and admission is paid once.
- Eight focused WASM tests cover legacy schemas plus graph branches/returns/self-links, reachability, IDs/positions/destination bounds and exact funding.
- Typecheck and asset build pass.
- Aside browser at 1366×768 and 390×844: author three connected rooms, take both branches and their return paths, reorder a floor, verify destination identity, save and reopen. Linked-floor removal is disabled. No page scrolling or offscreen controls.

Evidence directory: `docs/evidence/room-links/`. These are correctness and interaction checks, not human enjoyment evidence. The named saved graph is a tooling fixture, not a supplied game adventure. Wider floor-count limits, additional reusable components, independent loot pools, wallet onboarding and the remaining completion checklist are still open.

## Review and existing runtime

Independent read-only engine/schema review found no concrete correctness issue in reentry, arrival overlap, legacy metadata handling, destination remapping or view redaction. This is a source review, not an additional test suite. The parent separately reviewed the Rust validation change.

The existing loopback sandbox contract was backed up and refreshed without a schema migration. Its complete economic snapshot matched before and after. The API was restarted against the same database. No testnet, paid call, hosted deployment or production action occurred.
