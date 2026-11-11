# Claude review

Independent review of the initial proposal/source bundle; no playtest performed.

**Verdict:** the direction is right and the proposal is unusually honest, but it is not yet a design. It names the correct genre blend, the correct first experiment, and the correct limits. It does not make the three decisions that determine whether the game is fun or whether anyone will ever fund a dungeon. At the fixture numbers supplied, a maker commits reference value 48 to earn at most 8 in fees. The fun side has two weapons, two enemies, one trap, and one build choice. The vision paragraph describes a game that is three design decisions and one resource away from existing. Make those decisions now, in writing, before slice A is cut.

## What I treat as fixed by Andrew

I infer these from the proposal text, not from conversation with Andrew. Correct me if any is actually open.

- Gear is forfeited on death.
- Every find is funded and reserved before admission. Nothing is minted in the dungeon.
- Committed treasure never returns to the maker. Residual stock and forfeitures go to the bank.
- Bank buys at half reference price, sells at reference, within stock and budget.
- Crafting keeps a per-batch minigame.
- Authoritative inventory IDs, origin partition, escrow, reservations and fixed windows are preserved.
- Old paid runs keep old rules.

Everything below is my proposal.

## Top five improvements

1. **Add one consumable that creates pressure and demand: light.** The current loop is deterministic, turn-based, intents fully revealed, no clock. That is a solvable puzzle. Instead of a pursuit timer, make intent visibility cost a resource. A lamp burns one unit per turn. While lit, you see threat tiles and lanes. When it runs out, intents hide and alert radius grows. Oil is the second recipe. This couples economy to the loop without arbitrary durability: every turn spent looting is paid for in a player-made good, and a run that goes badly consumes stock the artisan sells. The proposal's candidate second recipe, a shove tool, creates no such ongoing sink.

2. **Decide, in one sentence, what a death pays whom.** The proposal admits the death incentive is unsolved and moves on. It cannot be deferred, because it fixes the maker's cost basis and the ranking logic. My recommendation: allocate treasure per admission, not per edition. Each paid run reserves its own socket bundle at admission. If the player dies, that bundle goes to the bank, not back to stock. The maker then earns nothing from a death and the fee is purely the price of the attraction. Maker cost rises, so pair it with the next item.

3. **Separate the attraction fee from the treasure stake.** Today the fee must cover both authored challenge and lottery prize, and at fee 2 versus stake 48 it cannot. Let the maker set a fee that is theirs, and let the treasure be an optional stake the maker funds or a sponsor funds. A zero-treasure edition becomes a first-class product rather than a playtest exception. This also answers the low-population problem: a solo player can pay a fee for a well-made floor without anyone needing to have crafted prizes.

4. **Fold shove into the club's guard instead of adding an action.** Guard currently halves one hit. Make guard with a club also push one adjacent enemy one tile along the facing line. The action count stays at four. Club gains identity, sword keeps damage, and the push, charger lane and alternating spike interaction appears with no new verb. Reach weapons and ranged enemies stay out until this produces a story in playtest.

5. **Write the ranking function.** The proposal says cheap prices alone should not determine discovery, and the supplied matcher sorts strictly by fee and returns three. That is a contradiction with no resolution. State the score. Suggested: fee bucket, then finish rate shrunk toward the global mean by sample size, then recency, with a reserved third slot for editions under ten attempts. Without this, every maker learns that the only visible lever is undercutting.

## What to cut

- Both early run modifiers. One build choice already exists. Add a second only after the lamp exists.
- Player buy orders and commissions before a second human is regularly online. Escrow with expiry, partial fill and double-fill protection is a week of correctness work to prove a path nobody walks yet.
- Persistent lore, recipe familiarity and maker relationships. Meta-progression is retention polish on a core not yet shown to retain.
- The replay and decisive-mistake explainer. The log keeps eight lines. Extend the log to the whole run and show it on the death screen. Diagnosis tooling comes after there is something to diagnose.
- The two-arm, order-varied formative test. Eight people cannot support a comparison. Run one arm and ask the five questions.

## Smallest playable experiment

Smaller than slice A. One authored floor, two rooms, one charger, one pursuer, two spike tiles, one cache socket off the main path, extraction tile active from turn one. Club with push-guard versus sword. A lamp with enough oil for roughly twenty turns. Practice mode, no economy. Record turn-by-turn actions, cause of each hit, whether the cache was taken, whether extraction happened before the clear, and whether the second attempt differs from the first. Pass signal: most players change loadout or route on attempt two, and at least one player leaves treasure behind to escape. If no one ever leaves anything behind, the pressure is too weak and the economy's loss mechanic has no teeth.

## Accounting and incentive risks

- **Alt extraction.** Matcher excludes the maker's own profile but not a second local profile. A maker can admit their alt and extract committed treasure back at the cost of one fee, defeating the never-returns-to-maker rule. With local profiles this is trivial. Either accept it and drop the rule, or detect same-device profiles.
- **The bank is the only faucet and sink.** No coin issuance source appears in the excerpts. Fees flow to makers, maker purchases flow to the bank, forfeitures flow to the bank. Without a stated money-supply rule the economy deflates toward the bank. Write the bank budget replenishment rule before any scenario test.
- **Crafting margin is thin.** Two tonics from four inputs at reference 2 each gives material 8 for reference 12, before bank buyback halves it to 6. An artisan selling to the bank loses. Artisans only exist if players buy at above half reference, which requires visible demand, which requires the buy-order feature you are deferring. Resolve this by making the lamp the artisan good players must restock.
- **Death as a run slot.** A death consumes one of max_runs. With per-edition treasure, high death rates maximize fee count per unit treasure. Item 2 above removes this.
- **Potion heal values are not in the excerpt.** With twelve hit points and hits of three and four, a tonic that heals four versus six changes whether guard or potion is the right turn. Publish the numbers.
- **Stray branch in intent reveal.** In `packages/game/src/combat.ts` the alert-distance check appears a second time inside the charger block after the lane is cleared. It looks unreachable. I have not run it. Worth a look before fixture tuning.

## Three questions that would change the design

1. **What is the launch population?** If the realistic state is one human and NPC backstops, the trade cycle in slice B is a demo and item 3 is the whole economy. If five or more humans are expected concurrently, buy orders move up.
2. **Is combat meant to stay fully deterministic with persistent layout versions?** If yes, a published solution ends an edition, replays become walkthroughs, and variety must come from authored versions and the lamp. If some variance is acceptable, the design space is different.
3. **Does Andrew want makers to profit from treasure at all, or only from fees?** Yes changes the stake rule and the ranking score. No makes treasure a sponsor and bank concern and simplifies the maker dashboard considerably.
