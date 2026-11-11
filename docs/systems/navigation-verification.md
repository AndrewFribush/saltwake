> SUPERSEDED IN PART: Andrew rejected the activity directory and counter-navigation lists. Both were removed immediately. Their earlier successful browser tests do not establish product acceptance. Explicit Inventory/Wallet/Help labels and service section buttons remain.

# Visible navigation — 2026-11-10

Problem: inventory was hidden behind the character name; wallet behind a coin total; service sections behind a dropdown. Town and house idle panels described actions without offering them.

Changes: persistent labeled Inventory, Wallet and Help buttons; Where to? activity directory in the existing town inspector; interior service choices; visible service-section buttons. Destination and counter buttons use existing pathfinding/door entry, not teleportation. The town directory follows the current district's available buildings. Help explains movement, services, menus and expedition risks. Escape dismisses Help and restores focus. Offline inventory/wallet controls are disabled until world data arrives.

Validation in Aside:
- Inventory, Journal, Wallet and Help opened and closed.
- Town map bounding rectangle unchanged after opening/closing panels.
- Walked to all five buildings through the activity list, then to each service through the house inspector.
- Guild section switching and builder opening worked.
- 1366×768 and 390×844: no document overflow or offscreen navigation/service controls in tested initial service states.
- Escape dismissed Help; focus returned to Help; no captured window errors.
- TypeScript, Vite asset build and diff whitespace check passed.

Evidence: `../evidence/navigation/browser.txt`, `services.txt`, corresponding runnable scripts, `typecheck.txt`, `build.txt`. A screenshot attempt could not be retrieved from Aside's reported session directory; no screenshot-based visual sign-off is claimed. Browser layout and interaction checks passed. No human discoverability acceptance is claimed.

No purchases, publication, paid runs, profile changes or saved-draft changes were made by these navigation checks.
