# Look and feel notes (feat/look-feel)

Goal: make Saltwake look and feel like a real game without changing rules or the economy. Presentation only.

## Art and licences

All art is original, drawn in this repository as code. No external images, fonts or sprite packs are used.

- `apps/web/src/art/pixel.ts`: shared 30-colour palette and a pixel-grid to SVG data-URL renderer.
- `apps/web/src/art/sprites.ts`: 16×16 pixel sprites (hero front/back/side, rat, boar, crossbow sentry, powder crab, drowned brute, rat nest, keg, cache, loot chest, salt spring, blood altar, cracked wall, spikes armed/safe, stairs, two-frame flame, interior furniture) and procedural tiles (flagstone floor, brick wall, grass, cobbles, water, planks, plaster, slate). Tiles are installed as CSS variables `--tx-*`.
- Licence: same as the project. Nothing to attribute.

## Structure (to keep merges small)

- New code lives in `apps/web/src/art/` (sprites, `Sprite.tsx`, `RunFx.tsx`, `FeatureArt.tsx`, `skin.css`). `skin.css` loads last from `main.tsx`.
- `CharacterSprite.tsx` keeps its signature (adds optional `facing`) and now draws the pixel hero everywhere.
- `Run.tsx` edits are presentational: tiles draw static things (stairs, spikes, loot, features); creatures move to an overlay `ActorLayer` positioned over the grid. Tile buttons, labels and click handling are unchanged.
- Dev-only gallery: `apps/web/gallery.html` (open `/gallery.html` on the dev server). It shows every sprite and tile and a fixed scene with every enemy, feature and telegraph, playable through the real `Run` component. Not part of the production build (Vite builds `index.html` only).

## Log

### 1. Dungeon sprites, actor layer, effects
- Pixel sprites for the player (with facing) and all six enemy kinds incl. dungeon-depth enemies; features (keg, lit keg with animated fuse flame, burning oil with flame, oil slick, chasm, spring, altar, cache, cracked wall); stairs/passages, spikes, loot.
- Floor/wall textures; remembered tiles dimmed, unexplored black.
- Creatures glide between tiles (130 ms), face their movement, lunge on attack, flash and jolt when hit, puff on death; floating damage/heal numbers; blast burst with sparks; sparing screen shake (player takes 3+ damage, or a big blast). Health shown as pips (bar above 8).
- Enemy state cues: primed crab pulses red, aiming sentry glows, stunned shows stars, recovering/unaware are desaturated, unaware shows "z".
- Telegraph: danger tiles get a pulsing red hatch and border above floor art and features, below creatures; player in danger gets a "!" badge.
- `prefers-reduced-motion` turns off glides, shake and looping animation.

Verify: typecheck, game, web, server (156) and build pass; contract suite 80/82 with two settlement tests timing out under load, both pass when rerun alone (`tests/contract/settlement.test.ts`, 3/3).

Screenshots: `docs/evidence/look-feel/before-*.jpg`, `after-*.jpg`, `gallery-*.jpg`.

### 2. Town, interiors, UI skin
- Town map tiles use pixel textures (grass, cobbles, water, town wall); buildings get timber walls, shingled roofs and a slate gatehouse. Grid lines faded.
- The town avatar glides between tiles (85 ms, matches the walk step), faces its direction and idles; other players use the same sprite with their own facing. The avatar remounts on district change, so it never slides across the map.
- Interiors: plank floors, plaster/wainscot walls (slate in the gatehouse), furniture sprites (counter, scales, kettle, banner, crossed swords, bed, shelves, chest, barrels, account book) and a door sprite; unknown furniture falls back to its glyph. The player faces the way they walked and does a small step animation.
- UI skin: bevelled board buttons with a brass edge that press in; brass primary buttons; pressed/selected state; one panel frame for HUD, service window, turn feedback, chat, shrine and purse; pixel coin on the wallet; painted signboards for town places; serif headings (system Palatino/Iowan/Georgia stack, no web fonts); thin brass scrollbars.

Verify: typecheck, game 168, web 29, server and build pass; contract suite 81/82: `S17 support exhaustion` (tests/contract/economy-stress.test.ts) hits its operation timeout under machine load (load average 10 to 27), also when rerun alone; this change touches only apps/web and docs.

Note for anyone running a local sandbox next to `npm run verify`: in this session the local sandbox process exited each time the contract suite ran. Restart it (and the API) after verify.

### 3. Merge of build/dungeon-loop
- Kept the dungeon-depth run summary, turn log and telegraph colour scheme: the threat overlay now takes its colour from the tile's `warn-*` class (bolt gold, blast red, brute sweep orange; other danger coral). Town keeps `townTerrain` and dungeon-hall roofs with the new textures; Interior keeps builder/notice fixtures, room overlay and idle hints with the new furniture/door art and player facing.
- Checks after merge: typecheck, game 171, web 30, server 157, build pass.

### 4. Second and third merges; Town.tsx kept nearly untouched
- Town textures now come from CSS: `skin.css` maps the flat colours Town.tsx paints (grass, road, water, wall, timber, slate, four roof colours) onto pixel patterns defined in `art/Places.tsx` via attribute selectors. Town.tsx differs from main by three lines only (import, `<TownPatterns/>`, avatar glide/facing), so the town-spaces lane can keep editing it.
- Shopkeepers (palette-swapped hero) stand behind service fixtures; harbour water drifts (SMIL, off under reduced motion); builder floor grid and interior paint grid use the floor/wall textures.
- Per-house floors keep the playtest lane's distinctions with textures: inn planks, market pale flagstones, workshop and gatehouse slate, guild carpet. Fixtures keep a faint gold ring.
- Checks after merge with build/dungeon-loop 0364ad8: typecheck, game 176, web 30, server 157, build pass.

### 5. Shared surfaces from the other lanes (CSS only)
- Harbor notice board: cork board with pinned parchment notes; room notices are paper notes; display shelves get wooden shelf lines; room chat and trade panels share the panel frame.
- Run summary is a parchment expedition report (gains green, losses red); the turn log is a ledger with the newest line highlighted; threat overlays hide once the run has ended.
- First steps reads as a quest log (current step brass); builder step strip sits in a recessed track, the coach is a parchment note; selects and inputs share the skin.
- Builder previews (`.game-sprite.*`, `.depth-feature.*` CSS drawings) now show the pixel sprites via `--sp-*` variables, so the construction kit and play use the same art.
- New sprites: drafting table, notice board, display shelf (interior fixtures map by name).
- Checks: typecheck, game 177, web 30, server 158, build pass.

### 6. Title card for arrival and wallet onboarding (CSS only)
- `--tx-title`: an original pixel harbor at dusk (houses with lit windows, catacomb gate, quay, water with moon reflection, the hero, a shopkeeper, a rat, a powder crab and a keg) drawn from the shared palette and sprites. Shown above every `.arrival` screen (connecting, wallet onboarding, wallet errors) via `::before`; no component change.
- Gold serif title, framed wallet picker with full-width buttons. Dev preview: `/gallery.html?arrival`.
- Checks: typecheck, game 177, web 30, server 157/158 with `wallet-craft-http` timing out under load (passes alone), build pass.

### 7. Mobile fixes and feedback polish
- Fixed: on phones the dungeon board jumped right once it took keyboard focus (saltwake-polish's focus rule set `position:relative` on the absolutely centred board). Board is centred again (`after-dungeon-mobile.jpg`).
- Compact chat head and lighter sign shadows on phones.
- Pickup sparkle (✦) when something enters the bag or supplies; pulsing red vignette while health is 3 or less (static under reduced motion).
- Checks: typecheck, game 177, web 30, server 158, build pass.

### 8. Interior glide
- The player in rooms is drawn by `RoomHero` (art/Places.tsx) over the tile grid and glides 90 ms per step like the town avatar; tiles no longer draw the hero. Two-line change in Interior.tsx.
- Checks: typecheck, game 178, web 30, build pass; server 161/162 after rebuilding the stale local WASM (`npm run build:contract`; town-spaces contract changes), `wallet-craft-http` times out under load and passes alone.

### 9. Exits, idle pacing, phone builder
- Stairs and passages glow softly; rats idle fast, brutes slow, sentries hold still, nests breathe; hit flashes keep priority over idle loops.
- Phone builder: inspector content scrolls inside its window instead of spilling under the Undo/Redo/Play bar (`after-builder-mobile.jpg`).
- Checks: typecheck, game 178, web 30, server 162, build pass.

### 10. Two-frame walk
- Hero walk frames (front, back, side) alternate while the character is moving (`useMoving` in art/Sprite.tsx, 280 ms after each step): town avatar, other players, room hero and dungeon hero. Creatures hop when they step. Off under reduced motion.
- Component edits: `at={position}` / `at={player}` on the existing avatar lines in Town.tsx and TownPresence.tsx.
- Checks: typecheck, game 178, web 30, server 162, build pass.

### 11. Player buildings, devices, creator kit and private offers
- Player-built shops drop the borrowed big-house windows (door, roof and owner banner read cleanly); dungeon entrances get slate walls and a glowing hall mark; the town notice board is cork. Player-building signs are smaller and violet; your own sign has a gold outline. One-line Town.tsx change: a class on the building group (`player-bldg` / `dungeon-bldg`).
- Devices: switches are levers (lit when the channel is on), doors are portcullis gates (open/closed) instead of emoji badges (one line in Run.tsx). Sprites are ready for pressure plate, key, locked door and drop hatch once those components land on main (none in packages/shared yet).
- Creator kit / trade (CSS): Library panel and blueprint text box, guide page headings, private offers framed with an "Offered to you" ribbon, stack rows and offer panels share the skin.
- Checks: typecheck, game 178, web 30, server 162, build pass.

### 12. Creator-kit cards, top bar wordmark, v13 progression art
- Guide → Components cards show the component's sprite (or item icon) next to its name, with a cost tag; Library blueprint text, clone rows and draft attribution, and the rehearsal end panel (parchment) are skinned. One small edit in ComponentReference.tsx (icon before the card title).
- Top bar: a pixel crest and gold serif "Saltwake" wordmark at the left of the HUD (crest only on phones). CSS only.
- v13: keys and locked doors draw in their pair colour (named metals and colours, other names get a stable hue); pressure plates press down and glow while their channel is on; a key ring in the board corner shows keys held. Levers/gates were already wired to switch/door devices.
- Checks: typecheck, game 181, web 30, server 163, build pass.

### 13. Crafting juice, entry ceremony, fixed-window sweep
- Crafting (CSS only): fire glow under the cauldron, bubbling brew and rising steam; the timing band glows and the marker shines; hit marks pop, misses shake; the result card scales in with a shine sweep, and fine tonics get a gold halo. The practice bench's inline-styled track gets the same skin.
- Dungeon entry: great doors swing open with "The doors open" at the start of a run; each new floor fades in from black with a floor banner (EntryCeremony in art/RunFx.tsx; off under reduced motion).
- Top bar crest is now an anchor; the wordmark hides below 900 px, because on phones it pushed Session onto a second HUD line.
- Sweep: measured page height with town, wallet, inventory, help, session, room, service and run windows open at 390×844, 768×1024, 1280×720 and 1440×900. The phone run view overflowed by 84 px (practice buttons); window content now scrolls inside its own window (run aside/inventory, drawers, idle inspector, room service), and the phone purse drawer is capped to its window. No page scroll remains in any measured state. I could not reproduce the reported 865 px wallet case in demo mode; the HUD wrap and drawer cap address the likely causes.
- Checks: typecheck, game 181, web 30, server 163, build pass.

### 14. Wallet-mode recheck, way-out cue, gate slams
- Rechecked in local wallet mode (`scripts/wallet-sandbox.ts`, server `--wallet-local`, dev test signer, player registered on the local sandbox only): at 390×844 the open wallet with the coin buy-in panel now scrolls inside its drawer; page height stays 844 (`phone-wallet-local-mode.jpg`).
- Way-out cue: my tile skin had been hiding dungeon-depth's green pulse; exit-cue tiles now pulse green above the floor art and the stairs glow green; the way-out line gets an arrow and a green rule.
- Gates (door devices) that change state get a dust burst; a slam (open to shut, as in the ambush stash) also flashes the gate and shakes the board once.
- v13 fallback shapes from depth.css are hidden wherever my key/lock/plate sprites draw.
- Checks: typecheck, game 181, web 31, server 163, build pass.

### 15. Ledgers and ambient light
- Maker results headline and the edition track record read as ruled parchment ledgers with inked numbers; notice-board "Latest" outcomes are icon chips (escaped ↑ green, died ✕ red, abandoned ↩ grey, expired ⌛ amber). One small edit in TownBoard.tsx (chips instead of a joined string).
- Ambient light follows the local clock (`html[data-daypart]`, preview with `?daypart=evening|night`): morning haze, warm evening tint with glowing windows, a cool night tint; rooms get lamplight from above and a soft vignette, stronger after dark. The dungeon is untouched so telegraphs stay exact.
- Checks: typecheck, game 181, web 31, server 163, build pass.

Checked on the demo town: notice-board outcome chips render on the pinned notes (`after-board-outcome-chips.jpg`).

### 16. Business ledger, living title card, first-visit pan
- Business ledger (Inventory → Business, town lane): ruled parchment ledger, inked totals, dotted rows, money in green and out red, entries separated (CSS only).
- Title card is now alive: stars twinkle, harbour water shimmers, windows flicker, the hero bobs, the rat scuttles and the crab sidles (CSS animations inside the title SVG; off under reduced motion). The onboarding HUD no longer repeats "Saltwake" beside the wordmark.
- First visit (once per browser, `localStorage['saltwake.harbor-seen']`): the camera starts zoomed on the harbour, pans across the square and settles on the full district in 5.5 s; signs fade in at the end. Skipped under reduced motion.
- Not on main yet: the playtest revise-edition badges/results banner and the town lane's Town history view. I will skin them when they land.
- Checks: typecheck, game 181, web 31, server 166, build pass.

### 17. Revision badges, results banner, Town history
- Revise-edition map marks: death counts are dark-red pills with a pixel skull, escapes green pills with a pixel arrow, quits grey; death cells get a red inner glow. The "Revising …" results banner is a parchment note with a red rule. (CSS; skull/escape sprites via `--sp-*`.) Checked by marking cells in the builder (`after-revision-badges.jpg`).
- Town history (notice board, after `npm run simulate -- --days 7`): a red SIMULATION stamp, then days as parchment cards on a brass timeline with dots; events fold under a dotted rule (`after-town-history.jpg`).
- Sweep of the latest merges: the coach's "What does each piece do?" link reads as a link on parchment; no other unstyled windows found.
- Checks: typecheck, game 181, web 31, server 168, build pass.

### 18. Trading and extraction juice, edition insight, gate pager
- Trading juice (`art/Juice.ts`, a MutationObserver on the HUD; no component state read or changed): when the purse goes down, coins pop out of it and it shakes; when it goes up, coins fall in and it glows; when the satchel count rises, a parcel flies from the middle of the screen into it (`juice-purchase.jpg`). Off under reduced motion.
- Extraction: "Back in the daylight." fades in with a glow and the run summary's lines reveal one by one.
- Edition insight (funnel, loot per spot, suggestions) is readable on the parchment banner and steward ledger (dark ink, ✎ for suggestions).
- Gate: the dungeon pager is a wooden signpost; "Pay N coins & enter …" is a big brass button with a stairway icon (`after-gate-pager.jpg`).
- Fixed: the gatehouse walls were flat dark (an `!important` rule in tiles.css); they show the brick texture again.
- Checks: typecheck, game 183, web 31, server 168, build pass.

### 19. Optional procedural sound; builder power tools
- `art/Sound.ts`: every sound is synthesised with the Web Audio API (oscillators, filtered noise, envelopes). No audio files, assets or services. Off by default; a speaker toggle and volume slider sit in the top bar (inserted next to Help by a DOM observer, remembered in `localStorage['saltwake.sound']`). The audio context only starts after the player turns sound on (browser gesture rules).
- Sounds: soft footsteps (town avatar, room hero, dungeon hero moving), coin clink on spend and a reversed clink on earn, a pick-up blip when the satchel grows, kettle bubbles while a brewing scene or practice track is on screen, door creak on entering a room or a gate opening, a slam for gates shutting, hit and hurt thumps, enemy death, blast boom, tide rumble three turns before flooding and while flooding, a rising chord when dungeon doors open, and a quiet harbour bed (slowly breathing filtered noise for waves, synthesised gull chirps every 6-15 s) that ducks outside the town. Under reduced motion the ambient bed stays off and only event sounds play.
- Hooks: art components emit `saltwake:sfx` events (RunFx, EntryCeremony, RoomHero, Juice); footsteps and the kettle come from DOM observation. No component edits.
- Builder power tools (playtest lane): Area & stamps panel framed with a serif legend, chosen stamp pressed brass, stamp and floor previews in the wall/floor palette; floor overview cards with hover lift, gold current, green drop target; selection tint, blinking keyboard cursor, red hatch for cut-off floor.
- Checks: typecheck, game 187, web 31, server 168, build pass. Sound verified to start without errors; audio itself needs a listener with speakers.

### 20. Economy pieces and an accessibility pass
- Commissions (town lane): posting form framed on the cork board with a serif legend; open commissions are pinned notes with a coin mark. Ledger "Restock needed" prompts are red stamps with a flag; the market's "bank is out of …" guidance is an amber notice.
- Colour-blind safe telegraphs: each threat kind now has its own hatch direction and a corner glyph as well as its colour: generic danger diagonal + "!", crossbow bolt horizontal lines + "➶", blast cross-hatch + "✸", brute sweep vertical lines + "↻"; the way-out tile gets "⇲" next to its green pulse (`gallery-colourblind-telegraphs.jpg`).
- Contrast (WCAG ratio, computed): parchment ink 10.0, muted ink 4.86, green ink 5.86, red ink 6.29, inked numbers 6.85; panel text 12.2, muted panel text 8.9, HUD small text 6.5, brass headings 11.2, primary button text 6.4, board buttons 9.3, signboard subtitles 9.0. All at or above 4.5:1.
- Focus: a 3 px light ring on every focusable control (buttons, links, inputs, selects, summaries, focusable regions), forced above the button bevels; the volume slider and signboards included.
- Phones: room fixture labels, hints, legends and ledger notes raised to readable sizes; slightly larger health pips and key chips.
- Checks: typecheck, game 187, web 31, server 168, build pass.

### 21. First-screens polish (part 1)
- Connecting / server-offline screen: centred in the window; the title art no longer gets squashed by a percentage max-height (`first-offline.jpg`). Arrival screens with no actions show a small loading tide of dots.
- Empty states are quiet notes with a small chest mark (parchment variant inside ledgers); status notices get an amber "!" badge; `role=alert` messages a red rule; busy regions dim slightly.
- The plot-tour hint over the first town view is a pinned parchment note instead of a dark box (`first-town.jpg`). First shop checked (`first-shop.jpg`).
- Checks: typecheck, game 187, web 31, server 168, build pass.

### 22. First-screens polish (part 2)
- First real dungeon run (paid entry on the local sandbox): the run aside no longer shows a "Nothing here yet." box when no enemy is in sight; the way-out line and turn text already say so (`first-run.jpg`). Builder first open was checked in earlier passes (coach, steps, area tools).
- Checks: typecheck, web 31, build pass (game/server unchanged since part 1).

Next step: price history/charts, route/Wiring lists and ⚠ Check badge when they land.
