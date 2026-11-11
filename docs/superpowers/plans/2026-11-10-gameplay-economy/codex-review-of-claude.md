# Codex review of Claude's independent plan

Review target: `claude-plan.md`, generated from common facts/source excerpts without seeing `codex-plan.md`. This is a plan review; no implementation or playtesting is claimed.

## Priority findings

### Blocking: new actions are not isolated from admitted legacy rules

T1-1/T1-4 add global shove/escape acceptance; S3 treats promotion as mostly forwarding new action names. Preserving the old `extract` branch does not preserve the old game: a legacy paid run could use the newly accepted `escape` action to evade the old clear requirement. Add explicit experimental rules in practice, immutable new paid rules version, server compatibility tests and a publication-version validation task. Rust economic partition logic need not change, but supported rules validation may. Merely proving the same `extracted` outcome is accepted does not cover this.

### Blocking: committed charger intent after shove is unspecified and potentially wrong

T1-2 says the lane recomputes after displacement, but `resolveEnemies` uses the old lane before `revealIntents`. A shoved enemy may immediately move off its spike, or charge along absolute coordinates that no longer begin at its position. The asserted 'shove onto armed spikes applies 3 damage' is not guaranteed by current turn ordering. Pin displacement versus committed action and trap phase explicitly before implementation. Cover a surviving enemy pushed away from and into its old attack lane. Default optional stagger adds saved state and possible permanent pinning without addressing the central rule. Keep one tested experimental rule, not both behind a switch until observations justify an alternative.

### High: human feedback occurs too late

H4 waits for server/contract integration and builder exposure. The user already rejected a technically working core. Test free practice with Andrew immediately after the first readable encounter, before spending effort promoting it to the economic system. Keep later full-loop sessions after promotion. T1-5 also couples the early fixture to funded socket machinery unnecessarily: practice can use private synthetic items, later mapped to genuinely reserved items.

### High: economy play is mostly out of scope

The requested plan concerns both dungeon and economy loops. A shop stop and a hypothetical maker question do not exercise producing a batch, stocking a shop, buying maker funding, receiving fees, disposing of leftovers, recovering after loss or changing a business decision. Add an actual artisan→maker/adventurer→dungeon→return circuit using existing listings; a dedicated artisan/merchant observation; cost provenance before profit claims; finite-budget/no-new-user stress; and a maker revision session. Defer new recipes and buy orders, not the observation of existing economy gameplay.

### High: unsafe reset and insufficient reproducibility specification

H4-1 says 'sandbox reset'. That must mean a separate disposable test world, never deleting/reinitializing Andrew's current `.state`. Test grants must be explicit, not evidence of earned funds. V6-4 'clean checkout' would omit the substantial uncommitted work this task inherits. Use a task-scoped clean worktree only after the intended snapshot is recorded/committed, or a documented patch manifest applied under repo-local allowed isolation; never imply a clean checkout reproduces absent dirty files. No pushes, deployment, testnet or broad git clean.

### Medium: scripted attempts and score threshold can manufacture acceptance

Requiring three runs, then asking whether the player wanted another, mixes obligation with desire. Keep a neutral opportunity to stop after the first run and distinguish a voluntarily chosen attempt from an assigned learning trial. Four people's median ≥4 is not proof of fun; use it as descriptive evidence alongside observed choices, exact comments and Andrew's judgment. A player declining the optional cache can reflect good risk judgment, not a failed design. Use multiple situations rather than mandatory cache-taking as a pass condition.

### Medium: defaults and filenames require correction

Post-review source check confirms `apps/web/src/tileset.tsx` and `tileset.css` exist; the initial concern about that path is withdrawn. Use them only if the actual `Run.tsx` rendering change requires it. Rust rules checks are in `contracts/economy/src/editions.rs` as well as related modules; no pretend `settlement.rs` path. A new `escape` verb and an existing `extract` verb create avoidable UI/API branching: keep one versioned extract action in the merged plan. The terminal economic status stays extracted. Expanded trace support must capture events before the engine truncates its log; don't assume raising the server's slice limit recovers events already removed.

## Keep from Claude

- Explicit invariant-to-test mapping and concurrent-capacity reuse proof.
- Invalid actions return the same state object and spend no turn.
- Concrete optional-detour reachability and two deterministic successful routes.
- Full baseline failure recording when needed; task results are evidence, not verbal completion.
- Test zero-loot extraction in the transparency record as well as death-as-zero.
- A concise session script, anonymous participant notes and separation of automated checks from human readability.
- Single owner per implementation area, reviewer is the other model, no unreviewed shared-file edits.

## Adjust in my own draft

My P03 cooldown/default interaction is only a proposal and should not pretend to solve every charger displacement case. Add an explicit truth table and red tests before choosing implementation. Make the economic cost-lineage task a specification plus separate bounded implementation slices, not one 30–120 minute promise. Separate trace capture from visual feedback. Add exact restart/receipt tests for zero-loot extraction and unchanged concurrency. Replace implied universal iteration limits with a two-round default followed by a design review; continued refinement requires a reason, not mechanical abandonment.

## Merge recommendation

Use Codex's practice-first, then funded-loop, then economic-refinement dependency order. Incorporate Claude's invariant map, optional-route fixtures, narrow test cases and structured session kit. Preserve user-fixed rules. No unsupported approval ceremony on already-established rules. Explicit human judgment gates are legitimate evidence requirements, not repeated permission to write local code.
