# Tile world and purse

User request: make everything a grid/tile system, let players enter houses, build out money/wallet.

Implementation choices: retain React and the existing movement/economy authority. Visible 24×16 town tiles and 11×9 indoor rooms. Each destination has a south exit, blocking furnishings, a service station, and an account book. Click-to-walk and cardinal keyboard movement share collision rules. Commerce and crafting appear when the character reaches the corresponding station; forms remain appropriate for quantities and prices. The dungeon remains its existing tile-based simulation.

The purse reports local synthetic coins and confirmed economy history. Item catalog value is never called spendable money. Preserve exact item identities, finite reserves, idempotent commands, profile guards, and settlement recovery. No wallet authentication, deposits, withdrawals or public-chain actions are implied.

Verification: room reachability/collision tests, accounting tests, existing regression suites, browser walk-in/service/walk-out, desktop/mobile layout. Current sandbox retained. Human evaluation of game feel remains open.
