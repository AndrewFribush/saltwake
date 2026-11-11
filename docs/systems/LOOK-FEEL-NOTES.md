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

Next step: town tiles and avatar movement/facing, interiors (floor/wall textures, furniture sprites), then the UI skin (windows, buttons, purse, chat, typography) and a mobile pass.
