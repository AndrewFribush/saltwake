# Dungeon economy — first playable

Local practice prototype of the dungeon game. Free, no wallet, no real assets. Currently one room and one telegraphed melee enemy. The economy and NEAR contract are not implemented yet.

Requires Node 22 (verified 22.23.1), npm 10 (verified 10.9.8).

```sh
npm ci
npm run dev -- --port 18930 --strictPort
```

Open http://127.0.0.1:18930. Click adjacent tiles, or focus the board and use arrows/WASD. Move into an adjacent rat to attack. G guards, space waits. The outlined ! tile is the enemy's committed target. You can dodge it. Restart resets practice.

```sh
npm test
npm run typecheck
npm run build
```

`npm test` currently runs game tests only. Contract, server and E2E commands deliberately fail until those suites exist. No external deployments or transactions have occurred.

[Build checklist](../design/dungeon-economy/CHECKLIST.md) · [Progress/evidence](docs/progress.md)
