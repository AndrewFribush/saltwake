Reviewed the four files as written. No blocking defects in the blueprint codec or the diagnostics. The concrete problems are in the FloorBuilder Library tab's state handling and in cross-file invariants.

**Medium**

- **Stale notice masks import, clone and export outcomes.** StudioStatus renders `notice||saveError||saveStatus`. The import handler and the Clone button set `saveStatus` on success but never clear `notice`. Only `edit`, the draft select, and `execute` clear it. Sequence: import a bad file (notice becomes the decode error), then import a good file. The draft switches, but the status line still shows the old error. Export success also sets `notice`, so a later clone shows "Blueprint exported" instead of "Copy created". Fix is `setNotice('')` at the start of the import handler and in the clone handler, or write import results to `notice`.

**Low to medium**

- **Import can leave `active` pointing at a draft that was never added.** The import handler guards the cap inside the updater, `setDrafts(ds=>ds.length>=20?ds:[...ds,imported])`, but then calls `setActive(imported.id)` unconditionally. If the guard ever fires, `drafts.find(d=>d.id===active)!` is undefined and `draft.floors` throws, taking the whole builder down. Today the `disabled={drafts.length>=20}` attribute makes this hard to reach, but the two statements are inconsistent with each other. Either drop the in-updater guard or decide the whole import outside the updater from a count read after the await.
- **Clone can produce a draft that cannot export or publish.** Clone sets `title:draft.title+' copy'`. A valid title at the 80-byte limit becomes 85 bytes. `isDraft` still accepts it on reload, but `normalize` and `formErrors` reject it. The user sees "Give the expedition a name of at most 80 bytes" on a draft they did not type. Truncate before appending, or skip the suffix when it would overflow.
- **Imports and clones fill a cap that cannot be emptied.** This file is the whole builder and has no delete-draft action. Twenty imports or clones permanently disable New, Clone and Import for that profile unless storage is cleared by hand.

**Low**

- **`isDraft` and `validateCustomFloor` must agree, and the diff does not show that they do.** `normalize` trusts the shared validator for floor shape. `isDraft` independently requires exactly four sockets and markers inside the 13 by 9 grid. If the shared validator is looser on either point, a saved import makes `loadDrafts` reject the entire array on the next session, since one bad draft fails the whole `every(isDraft)` check. Worth a test that round-trips an imported blueprint through `isDraft`.
- **Guide numbers are hand-copied, not derived.** `encounterRules` is exported and not imported by anything shown here. The guide text, the Encounters option labels, and the `cost` formula each restate health, damage and coin costs independently. Also the guide asserts "Random reward tables are supported by the economy". Nothing in this diff substantiates that claim in UI text.
- **Import shows "Waiting for confirmation…"** because `working` drives that string. A local file read is not a confirmation wait.
- **`issueFocus` is never cleared** on edit or draft switch. After "Show tile" on one draft, the same cell stays highlighted on another draft's floor at the same index.
- **Open boundary diagnostics are unbounded.** One issue per open boundary tile, up to 40, plus the authoritative errors, each becoming a page in the Check pager. Collapsing to one issue per floor with the first offending tile would match how the unreachable-tiles diagnostic already behaves.
- **`StudioTabs` is imported and unused** in FloorBuilder.tsx. If the web tsconfig sets `noUnusedLocals`, the typecheck fails.
- **Fixed-window fit of the Library panel is unverifiable here.** It is the only new inspector panel not routed through `Pages`. It renders a heading, two paragraphs, two buttons and a file input. Whether that fits without scrolling depends on builder-studio.css, which is not in the diff.

**Checked and found sound**

- `decodeBlueprint` enforces the byte limit before parse, requires format and version, and `normalize` rebuilds a fresh object from known fields only, so no `id`, funding, ownership or prototype keys survive import or export.
- Reward validation uses `Object.hasOwn(catalog, ...)`, which rejects missing, non-string and prototype keys.
- The `setDrafts` and `setActive` calls after the await are batched in the same continuation, so there is no intermediate render with a dangling `active`.
- The import handler is inside the disabled fieldset while `locked`, and `locked` includes `working`, so publish, edit, save and rehearsal input are all blocked during a read.
- Diagnostics BFS uses optional chaining on out-of-range coordinates, so an open boundary cannot crash it.