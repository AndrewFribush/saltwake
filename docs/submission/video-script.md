# Demo video script (target 2:30, max 3:00)

Record the local demo at http://127.0.0.1:18930 (crowd on, demo town seeded). One take per scene is fine; cut between scenes. Say the lines or paraphrase. Keep the cursor still while talking.

## 0:00 Town (20 s)
Screen: Saltwake harbour, townsfolk walking, chat panel open with crowd lines scrolling.
Say: "This is Saltwake. It's a dungeon game where the players build the dungeons. Makers draw the floors and fund the treasure from things they own. Adventurers pay to go down and either come back with the loot or die and lose their gear. Everything you'll see, every coin and item, is state in one NEAR contract."

## 0:20 Notice board (15 s)
Screen: harbour notice board, eight open dungeons with fees, maker names, funded treasure.
Say: "Here's what's open tonight. Each one was published by a player, with its entry fee and the rewards they funded. The contract mints nothing after setup, so every prize here came out of somebody's inventory."

## 0:35 Pay and go down (40 s)
Screen: walk into a dungeon entrance, pack a tonic, pay. Purse drops, fee shows reserved. Run starts: fog, minimap top right, journal on the right.
Say: "I pay three coins. The fee sits in reserve until the run settles. Down here it's a roguelike: fog, a minimap of the rooms I've seen, and a journal of everything that happens."
Screen: fight one enemy, step onto loot (auto-pickup line in the journal), drink a tonic with Q, take the side passage, find the stairs.
Say: "Stepping on loot takes it. Every action is a key, the prompt bar shows what's available right now. That's the stairs. I'll take what I have and get out."
Screen: press X. Result card: Pending, then confirmed. Finds listed, maker's fee shown.
Say: "The server settles the run on chain. Once it's confirmed, my finds are mine to sell and the maker got paid."

## 1:15 Die (20 s)
Screen: second run, walk into two enemies, die. Result card: gear to the bank, dungeon finds back to the pool.
Say: "If I die, my town gear goes to the bank's stock and anything I'd found goes back into the dungeon's pool. Nothing is destroyed and nothing is printed."

## 1:35 Build (40 s)
Screen: Delvers' guild, builder mode. Draw a room, add a side room, place two encounters, pick rewards from owned goods, set fee, publish. Placement cost leaves the purse. Notice board shows the new edition.
Say: "Now the other side. I draw the rooms, add a side room on the same level, place encounters and traps, and fund the rewards from my own goods. Publishing costs a placement fee and locks the layout. It's on the board immediately, and anyone can pay to try it."

## 2:15 Economy and chain (25 s)
Screen: Copper Kettle craft, or commissions board, then the testnet explorer page for `saltwake-20261114.testnet` and `npm run test:contract` output with the conservation line.
Say: "Artisans craft the tonics, shops resell them, commissions are escrowed orders between players. The contract is live on NEAR testnet, players sign their own actions with a wallet, and the test suite runs the whole economy against the real WASM and checks the coin total never changes. Saltwake, built at NEAR HACKATHON."

## Notes
- Footage can come from practice at the Salt Lantern: open the game with `?seed=11` (or 17, 19) for a three-floor practice layout that shows every enemy kind, kegs, oil, cracked walls, a pit, a spring and an altar. Y retries the same seed. For a paid run on camera, The wreck of the Marigold (large preset) has the same spread.
- Keep the purse visible during the pay and settle scenes.
- If the shrine appears on floor one, take the heal (1) and keep moving; don't explain it.
- Abandon is Shift+X twice; avoid it on camera.
