# Authored departure rules

Rules 11/custom11 adds an explicit exit policy per floor: allow extraction, require the room cleared, and optionally require a named signal on or off. These independent settings compose with existing geometry, enemies, hazards, doors, switches, rewards and directed passages. Creators need not build a kill-all sequence.

An onward-only exit can still continue to the next linear floor. Both stair actions obey that floor's clearance and signal settings. Graph passages retain their own clearance policy. At least one floor must permit extraction, and every exit condition channel needs a switch somewhere in the dungeon. Those checks establish wiring, not solvability.

A departure spends a turn: committed enemy actions and hazards resolve before the player leaves. Lethal damage prevents both extraction and continuation. New creator rehearsal normalizes every floor to explicit policies and no longer invents a threshold shrine. Published rules 1–10 retain their admitted behavior; old codecs ignore exit metadata.

The builder's Exits inspector has fixed Departure, Condition and Help pages. Drafts/blueprints preserve policies, including unfinished condition text in saved drafts; invalid policies block rehearsal/publication. Current-floor hints disclose the condition and its current signal state without exposing unrelated hidden signals.

## Verification

Evidence is in docs/evidence/exit-rules/.

- 152 game tests pass, including escape with live enemies, lethal extraction/continuation, onward-only stairs, channel/clearance composition, blocked actions spending no turn, legacy shrine preservation and codecs.
- The full server suite passed 98 tests before the second departure outcome case was added. The final focused suite separately passes both extraction and death cases. These are overlapping counts, not 100 distinct tests.
- Funded server cases publish two floors, reserve exact goods, traverse a signal-gated onward-only exit, restart the database and replay continuation exactly once. Successful extraction transfers reserved loot; lethal departure sends town equipment to the bank and returns unused dungeon loot to its original pool.
- Six focused WASM tests and the contract build pass, covering strict paired condition fields, required exit policies, cross-floor wiring, at least one extraction floor, bounds, legacy isolation and large funded publications.
- TypeScript and the web build pass.
- Aside browser verification creates/configures two floors, checks all Exits pages at 1366×768 and 390×844 without page overflow, switches a blocked exit, continues without extracting and extracts on the final floor.
- Separate browser sessions verify saved flags/channel, preservation of invalid unfinished channel text, and repair.
- Existing local sandbox code was backed up/refreshed with identical economic snapshots; API restarted. Actual builder publication confirmed edition-7 with rules11 and exact saved exit policies. This labeled tooling fixture cost two local demo coins and funded no treasure.

Independent engine/recovery review found no concrete departure/readiness bugs. Schema review found an existing malformed-Unicode passage-ID discrepancy: JavaScript accepted unpaired surrogates which Rust rejects. Shared validation now rejects those IDs; a regression covers lone high/low surrogates and valid emoji IDs.

## Limits and remaining work

One designated exit tile per floor remains; passages provide additional spatial transitions. Exit conditions currently use one boolean channel, not an arbitrary expression language. The kit retains documented resource ceilings and its existing component catalog. No test here proves an authored puzzle solvable or the game fun. Broader composition coverage, world/economy lifecycle, identity/onboarding and independent human acceptance remain in COMPLETION-GOAL.md. This increment does not finish the whole game.

No testnet, paid call, hosted upload or production change occurred.
