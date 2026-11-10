# Dungeon economy — playable practice

Two local dungeon rooms: telegraphed rat attacks, a charging boar, alternating spikes, found equipment and potions, six-slot backpack, extraction and death reports. All goods are practice fixtures; no admission fees, wallets or transferable rewards. Refresh resets the session.

Requires Node 22.23.1/npm10.9.8 (verified). Contract development additionally uses Rust1.93.0, pinned in rust-toolchain.toml.

```sh
npm ci
npm run dev -- --port 18930 --strictPort
```

Open http://127.0.0.1:18930. Click adjacent tiles, or focus the board and use arrows/WASD. Moving into an enemy attacks it. G guards; space waits. Stripes mark committed enemy danger, ▲ armed spikes, △ safe spikes. Charges stop at the first creature. Spikes hurt enemies too.

Loot appears as ◆. Stand on it to pick up, equip, or drink. Each valid action takes a turn. Found gear retains its dungeon origin. With enemies cleared, reach E to extract or enter the next room. The report previews exact item destinations; it does not execute financial transactions. Restart with armor allows a loadout comparison.

```sh
npm test
npm run typecheck
npm run build
```

`npm test` runs the game suite. Server/E2E suites are not implemented and their commands fail explicitly. Browser evidence was captured with Aside and is saved in docs. Contract smoke instructions/results are in docs/toolchain.md when available; it is separate from the browser, not a working economic backend.

[Build checklist](../design/dungeon-economy/CHECKLIST.md) · [Progress/evidence](docs/progress.md) · [Gameplay observations](docs/play-observations.md)
