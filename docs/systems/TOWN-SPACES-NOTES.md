# Town spaces notes (feat/town-spaces)

Goal: towns and interiors are player-built spaces. Players create, place, relocate, open, stock, furnish and demolish their own buildings; the buildings and their rooms come from contract state, so every player sees the same town and the same room.

## What already existed (before this lane)

- Contract `Shopfront` records: owner, title, district, 3×2 footprint, validated 11×9 interior JSON, version, open flag, listing ids. Create/update (move)/stock, buy blocked when closed. Town renders them, collision and door entry use them.
- Starter NPC buildings (inn, market, kettle, guild, catacombs) with interiors editable per browser only (localStorage).

## Land rules land-v1 (contract change, logic only)

`contracts/economy/src/shops.rs`, mirrored in `packages/shared/src/land.ts`, exposed by the `land_rules` view.

- At most 32 buildings in town and **3 plots per owner** (`PlotLimit`). Only creation counts; moving/editing an existing building never does. Worlds that already exceed the limit still load and edit.
- Building use lives inside the stored interior JSON as optional `kind`/`edition` (absent = shop), so **no state layout change and no migration**. Old interiors parse exactly as before.
- `kind:"dungeon"` = dungeon entrance: must link an edition that exists, whose maker is the actor, and is not closed at save time (`MissingEdition`, `WrongEditionMaker`, `EditionClosed`). Requires exactly one `portal` fixture; `portal` is rejected in shops. The link grants nothing: admission still goes through `admit` with its exact version/fee checks.
- Fixtures may carry `text` (≤160 UTF-16 units): authored notices visitors read.
- New action `remove_shop {shop_id, expected_version}` (Borsh index 22, after `stock_shop`): owner + version checked; refused with `ShopHasStock` while any of its listings is active. Frees the plot. New ids use the next free `shop-<n>`.
- Merge note: if another lane also appends an `Action` variant, keep `RemoveShop` at index 22 in both `model.rs` and `packages/shared/src/protocol.ts`, or renumber both together. Testnet needs a contract redeploy to get land-v1 (coordinator's job).

## Tests

- `tests/contract/town-spaces.test.ts`: land_rules view, plot limit, dungeon entrance binding, stray/missing portal, notice length, demolition owner/version/stock checks, id reuse, items unchanged by demolition.
- `packages/game/test/town-spaces.test.ts`: building use round-trip, TS validation mirrors contract, dungeon entrances in `districtPlaces`.
- Existing shop and player-authority contract tests still pass (including the "pre-identity upgrade without migration" test).

## Next step

Web UI: building-use choice + plot counter in ShopBuilder, notice/stairway tools in InteriorBuilder, readable furnishings in Interior, dungeon entrance desk (pack + admit) inside the maker's hall, demolish button, distinct dungeon-hall art in Town.
