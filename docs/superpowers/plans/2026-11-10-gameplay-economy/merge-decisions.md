# Cross-review and merge decisions

## Completed process

1. Codex wrote `codex-plan.md` while Claude independently wrote `claude-plan.md` from the common brief and selected code. Claude did not see the new Codex plan during its independent pass.
2. Codex reviewed Claude in `codex-review-of-claude.md`.
3. Claude reviewed Codex and revisited its own plan in `claude-review-of-codex.md`. Both CLI calls returned successful results; exact inputs, raw JSON responses and stderr are preserved.
4. Codex synthesized `MERGED-PLAN.md`, then checked source paths, dependencies, scope and the human gates. This is a document merge, not a Git branch merge, source implementation, playtest or deployment. Claude has not separately reviewed the final merged text.

## Decisions

| Issue | Final resolution | Source |
|---|---|---|
| Test fun before economic integration | Free practice → Andrew/optional external observations → refinement → versioned funded path | Codex, accepted by Claude |
| Focus of first content | One authored encounter; variants only for a recorded hypothesis | Claude |
| Maker/economy scope | Actual artisan/maker/adventurer circuit, artisan observation, qualified accounting and low-population scenarios | Codex; Claude accepted circuit, proposed narrower remaining scope |
| New actions in old runs | One versioned extract action; legacy state defaults to legacy rules; no globally available escape bypass | Both reviews |
| Shove interaction | Truth table and failing tests before code; no silent retarget; no assumed immediate spike damage; cooldown/stagger off initially | Both reviews with Codex source correction |
| Simultaneous capacity | Four active runs reject fifth, settled run frees capacity, later admission succeeds | Claude |
| Transparency | Zero-loot extraction and failed attempts both included correctly; old timing gaps, void/active exclusion, fee/refresh history disclosed | Both |
| Cost accounting | Three bounded cards: schema, projection, qualified display. Required before profit claims, independent of initial fun gate | Codex, refined after scope critique |
| Replay/journal | Bounded diagnostic trace; reuse existing journal, no new replay editor/window | Both |
| Discovery | Retain current matcher unless evidence identifies a problem; filtered rotation is a proposed experiment, not automatic feature | Claude critique |
| Human acceptance | Neutral stop/repeat choice, exact comments and observed behavior; no median-score certification or fabricated participants | Codex critique |
| Refinement | One main variable, two unsuccessful rounds then design review with a specific new hypothesis | Both |
| Fixed phone layout | Preserve already-verified desktop and phone sizes, do not redesign or claim universal support | Codex; rejects Claude's claim this needs new approval |
| Sandbox use | Disposable isolated test state, explicit grants; no reset of Andrew's state | Codex critique |
| Source reproduction | Revision + dirty patch manifest or task-scoped local commit/worktree; clean checkout alone omits current work | Codex critique |
| Paid floor count | Rust currently enforces 2–4 floors; one-floor practice promotes into valid two-floor edition and gets a full-run human test | Codex source audit |

## Corrections to review claims

Claude called the review-decisions spec reference unverified because it had not been supplied to Claude. Codex had read it directly; it exists and contains the user's transparency decision. We keep that source reference.

Codex initially questioned the `tileset.tsx` path; filesystem verification confirmed both it and `tileset.css` exist. That objection is withdrawn in Codex's review.

Claude's statement that fizzled displaced intents match current behavior is not a correctness proof: current chargers iterate committed absolute lanes before revealing new intents. The rule table and displacement tests remain mandatory.

Claude recommended asking Andrew to reconfirm each invariant and separately approve many local planning items. The user already established the invariants and asked for a thorough merged plan. We retain human gameplay judgment gates and external-action boundaries, not repeated permission for established rules or routine local verification.

## Scope and limits

This plan covers the whole requested gameplay/economy improvement path, but does not prescribe building every possible feature. New recipes, buy orders, fuel, additional enemy families, social systems and large-scale simulation tooling remain evidence-driven future choices. Two model reviews are not evidence that a game is fun or an economy sustainable. No deadline promise and no completed gameplay gate is claimed.
