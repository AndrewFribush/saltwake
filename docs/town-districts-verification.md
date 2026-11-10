# Connected town districts

Nine bounded districts now connect at their cardinal map edges. Keyboard movement and click-to-walk enter the adjoining district at the corresponding opposite edge. Movement-triggered transitions avoid immediate bounce-back; clicking the return direction from the arrival edge also works. Routes avoid unrelated doors and boundaries. Water requires the central dock crossing; outer town edges are visibly closed. District buildings access the same existing services, stock and saved interiors, not newly minted economies.

Verified: 57 game tests, typecheck, web build and whitespace check. Tests cover every adjacent district pair, return movement, service reachability from arrivals, water, outer boundaries and doors. Aside browser confirmed east crossing, immediate west return, click-to-walk north and immediate return, entering/leaving a neighboring house without losing the district, and mobile width390/viewport390.

Evidence: [browser](evidence/districts/browser.txt), [tests](evidence/districts/game-tests.txt), [mobile](evidence/districts/mobile.jpg).

This is a finite 3×3 town. District layouts are basic and reuse existing services. Town navigation remains client presentation state; a page reload starts in Harbor Square. No economy, server or contract changes were needed.
