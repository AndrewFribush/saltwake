# From economy prototype to a playable town

Andrew's direction: make the existing loop a game, drawing on roguelikes, Diablo, Pirates! and Mount & Blade. Existing instructions to keep building cover this local implementation; no new hosting or paid action.

The first slice starts in a walkable port town, not a practice/menu launcher. A visible character travels between a market, alchemist, guild, inn and dungeon gate. Each destination opens only its own interaction. Movement and stock are real state; economic mutations still use the existing authenticated server and exact inventory IDs. Town movement is cosmetic and cannot confer rewards. Dungeon gameplay is authoritative.

Borrowed mechanics: Diablo's compact town/preparation/expedition/return rhythm; roguelike fog, seeded layouts, lost loadouts and in-run choices; Pirates!/Mount & Blade's places with different livelihoods and a shared trade economy. Do not claim naval travel, armies or an open world. Avoid turning buildings into a new full-screen list of all controls. The market trades finite goods, the workbench plays an actual timing challenge, the guild funds expeditions, and the gate risks prepared gear.

Visual direction: an illustrated overhead harbor map with stone paths, mossy roofs, timber market awnings, amber windows and dark water. Palette: harbor #183b47, grass #344c39, stone #857861, roof #744332, parchment #e1c998, ink #18231f. Georgia for town/place names, system sans for readable play controls. Map occupies the main play surface; a narrow satchel and nearby-place prompt provide context. Focusable destination buttons and keyboard walking provide equivalent access. Reduced motion removes travel animation.

Tasks:
- [x] Connected town movement, reachable destinations, keyboard/click travel and interaction tests.
- [x] Town-first client; place-specific inventory/trade/craft/funding/gate interactions, clear return after settlement.
- [x] Distinctive map and dungeon visuals, responsive layouts and focus handling.
- [x] Seeded paid expedition rules for new editions, preserving old rules and exact funded goods; no free practice rewards in paid runs.
- [x] Local browser rehearsal of travel, commerce and expedition entry; meaningful engine/server tests, typecheck/build.

Limits: existing maker layout editor remains unfinished. A spatial world alone does not establish compelling combat or an emergent economy. Preserve explicit test-credit/custody disclosure in session controls. Human gameplay acceptance remains open.
