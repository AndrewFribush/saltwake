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

Next step: stairs/exit glow, enemy idle variety; review the mobile builder.
