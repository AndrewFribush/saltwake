# Playtest log

Playing Saltwake as a stranger on a local sandbox (web 18970, API 18971), fixing the worst problems, and playing again. Screenshots are in `docs/evidence/playtest/`, named `rN-before-*` and `rN-after-*`.

## Round 1: the delver's first hour

**Tried:** arrived in town as the delver (10 coins, a club). Looked for something to do, bought ingredients, brewed, sold to the standing order, packed for the catacombs, ran a floor, extracted.

**Wrong:**
- Arrival gave no goal. The side window said only "Explore the town". Nothing said how to earn a coin.
- Market counter listed every unit separately, two per page: 16 bank items took 8 pages. Buying 2 herbs and 2 flasks meant paging through 8 flasks first.
- Selling needed a separate "Choose stored goods" mode, again paged two at a time. Prices said "credits" in one place and "coins" in another. Trader listings were shown by raw id (`listing-0 · Seller maker`).
- Crafting: you had to open "Choose stored goods" and toggle 4 tiles by hand. The finished batch showed raw ids (`crafted-c-087f…`). The recovery-job line ("Your holdings are 14; recovery work requires less than 6") read as an error.
- The gate let you pay and descend with nothing packed, and the only hint was "0 packed". The club had to be packed in another mode.
- After a run the result was `extracted · Settlement: Applied · town consumed: None` across 6 pages.
- District chat sat over the top-left building sign.

**Fixed:**
- Town idle window is now **Make a living**: a goal list that reads your state (coins, satchel, crafted goods, runs, editions) and ticks off steps: stock up, brew, sell or trade, delve, build. Low-asset characters see the recovery wage first. It only explains; it doesn't move you.
- New `TradeRows` stacks: one row per item type with − / + and a count. The market counter has tabs (Buy supplies, Player offers, Sell, Orders). Each one picks goods in place, then shows a plain confirmation ("Bought 2 Flasks, 2 Herbs. They are in your satchel."). The ids sent are still the exact first N ids of the stack, at the quoted prices.
- Selling to the bank or listing for players happens in the Sell tab. Your own listings appear under Player offers with a Withdraw button.
- Kettle: "Use 2 herbs + 2 flasks" fills the recipe, and "Brew a batch" starts it. The result card says "You brewed 2 Fine tonics" and what to do with them. The recovery section explains who qualifies.
- Gate: a **Your pack** panel above the offers, with stack rows for your gear and a warning when you'd go in bare-handed.
- After a run: a summary of treasure found, gear that came home, gear lost to the bank, goods used up, and treasure left below.
- Chat moved to the bottom-left corner. The satchel shows 8 goods per page, up from 2.

**Noted for the dungeon lane:** walking onto loot doesn't pick it up, and nothing prompts you (I extracted next to a sword without knowing it was one). The exit tile has no stairs art until you've stood on it. The run's side log doesn't update after entry.

## Round 2: two players, a trade, a player-built dungeon

**Tried:** a second session as the proprietor (localhost vs 127.0.0.1 cookie jars). Saw each other, traded through the trade window, then the delver built and opened a one-floor dungeon. The proprietor played it and took its treasure, and the delver checked the results.

**Wrong:**
- Both players spawned on the same tile, so one avatar hid the other.
- The trade window listed 20 separate checkboxes for the proprietor's goods, and one offer could mix herbs and swords at a single price.
- When there was nobody around, the chat panel took up space for nothing. The chat-name links rendered as big boxed buttons.
- The seller got no feedback that a sale happened except a chat line.
- The builder's 17 inspector sections sat in one dropdown with no order. The entry fee defaulted to 0 with no word that the maker earns it. After opening, the message pointed to "receipts below" (nothing is below in a fixed window), and the panel showed a funding error for the herb that had just been committed.
- **Loot was effectively invisible.** Standing on a reward tile showed "Nothing here yet." The only way to take it was the Bag tab, page 3 of 3. Round 1's sword went unclaimed this way.
- Maker view: `edition-1 · Version 1 · Entry 2 credits`, with no count of who entered, what you earned, or why it stopped accepting players ("depleted").

**Fixed:**
- Spawn points spread over the central road by profile.
- The trade window uses the same stack rows. Each offer is one kind of good at one price, and the Shop's Sell tab follows the same rule.
- Chat stays collapsed while you're alone and opens when someone arrives or speaks. Chat names render as plain links.
- A purse badge (+2 / −5) flashes whenever your coins change, so sellers and makers see income arrive.
- Builder: a step strip (1 Draw · 2 Encounters · 3 Treasure · 4 Check · 5 Open), with the full list kept under "All tools". The fee now explains that the maker keeps it, and warns at 0. Opening shows a green callout: "“Herb cellar” is open…".
- **Loot prompt:** standing on loot shows "You found Herb" with Take, plus Equip or Drink when they apply. It sends the existing `pickup`/`equip`/`use` actions.
- Maker headline: "1 delver has entered: 1 escaped, 0 died · You earned 2 coins". It also explains a depleted status and how to reopen. The offer card names the builder.

## Round 3: wallet mode and the builder ("I can't access it at all")

**Tried:** a local wallet mode that sends no testnet transactions. `scripts/wallet-sandbox.ts` deploys `init_public_testnet` plus the starter town, and creates player accounts. The server runs with `--wallet-local`, and the dev signer runs against the loopback RPC. Played the full maker loop as wallet players:
- player1 registered and did two recovery jobs (4 coins). It drew a floor, placed a pursuer and rehearsed. The draft survived a reload, and it opened the dungeon for 4 coins.
- player2 registered, earned 2 coins, found the dungeon at the gate, paid 1 and played it to extraction.
- player3 did three jobs (6 coins), bought a herb, funded it as a fixed reward and opened "Herb vault" for 3 coins.

**Wrong:**
- The builder itself works in wallet mode. Finding it is the problem: guild → walk to the Steward → Enter → "Build a dungeon" tab → "Open dungeon builder". Nothing in town or the guild says a builder exists. The guild's sign read "Fund an expedition".
- A new wallet player has 0 coins. Opening costs 2 coins plus 2 per pursuer, 3 per charger, 1 per trap and 1 per treasure spot, and the only hint was "You need 4 coins for placement" on the last step.
- The "All tools" dropdown repeated all 17 sections on top of the step strip.
- The shop-site picker was an abstract dot grid with no streets or building names.

**Fixed:**
- The guild has a **drafting table (✎)**. Walking to it, or clicking it, opens the dungeon builder directly. The room foot reads "Drafting table · Enter to open the builder". The guild's idle panel explains the table and the Steward, and the town sign now reads "Build a dungeon". Guild rooms saved before this change get the table added on load. The interior validator accepts at most one `builder` fixture.
- The builder launch panel says up front what opening costs and how many coins you have. When you're short, the Open step says how many recovery jobs would cover it, or what to remove to make it cheaper. Rehearsal stays free.
- The step strip (Draw · Encounters · Treasure · Check · Open) is the main flow. The dropdown is now "More tools" and holds only the other 12 sections.
- The shop-site picker draws the real water, roads and buildings with their names, and turns red when the footprint is blocked.

**Money finding (no contract change made):** under the deployed rules a fresh wallet player *can* open a first dungeon. Two recovery jobs (4 coins) cover a one-enemy design. Three jobs (6 coins) cover a herb and one treasure spot. It takes 1–3 short minigames first. Making it instant would need a starter grant at registration or cheaper placement. Both are contract state or rule changes that the deployed testnet state can't take without a migration, so the UI explains the path instead.

## Round 4: NEAR buy-in, end to end in local wallet mode

**Andrew's call:** "You can earn it or buy in. It's crypto remember." So there's no free grant.

**Built:** `buy_coins` on the contract (payable, 0.01 NEAR per coin, exact quote, idempotent per request, NEAR kept by the contract). Issuance is tracked in its own storage line, and `snapshot.coin_issuance` reports it. "Buy coins with NEAR" appears in the purse and in the builder's not-enough-coins step. It shows in wallet mode only, and only when the deployed contract reports buy-in.

**Played:** a fresh wallet player registered and bought 10 coins in the purse (`buy_coins`, credited 10). A second fresh player opened the drafting table and went to step 5. It saw "Opening this design costs 2 coins and you have 0" with a "Buy 2 coins for 0.02 NEAR" button, bought, and opened the dungeon straight away. Total time from registration to an open dungeon was under a minute, with no minigames.

**Fixed along the way:** the merged Vite config ignored `**/.claude/**`, which matched every file in a worktree, so worktree dev servers stopped hot-reloading. The ignores are now anchored to the checkout root. In the builder, the buy box sits after the cost message and before Pay, so the step fits in the window.

## Round 5: newcomer in the merged builder (with dungeon-depth features)

**Tried:** "Generate starting floors", then closed the builder, reloaded, and went to the Open step.

**Wrong:**
- On generated (larger) floors, the map pan controls (left/right/up/down) sat on top of the brush row, so neither could be used.
- Drafts only saved when you pressed "Save drafts". Closing the builder or reloading threw away a generated layout.
- The generated layout costs **84 coins** (12 enemies 30, 5 traps 5, 7 treasure spots 7, features 40) and needs 7 owned goods. The Open step showed only the total. (The generator defaults belong to the dungeon-depth lane, so I flagged them there.)

**Fixed:** pan controls moved into the map's top-right corner. Drafts autosave about 0.7 s after each edit and on close, and the footer says so. The Open step breaks the placement cost down and says to remove some to open for less. The coach mentions the generator as the fastest start.

## Round 6: a coherent earn path, and the run log

**Earn path.** Before: wages stopped at 6 coins (3 jobs, and only while holdings were under 6), but one batch of ingredients costs 8, so a broke player could never reach a first craft without buying in. Now:
- Recovery work is open to anyone who can't yet afford a batch: holdings under 8 (2 herbs + 2 flasks at catalog value). This rule lives in the contract, with a mirror in `workbench.ts`.
- New testnet deployments (`init_public_testnet`) allow 4 jobs per newcomer and reserve 160 wage credits (40 full newcomer paths), so four 2-coin jobs reach exactly 8.
- Old state still loads. The demo seeds are unchanged.
- A contract test now walks a zero-asset wallet through the whole path: 4 wages (8 coins) → a 5th job is refused → buy 2 herbs + 2 flasks → brew → sell both tonics to the bank (6) → open a no-treasure dungeon (2). Total coins stay at the seeded 330, so nothing is created.

**Run log.** It never updated after you entered: "Entered Floor 1." stayed in the status line through whole fights. The server hid every log line naming an enemy that wasn't on screen at that moment, which includes every enemy you'd just killed. Now only enemies you have never seen stay hidden. The server records which enemies each player has seen. Checked in play: "You hit floor-0-slot-0 for 1. / floor-0-slot-0 hits for 3." now appears turn by turn.

## Round 7: creator kit, two different dungeons

**Built for the creator workflow:**
- **Undo/redo:** this already covered every edit through the history. It now also works with ⌘/Ctrl+Z and ⇧⌘Z / Ctrl+Y outside text fields.
- **Copy a published dungeon** (Library). Any player-built edition becomes a new editable draft with its layout, encounters and reward *types*. Treasure, fees and records stay with the original. Developer preset rooms are marked as not copyable. The draft carries "Based on … by … (edition-N)", stored as an optional `source` on the blueprint. That attribution survives export and import and is not verified.
- **Share as text:** "Copy blueprint text" copies to the clipboard and shows the text, and "Import pasted text" runs the same checks as a file import. File export/import were already there.
- **Component reference** (Guide → Components). Every enemy, feature, trap/timer and reward gets a card: cost, what it does, *Player decides*, *You control*. The cards are generated from the live catalogs, so new components show up automatically.
- **Test again loop:** when a rehearsal ends there's a panel ("You died on floor 1, turn 8.") with **Test again**, **Edit floor N where it ended** (returns to Draw with the death/exit tile highlighted) and one-click kits (unarmed, club, sword, armored).

**Played as the proprietor:**
- **Sentry vault (stealth):** a wall splits the floor. A cracked wall hides a vault with a sword guarded by a crossbow sentry, two chasms sit in the outer room, and the exit is in the outer room. It opened for 9 coins with the sword funded.
- **Powder pit brawl (arena):** an open room with a brute, a charger, a powder crab, two kegs, oil and a salt spring. It killed me on turn 8 in rehearsal, so I retried with armor. It opened for 17 coins.
- Then I copied the vault from the Library, exported it as text and pasted it back as "Shared vault".

**What blocked me, now fixed:**
- **Stealth design was impossible by default.** The stairs need every enemy dead, so the vault couldn't be escaped without killing the hidden sentry, and the toggle was buried in More tools → Exits. The Draw step now has "Stairs (E) open only after every enemy on this floor is defeated", with a hint to untick it for sneak-past designs.
- **Finding the right good in Treasure meant paging through 20 goods.** It now says "Your fixed rewards need: 1 Sword" with **Assign 1 from your satchel**, and warns when you don't own enough.
- **Confusing names and markers:** new drafts were all named "My catacombs", and brute and powder crab both showed "B". New drafts are numbered, and each enemy has its own letter (P/C/A/K/B/N).
- **Coach:** it insisted on walls for an intentionally open arena. Placing encounters or features now completes that step.
- **Overflow:** the inspector overflowed the window, and now scrolls.

**Real run of the vault (the delver, paid 3):** I bumped the cracked wall open ("The cracked wall gives way"), and the sentry repositioned and fired. I took the sword, walked back around the chasms, and escaped on turn 29 with 10 health without killing the sentry. Settlement was applied: "Carried out: Sword". The stealth design plays as intended once the stairs no longer require a cleared floor.

## Round 8: creator feedback leads to an editable improvement

**Built:**
- **Run marks.** The server now records where each finished run of an edition ended (floor, tile, outcome, turn, killer from `killedBy` or the last hit) and shows them to the edition's maker only.
- **Revise in the builder.** This button on each edition in the steward's Manage view opens the published design as a new draft "Name v2" (cloned with attribution and no goods) and switches to the Draw step.
- **What the revision draft shows:**
  - A banner: "3 finished runs: 3 died, 0 escaped. Most deaths: charger (3)", with deaths by floor when there's more than one.
  - Map badges: ☠N where delvers died, ↑N where they escaped. Hovering a tile lists each run's turn and killer.
  - The badges can be hidden.
- **Retiring an edition.** This is a new contract action, `retire`. It works like this:
  - Only the maker can retire an edition. Its terms stay unchanged.
  - New admissions fail with `EditionRetired`, and active runs finish normally.
  - `finalize_close` is allowed before the cutoff once the edition is retired.
  - The retired list is stored outside contract state, so old state still loads, and it's reported in `snapshot.retired_editions`.
  - On screen, a retired edition shows as "retiring" while runs are still inside, then "retired". Retired editions disappear from the gate.
  - The maker can retire from the steward ("Retire (stop new delvers)") or right after publishing the revision ("The earlier edition … is still taking delvers. Retire it").

**Played:**
- The proprietor opened "Charger hall" (two chargers and a brute), and three delvers died in it.
- The steward showed "3 delvers have entered: 0 escaped, 3 died". I pressed Revise.
- The draft showed ☠3 on the tile where a charger caught everyone. I removed that charger, added a wall, rehearsed and survived, then opened "Charger hall v2" for 9 coins.
- I retired v1, and it vanished from the gate. I closed it from the steward straight away, since no runs were active.

**QA fix (QA-PASS-2026-11-11):** a generated preset's treasure spot draws from the random pool `creator-loot`, but the Treasure step opened on Fixed rewards, so picking goods there errored. Step 4 Check also said "Ready" while Open was blocked. Now:
- The Treasure step opens on a pool the design actually uses.
- Each random pool says "draws N per attempt; it holds M", with **Put N of your goods in it**.
- Check lists funding problems ("Funding: Random pool creator-loot needs at least 1 goods…").

Verified on a fresh generated preset: Check now reports the shortfall, one click fills the pool, and Check and Open then show ready.

## Round 9: richer maker feedback, and safer paying at the gate

**Built:**
- Run marks now carry which floors each run visited and what happened to each funded reward it was assigned: taken out, left behind, used up, or back in the pool after a death.
- `packages/shared/src/edition-insight.ts` turns those marks into:
  - a per-floor funnel (entered → reached floor N, deaths there → escaped);
  - top killers;
  - loot per reward spot: funded / taken / left / used / back in pool;
  - suggestion lines, e.g. "Most delvers die to the charger on floor 1 before reaching any treasure", "Nearly everyone escapes with the treasure", "Delvers escape but leave the treasure", "Few delvers reach floor N", and "Only N runs so far".
- The revision banner shows all of this. The steward's headline shows the main suggestion.

**Played:** "Tonic cellar" (a charger and a fine-tonic reward). One delver died to the charger, and one took the tonic and escaped. The revision view read: "Entered 2 → floor 1: 2 (1 died) → escaped 1 · Floor 1 · Fine tonic: funded 2 · 1 taken · 1 back in the pool after a death · Only 2 runs so far: wait for more before big changes."

**Gate bug (from the dungeon lane):** the dungeon list and each offer's rules both used "Next →", so a scripted click paid into the wrong dungeon. Now:
- The list says "← Previous dungeon / Dungeon 1 of 3 / Next dungeon →" and sits under a gold divider.
- An offer's rules use "‹ Back / More rules ›", and long text uses "More ›".
- The pay button names the dungeon: "Pay 1 coin & enter Rat warren".

## Round 10: grid power tools, and a 4-floor dungeon built with them

**Built:** `packages/game/src/floor-regions.ts` (pure, tested), `apps/web/src/RegionTools.tsx` and `apps/web/src/FloorOverview.tsx`. FloorBuilder gets a few one-line hooks.
- **Area select:** two clicks mark an area, which you can then Copy, Fill wall or Fill floor. Paste places at the clicked top-left, and Rotate ↻ and Mirror ⇋ work on the copy. Pastes never touch the outer wall or wall over markers, encounters, devices, features or passages. Every operation is undoable.
- **Room stamps:** built-ins are Pillared hall, Corridor junction, Vault alcove, Arena ring, Long corridor, Twin rooms and Wall segment. "Save as stamp" keeps your own on this device, with a mini preview for each.
- **Keyboard on the map:** arrows move a cursor (Shift jumps 5) and the view follows it. Space paints or places; W/F/S/E pick a brush; V selects, C copies, P pastes, R rotates, M mirrors, Esc stops.
- **All floors** (Overview): a mini-map of every floor with arrival, stairs, encounters and passages, plus size, enemy and treasure counts, the exit rule and where the stairs or passages lead. Drag one floor onto another, or use ↑/↓, to reorder; click a floor to edit it.
- **Whole floor** zoom shows a big floor in one view instead of panning a 13×9 window.

**Built a 4-floor, 21×15 dungeon:** resize → select the whole interior → fill floor → stamp a pillared hall, a rotated vault alcove and twin rooms → duplicate the floor 3 times → change floor 4 by keyboard (moved arrival, drew a wall run) → reorder in the overview → add enemies on floors 2–4 → Check said ready → rehearsed floor 1 of 4.

**What was slow or broken, and fixed:**
- **Unreachable floor.** Selecting a 19×13 area needed panning, so I added Whole floor. Then closed stamps left sealed rooms, and the only clue was one "Show tile" at a time in Check. Cut-off floor is now hatched red in the Draw step, with a one-click "wall them off". Twin rooms now has doorways, and Arena ring is new.
- Fill left a heavy blue selection over everything; it clears after a fill now, and the selection style is lighter.
- On big floors the grid's last rows were squashed; rows are now even and the grid keeps the floor's aspect ratio.

## Round 11: route check in the flow, and three unfamiliar-creator sessions

**Route check in Check:** every floor is now checked automatically (moves, waits and shoves, with the chosen test kit) whenever you open 4 Check or 5 Open, and again after any edit. Each floor shows ✓ "reachable in N turns", ✗ "the stairs cannot be reached…" or ? "too big to prove, rehearse it", and you can click a floor to go there. Map issues or an impossible floor put ⚠ on the 4 Check button, and a proven-impossible floor blocks Pay in 5 Open with its explanation.

**Session 1: puzzle vault (keys, lock, plate).** Where I hesitated:
1. I drew a wall, then clicked a wall tile to put the locked door in it and got "Place this feature on a free floor tile." **Fixed:** a locked door clicked onto an interior wall now cuts a doorway with the lock in it.
2. A pressure plate's "Channel" field said nothing about whether anything listens. Mine controlled nothing, and no check said so. **Fixed:** Check → Wiring lists every channel's inputs (plates, switches) and outputs (doors, stairs conditions), and flags "controls nothing yet. Add a door with this channel in Devices…".
3. Plates and keys live in Features, but doors and switches are under Devices, where "Add device" is a dropdown. That's two places for one puzzle. (Not fixed; the reference cards now point to both.)

With the key, door and plate wired, the route check said "reachable in 19 turns". A chasm in front of the only door made Open refuse to publish, with the reason.

**Session 2: speed-run gauntlet with the tide.**
4. I couldn't find the tide. It's only a checkbox at the bottom of More tools → Features. **Fixed in the reference:** the Rising tide card now says where it lives and what it controls.
5. **Pressing Esc to stop stamping closed the whole builder.** **Fixed:** while selecting or stamping, Esc stops the tool ("Stopped. Esc again closes the builder.").

Two long-corridor stamps, a charger and a sentry, with the tide set to 30 turns: rehearsal showed "Tide in 29" and a charger lane down the corridor.

**Session 3: no-treasure haunted house.**
6. The Treasure step still offered goods to assign and said "0 goods · No reward complete copies". **Fixed:** with no treasure spots it says there's nothing to fund, that delvers come for the challenge, and that you still keep the fee.

## Round 12: newcomer adventurer, artisan outlets, showcase dungeon

**Newcomer, start to second run (The newcomer, fresh demo town).**
1. The newcomer started with "1 expedition completed" and one coin gone, because the demo seed spent their first run on a settled record. **Fixed:** the demo's two settled runs now use a veteran (the mercenary), so the delver and the newcomer start fresh.
2. The gate offer said "open · 1 floor · 4 places open now · no treasure" and told you to go read two other tabs. Nothing said what was inside or what you were risking. **Fixed:** the Overview is now a card with a danger label (enemy and trap cost per floor, raised when the record shows most finished runs dying), the threats by name and count, the treasure by name with stock value and funded attempts, the record in words ("1 run: 0 escaped, 0 died, 1 gave up. Small sample."), and **You risk**: the fee plus your packed gear by name, which goes to the bank if you die.
3. The run summary repeated "You made it out." under the identical result card, and never mentioned the fee. A run with no treasure still said "Dungeon makers buy finds like these". **Fixed:** it is now "Your ledger for <dungeon>". It lists the entry fee (kept by the maker), treasure, gear home, gear lost and items used up. After a death it explains that packed gear is the stake and that the bank resells it. If you went in bare-handed it says only the fee was lost.
4. After the first run the goals list had no next step, and the bank counter sells only ingredients, so gear was hard to find. **Fixed:** a "Gear up for the next run" goal appears once you have delved. It names the player shops currently selling clubs, armour or tonics.
5. **The gate showed only the three cheapest dungeons.** The matcher capped suggestions at 3, so a fourth dungeon at a higher fee never appeared, even with a pager. **Fixed:** the gate now passes a limit of 12 to `matchEditions`, which still defaults to 3.

Second run: I packed the club, chose The drowned stair (Dangerous: 6 enemies and 2 traps over 2 floors) and escaped from floor 2 with 4 health. The ledger read "Entry paid: 3 coins · Treasure found: none · Your gear came home: 1 Club".

**Artisan.** The goals panel and the kettle result card both said only "sell at the market". **Fixed:** both now list the best current outlets with prices. For example: "Tonics now fetch: 5 each: a player commission wants 2 (notice board, Commissions tab) · 3 each: the bank buys". The demo seed now posts one escrowed commission from the proprietor (2 tonics at 5) so artisans see player demand. The demo-town test counts escrow in coin conservation.

**Showcase dungeon.** "The tide vaults" (demo supply) is the large three-floor preset (seed 11) thinned to the proprietor's budget: enemies come off the shallowest floor first, and 4 enemies and 3 traps remain. A fine tonic on floor 2 and a sword at the bottom are funded from goods the proprietor already holds. It is published by `scripts/demo-town.ts` through the normal publish command and housed in the east hall that used to point at the starter (the starter stays at the gate). It was generated, not hand-drawn in the builder. I copied it into the builder through the Library to check it. The route list shows all three floors reachable on the quick check, and the full check with enemies passed with the club kit (18, 22 and 18 turns). Wiring was fine. As the newcomer with a club I escaped from floor 3 with 1 health; the auto-walker set off a powder keg in a floor-2 corridor on the way.

Evidence: `docs/evidence/playtest/r12-offer-card.png`, `r12-run-ledger.png`, `r12-showcase-offer.png`, `r12-showcase-routes.png`.

## Round 13: showcase made robust, three funded copies

- Generator changes on main (lure vaults, sealed arenas) raised the large preset's cost, and `npm run sandbox` crashed on "Showcase needs 64 coins; budget 45". **Fixed (0385728):**
  - The showcase now thins in two stages. Optional hazards go first (oil, kegs, caches, altars, springs, chasms). Then the most expensive enemies and traps go, shallowest floor first, always keeping one fight on the last floor. Geometry, keys, locks, plates, cracked walls and devices are never removed.
  - If one seed can't fit, it tries the next of 10 seeds.
  - Seeding never throws on the showcase. If no seed fits, it logs "showcase skipped (...)" and seeds the rest of the town.
  - `apps/server/test/showcase.test.ts` and `demo-town.test.ts` now run the showcase against the current generator.
- The showcase had only one funded attempt, so it emptied after a single win. **Fixed:** it is now funded for three delvers. Each copy is a herb on floor 2 and a fine tonic on the last floor (10 coins of goods against a 4-coin fee), all from the proprietor's seeded goods. The two fine tonics the pantry used to shelve now fund the showcase. The pantry sells the proprietor's spare sword (12 coins) instead, so the town has a sword for sale. Conservation is unchanged; demo-town.test checks for 6 funded items.

**Next step:** the first five minutes for a fresh visitor. Script a path that ends either with escaping The tide vaults or with building and opening their own Small dungeon, then polish every rough step on that path. Start from the round 12 notes above: the offer card, the run ledger, the gear-up goal and the outlets text are in place. Not yet checked: whether a newcomer with 10 coins can afford the showcase (4) plus gear, and whether the Small preset fits a newcomer's budget.

## Round 14: the first five minutes (demo mode)

**The two open questions.**
- *Can a newcomer with 10 coins afford the showcase plus gear?* Yes on money: every demo delver starts with 10 coins and a club; The tide vaults costs 4, which leaves 6 for a tonic (3–5 at the shops). It was not survivable, though. Thinning removed enemies shallowest-first, so floor 1 was empty and floor 2 kept two chargers and two sentries; the offer card said "Dangerous, 13 enemies over 4 floors". The bot with club and tonic escaped floor 2 at 2 health; bare-handed it died there.
- *Does the Small preset fit a newcomer's budget?* Only just. Over 199 seeds Small costs 9–11 coins with treasure (it needs 1 good: the newcomer's club) and 8–10 without, so 10 coins usually fit and left 0–1. After one delve (8 coins left), Fit my budget said "Even the smallest layout costs more than your coins". Delving first locked a newcomer out of building.

**Played as a fresh visitor (The delver, 10 coins and a club).** Town → catacombs → escaped The smugglers' hollow with a tonic in 26 turns → guild → Fit my budget → Check → rehearse → fund → opened "Sentry's stash" for 7 coins. Roughly five minutes once the steps below were fixed.

**Fixed:**
1. **The goals panel led with crafting.** A fresh visitor's first highlighted goal was "Stock up on ingredients". Now it says **Start here: pick one** and offers two cards:
   - **Delve:** names the best affordable dungeon with funded treasure, its fee and its loot. It says to press + to pack your club, and how escaping works (stand on the stairs, choose Escape).
   - **Build:** tells you to press Fit my budget and says what that costs with your coins.
   Once you have done one, the other stays on top ("Next: you have delved; now build one of your own"). The crafting steps follow under "Then make a living". A tonic found in a dungeon no longer ticks off "Brew tonics"; only a finished batch does.
2. **The gate opened on a no-treasure attraction** (Rat warren). Dungeons with funded treasure left now come first, cheapest first within each group.
3. **The gate didn't tell you to pack your club.** It said "Nothing packed. You would go in bare-handed." Now it says "Press + on your club to pack it (2 damage)".
4. **The showcase now ramps.** First every floor is capped at floor number + 1 threats (enemies plus traps), then the budget trim runs. Every floor keeps at least one threat. Seed 11 now goes 2 / 3 / 4 / 4 threats. A cautious bot with club and tonic escapes with the herb at 6 health; bare-handed it escapes at 4. A test pins the ramp and the club escape.
5. **Fit my budget always gives you something to open.** If even Small doesn't fit, it trims a Small: optional hazards first, then traps, then the costliest enemies, always keeping one enemy. Over 199 seeds: 6 coins → 5–6-coin dungeons every time, 5 coins → 91%, 4 coins → 40%; 3 coins says what the minimum is and how to earn. New `packages/game/src/draft-budget.ts`, with tests.
6. **The builder's generator sat below the long stamp list**, under the coach's "press Generate starting floors". The generator now comes first in 1 Draw, and the coach names Fit my budget.
7. **Builder notices vanished at once.** The 700 ms autosave cleared every notice, so "Fitted to your budget…" and "Generated…" were never seen. Autosave no longer clears them.
8. **The cost hint described the next seed, not your draft.** After fitting a 7-coin draft it still said "costs about 9 coins… too big for you". It now says "Your current draft costs 7 coins to open", then what a new generated Small would cost. "1 goods" is now "1 good".
9. **The cut-off hatching marked a hidden stash** behind a cracked wall as unreachable, and offered to wall it off. Cracked walls now count as a way through.
10. **The Check and Open funding errors had no fix button.** Both now have "Fund the treasure in 3 Treasure →". "Put 1 of your goods in it" used to pick the club (a newcomer's only weapon). It now offers spare goods first, cheapest first, and names them: "Put your tonic in it".
11. **New drafts defaulted to a 0-coin fee.** They now default to 1, and the hint shows what other open dungeons charge ("1–4 coins"). The opened notice says what to do next: give it a door in town with Build here, and watch the record at the steward.
12. **The coach forgot you had rehearsed** after a reload. Now remembered per draft on this device.
13. **Bumping a wall in a paid run showed "Action not permitted"** in an alarm banner. It now says "That move is not permitted: a wall or no space there. No turn spent." Legacy editions' "Extract" button is now "Escape", like the newer ones.
14. **The showcase ignored newer rules versions** (dungeon lane's tip). It and the demo presets now publish with `requiredRulesVersion` and the matching module format (v13 keys/plates, and any newer format the generator emits). A test checks every showcase seed.

Not fixed, for other lanes: the run's "You made it out." card is partly covered by the ledger card (look-feel). The Large preset is labelled "3 floors" but the showcase seed makes 4 (dungeon-depth). "The smugglers' hollow" plays under its legacy room title "The candle cellars" (old v1 edition).

Checks: typecheck, game 195, web 31, server 173 and build are green; after merging build/dungeon-loop (v14 tide clocks) typecheck, game 197, web 32, server 179 and build are green, and the showcase rules-version test passes on v14. On contract (no contract changes this round), closure and craft pass when run alone. economy-stress's "S17 support exhaustion" still hit an RPC TimeoutError on a solo rerun at load average ~20-30, with the other lanes testing; the other stress tests passed alone.

Wallet mode was not played this round. The wallet sandbox, API and Vite started and the dev-signer sign-in page loaded, then the session wrapped up.

**Next step:** the same five minutes in wallet mode (`scripts/wallet-sandbox.ts` + `--wallet-local`, dev signer). A wallet newcomer starts with whatever the local seed gives, so check that the Start-here cards, Fit my budget and the buy-in suggestion line up. Then a second player (gstack `$B`) plays the newcomer's freshly opened dungeon, and the maker reads the result in the revision view.
