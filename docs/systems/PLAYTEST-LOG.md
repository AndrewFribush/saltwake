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
