# Saltwake UI polish · 10 November 2026

Local preview: http://127.0.0.1:18930

## Design and implementation

Keep the permanent map and inspector windows. Use ink (#101f22), panel green (#192c2d), parchment (#f0e5cb), muted text (#b9c5bd), brass (#dfbd76), and risk rust (#efaa88). Georgia location headings sit alongside system-font controls and tabular money amounts. Primary actions, checked goods, navigation and disabled controls have distinct treatments. No font downloads or external assets.

- Unified panel borders, heading hierarchy, form controls, focus indicators, stock rows and pagination; preserve geometry in `fixed-windows.css`.
- Supply selection shows count, exact total and insufficient-balance guidance. Purchase handlers, quote matching, item IDs, pending-operation guards and amounts are unchanged.
- Remove the redundant station selector when a counter has only one station. Preserve mounted panel state across switches.
- Use the reserved status strip for navigation hints when no action/error message is present. New messages reset reading pagination.
- Explain empty journals and idle room controls in player-facing terms.
- Purse, belongings and session overlays make the covered world inert, contain keyboard focus, close with Escape and restore focus. Interior direction controls have descriptive accessible names.
- Keep the room fully visible while movement is disabled at a counter. Respect reduced motion.

## Verification

- Typecheck and Vite build passed.
- Game tests: 57 passed, 0 failed.
- `git diff --check` passed.
- 30 fixed-window comparisons passed at 1366×768 and 390×844; largest difference 0.0078125 CSS px (rounding).
- 56 whole-game view checks: viewport-sized document, no off-screen tested controls; captured window errors `[]`.
- Eight additional shop checks cover Supplies, Traders, Sell / list and NPC order at both sizes; no off-screen controls.
- Selecting a supply produced “1 selected · 2 coins total” and enabled checkout. No purchase submitted. Selection survived opening/closing purse.
- Browser checks confirmed covered world inert, Escape dismissal, restoration, and focus containment on Shift+Tab.
- Desktop and phone captures visually inspected. Browser overlay visible in captures belongs to Aside.

Evidence: [whole game](evidence/ui-polish/whole-game.txt), [window invariance](evidence/ui-polish/invariance.txt), [shop and focus](evidence/ui-polish/shop.txt), [overlay checks](evidence/ui-polish/capture.txt), [desktop shop](evidence/ui-polish/polish-shop.jpg), [phone shop](evidence/ui-polish/polish-shop-phone.jpg).

## Limits and follow-up

This is a UI polish pass, not proof of subjective perfection or a full accessibility certification. Very short phones, high browser zoom, and long translated strings have not been certified. The existing compact phone builder still uses small map cells. Art remains prototype tile art. Local synthetic economy only; no production changes, paid calls, testnet transactions or financial-handler changes.

Verification learning: wait for the destination fixture to become visible instead of assuming a fixed walking delay. Avoid editing the application during browser walkthroughs: Vite reload invalidates the current browser context. The final full walkthrough ran successfully after both corrections.
