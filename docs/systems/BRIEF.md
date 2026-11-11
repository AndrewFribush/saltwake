# Saltwake — product and execution brief

Authoritative brief, rewritten from scratch following Andrew's correction. Execution is authorized. Older adventure-centered briefs and review prompts are historical and must not drive implementation.

## Build this product

A multiplayer economic dungeon game whose content is made and operated by its players. Build the reusable game rules, the building kit, and the economy connecting creators, adventurers, artisans and merchants. The operator runs central issuance and the bank/NPC economy. Players make the dungeons.

The creator's loop is conceive → build → configure → rehearse → procure/fund → open → observe → replenish/revise. The adventurer's loop is choose → prepare → play → extract or lose → use/trade/re-equip. The civilian loop is source → make or acquire → stock/price → sell → reinvest. All three must be worthwhile activities in the same game.

## Acceptance

A creator can construct materially different playable experiences through the tools without an engineer writing a map or branching the code for that creation. Another player can play the saved/published definition under the advertised rules. Creator feedback leads to an editable improvement. Finite goods and actual transactions connect those activities. Human playtests assess the tools, the creations made with them, and the economy; automated tests establish correctness, never fun.

Developer-authored layouts exist only as labeled regression fixtures or optional demonstrations. A named adventure, scripted winning route or handcrafted campaign is not a product milestone. Do not make one the default experience or organize the backlog around its mechanics.

## Required system capabilities

- Shared versioned definitions for geometry, entrances/exits, floor order, encounters, hazards and rewards, used by builder, rehearsal and authoritative play.
- An understandable component catalog and grid editing workflow with configurable supported behaviors, validation, undo/redo, saved drafts, cloning and eventually validated import/export. Explain catalog limits; arbitrary executable user scripts are not implied.
- Rehearsal of the actual authored definition, configurable synthetic starting kits, quick retry and return to the same editing context. Synthetic goods cannot enter the economy.
- Central validated publication of player creations with fixed terms, paid admission, finite reserved reward copies, funding/refresh and closure.
- Procurement, batch crafting, shops with real stock and player-set prices, resale of dungeon finds, and understandable recovery after losses.
- Public performance records and qualified business accounts based on confirmed events, with missing history and sample sizes disclosed.
- Consistent tiled characters/world/interiors and fixed windows. Opening a service fills its allotted window; no map movement or page scrolling.

## Fixed economic rules

Makers pay for treasure and keep ordinary admission fees. On loss, unconsumed dungeon-origin goods return to the pool; town-origin gear goes to the bank; consumed goods stay spent. Found goods can be used during the run. At closure residual treasure goes to the bank, not back to the maker. No-treasure attractions remain valid. Resources are loot/supplies, not compulsory mining. Artisan work is per batch. Four concurrent reservations is not four lifetime customers. Existing exact IDs, quotes, escrow, reserves, duplicate prevention and recovery must survive every change.

## Work order

1. Remove the mistaken named-adventure default; audit current capabilities and duplicated rules. Preserve useful generic changes only where tests support them.
2. Establish one shared definition-to-play path. Prove multiple author-created definitions work through it, without embedded adventure data.
3. Strengthen the building/rehearsal loop: component explanations, useful configuration, actionable validation and alternate test kits.
4. Test creator intent and unfamiliar-player understanding early. Refine the kit and reusable interactions according to observed gaps.
5. Connect creation to procurement/funding/publication and the full civilian/adventurer economy. Verify lifecycle, versions and recovery.
6. Iterate economic and creator/player decisions, then independently review the complete system.

The detailed S01–S18 systems plan is subordinate to this brief. Treat unnecessary serial dependencies pragmatically: work independently while human feedback is unavailable, but leave human evidence explicitly pending. Never request a test of our special adventure as the gameplay gate.

## Scope and operating constraints

Local development and local sandbox simulation only. No paid calls, testnet, production, hosted uploads, deployments or unsolicited participant messages. Preserve existing working state and unrelated edits. No fixed deadline promise. Record what exists, what was tested, and what remains incomplete. Do not claim an economy sustainable because simulated profiles exchanged seeded goods.

## Navigation constraint clarified by Andrew

Towns and interiors are player-built spaces. Clear inventory/account controls do not authorize a fixed global activity directory, service-location assumptions, or menus that automate walking between activities. Preserve spatial exploration and interaction with placed doors/furnishings. Navigation UI must follow authored world data and the player’s position, rather than replacing the world with a predefined list of destinations.

## Arbitrary authorship clarification

Andrew reiterated that players must be able to make arbitrary dungeons. Implementation must not wait for him to nominate two dungeon concepts, and sample intentions must never define a whitelist of supported creations. Build composable spatial, encounter, hazard, reward and progression systems; test generated and adversarial combinations. Human playtesting evaluates the resulting tools and enjoyment, not permission to implement general authoring.

The current 13×9 floors, exactly four sockets, 2–4 floor sequence and limited component catalog are prototype constraints to remove or generalize, not the product definition. Practical resource ceilings must be explicit and versioned. Preserve existing admitted rules when extending definitions. Arbitrary player-authored content does not require executing arbitrary uploaded code.
