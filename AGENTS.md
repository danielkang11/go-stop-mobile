# Repository Instructions

These instructions apply to the entire repository unless a more specific nested
`AGENTS.md` overrides them.

Last updated: 2026-08-12

## Read before changing code

1. Read `docs/PROJECT_CONTEXT.md` for current scope, status, decisions, and known
   gaps.
2. Read `README.md` for supported modes and development commands.
3. For rules, scoring, chips, settlement, or deck behavior, read:
   - `IMPLEMENTATION_PLAN.md` for the researched `mvp-1` baseline.
   - `docs/JOKER_RULES.md` for the `mvp-2` service-card profile.
4. For card or visual work, also read `docs/ASSET_MANIFEST.md` and `design-qa.md`.

`IMPLEMENTATION_PLAN.md` is historical where it excludes jokers. The current
implementation is `mvp-2`; `docs/JOKER_RULES.md`, current source, and tests
supersede that V1 assumption. If requirements, docs, and code disagree, identify
the discrepancy instead of silently selecting a new rule.

At the start of a task, inspect `git status --short`, recent relevant history,
and the code in scope. Proceed without waiting for a repository summary to be
approved unless a meaningful ambiguity requires the project owner's decision.

## Operating behavior

- Use scoped autonomy: complete a clear request, including necessary
  integration, focused tests, and material documentation, without pausing for
  routine implementation choices.
- Ask before making an ambiguous product decision, changing frozen game
  semantics, expanding scope materially, performing a destructive action, or
  changing an external system.
- Avoid unrelated cleanup and speculative refactors. Mention valuable adjacent
  work as a follow-up instead of silently adding it.
- For a large feature or task, enter Plan mode before editing and agree on the
  implementation plan first. Treat work as large when it introduces a new game
  mode or rules profile, changes architecture or persistent schemas, spans
  three or more packages, requires deployment, or contains multiple milestones
  with meaningful product tradeoffs.
- When Plan mode is not available, inspect the repository and present an
  explicit implementation plan before making changes to a large feature.
- Use sub-agents selectively for independent research, audits, or test work
  that can run in parallel. Give agents non-overlapping ownership; the primary
  agent remains responsible for integration and final verification.

## Toolchain and commands

Use Node `24.14.0` from `.node-version` and pnpm `11.16.0`. Do not create npm or
Yarn lockfiles.

```sh
pnpm install
pnpm dev:mobile
pnpm --filter @gostop/mobile web
pnpm dev:relay
pnpm check
pnpm test:simulation
pnpm verify
```

- `pnpm check` runs strict TypeScript checks and focused tests across all
  workspaces.
- `pnpm test:simulation` runs the separate 10,000-deal deterministic
  conservation and replay gate.
- `pnpm verify` runs both and is the full local gate.
- Preserve `strict`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess`.

## Dependencies and local storage

- Be storage-conscious. Do not install dependencies for documentation-only,
  planning, or read-only work.
- When validation requires dependencies, use the pinned Node and pnpm versions
  and preserve `pnpm-lock.yaml`. Do not alternate between x64 and arm64 Node
  runtimes within one installation.
- The root dependency tree and Expo outputs can consume roughly 1 GB. State the
  storage impact before restoring them when that impact is relevant to the
  task.
- Never delete dependencies, caches, or generated bundles without explicit
  authorization. Resolve and report exact targets first; preserve all source,
  tracked assets, tests, and Git history.

## Package boundaries

- `packages/game-core` is the only authority for card rules, legal actions,
  scoring, settlement, chips, projections, and state transitions. Keep it
  framework-free and deterministic. Inject RNG and time; do not use
  `Math.random`, global clocks, React, Expo, network, or filesystem APIs in the
  engine.
- `packages/game-ai` may choose only among legal actions from a projected
  `PlayerView`. It must never inspect opponents' hands or stock order.
- `packages/protocol` owns versioned wire messages, runtime validation, limits,
  and error codes.
- `apps/relay` owns authoritative online-room coordination. Broadcast only
  per-seat projections and projected public events. Relay room revision is the
  wire revision; do not replace it with the engine's reduction count.
- `apps/mobile` owns presentation and controllers. Keep rules out of components
  and UI adapters. Local and remote play must remain behind the shared
  `GameController` interface.

## Non-negotiable invariants

Preserve the engine contracts and the checks encoded in
`packages/game-core/src/invariants.ts`:

- There are exactly three seats and 150 total chips across wallets plus the pot.
- Pot contribution totals equal the pot.
- All 50 `mvp-2` cards exist in exactly one authoritative zone during a round.
- The two bonus cards are monthless, count as two pi, and never enter table
  month groups.
- Locked `뻑` groups contain exactly three cards; loose groups contain at most
  two.
- A pending choice belongs to the current player.
- A rejected command changes neither state nor revision.
- Equal initial state, command log, and injected RNG stream replay identically.
- Player projections expose only the viewer's hand and never stock order or
  another hand.

Use `getLegalActions` and `reduceSession`; do not mutate authoritative state
directly.

## Rules and protocol versioning

Do not silently change the frozen `mvp-2` profile. A gameplay-semantic or
replay-incompatible change requires an explicit new rules version,
documentation, deterministic fixtures, and compatibility handling.

When a rules version changes, audit the coordinated literals and types in:

- `packages/game-core/src/model.ts`
- `packages/game-core/src/engine.ts`
- `packages/protocol/src/version.ts`
- `packages/protocol/src/messages.ts`
- `packages/protocol/src/schemas.ts`
- `apps/mobile/src/controllers/RemoteGameController.ts`

Protocol-envelope compatibility is separate from rules compatibility. Change
`PROTOCOL_VERSION` only for an intentional wire change, and update protocol,
relay, mobile, and tests together. Never infer an `mvp-2` 50-card state from an
`mvp-1` replay.

## Testing expectations

- While iterating, run the affected package's tests and typecheck.
- Before handing off a code change, run `pnpm check`.
- For engine, cards, scoring, settlement, RNG, or rules changes, add
  deterministic focused tests and run `pnpm test:simulation`.
- For protocol or relay changes, test malformed input, stale revisions,
  idempotent retries, and per-seat projection privacy.
- For mobile/controller changes, add focused Jest tests where practical and
  manually exercise the browser build.
- For layout, animation, or card-face changes, inspect portrait, compact
  landscape, and desktop landscape; check reduced-motion behavior and browser
  console output.
- Documentation-only edits do not require reinstalling dependencies or running
  the full suite, but verify links, commands, and current source claims.

## Card assets and visual evidence

Canonical card IDs originate in `packages/game-core/src/cards.ts` and must remain
aligned with:

- `apps/mobile/src/game/cardAssets.ts`
- `apps/mobile/assets/cards/faces/`
- `docs/ASSET_MANIFEST.md`

The traditional reference, generated source assets, contact sheet, and committed
QA screenshots are intentional project evidence, not disposable build output.
Use `scripts/extract-hwatu-assets.py` only when deliberately regenerating the
tracked face set.

Animations must consume authoritative events and must never control or delay
game-state application. Preserve reduced-motion behavior, month badges, readable
card labels, and the grouped captured-card spreads.

## Privacy and product safety

- Never expose an opponent hand, stock order, shuffle seed, or resume token in a
  client projection, event payload, log, error, or accessibility label.
- Never give AI authoritative hidden state.
- Keep pass-and-play hands out of the view and accessibility tree behind the
  handoff curtain.
- Treat chips as session-only counters with no purchase, redemption, transfer,
  cash value, or real-money implication.
- Never commit `.env`, `.dev.vars`, secrets, tokens, or production credentials.
- Do not claim online play, a hosted preview, or a store build is deployed
  unless it has been verified independently of repository source.

## Git and workspace safety

- Inspect `git status --short` before editing and preserve unrelated user
  changes.
- Treat `main` as the published stable branch. Use `codex/<short-topic>` for
  meaningful new work unless the user requests another branch.
- Keep concurrent work in separate branches or worktrees and avoid overlapping
  file ownership.
- Do not stage, commit, push, or open a pull request unless the user explicitly
  asks. Leave a coherent, reviewable working-tree diff and report its status.
- Do not force-push, rewrite history, deploy the relay, publish builds, or push
  directly to `main` without explicit authorization.
- Never run destructive cleanup on an unresolved path or a dirty worktree.
- Do not commit dependencies, caches, build output, logs, `.env`, `.dev.vars`,
  `.expo`, `.pnpm-store`, `dist*`, or `node_modules`.

## Persistent project memory

This is the project's compact, append-only memory for decisions and mistakes
that future Codex tasks must not repeat. Read it before changing code.

- Add an entry only when a verified decision or mistake has lasting impact on
  product behavior, architecture, compatibility, privacy, validation, or
  workflow.
- Record the date, kind, what happened, and the permanent instruction.
- Do not use this as a routine progress diary or store secrets, credentials,
  personal data, guesses, or transient debugging details.
- Do not erase or rewrite an earlier entry merely because it became obsolete.
  Add a superseding entry that names the earlier decision and update
  `docs/PROJECT_CONTEXT.md` when the current project state changes.

| Date | Kind | What must be remembered | Permanent instruction |
| --- | --- | --- | --- |
| 2026-08-11 | Decision | `packages/game-core` is the single authority for rules, legal actions, scoring, settlement, chip transfers, and projections. | Never duplicate game semantics in mobile, AI, protocol, or relay code; all modes submit commands to the shared reducer. |
| 2026-08-11 | Decision | The ante pot is based on the documented optional “Catching the Boar” variation, made mandatory for this product. It is not a universal base Go-Stop rule. | Label it the **Boar Pot house rule** and keep its award separate from loser-to-winner point settlement. |
| 2026-08-12 | Decision | The current profile is `mvp-2`: 48 traditional month cards plus two monthless two-pi service cards. They are bonus cards, not wildcards. | Treat the joker exclusion in `IMPLEMENTATION_PLAN.md` as historical V1 text and follow `docs/JOKER_RULES.md`, source, and tests. |
| 2026-08-12 | Decision | Moving from `mvp-1` to `mvp-2` changed deck and replay semantics while the wire envelope remained protocol version 1. | Coordinate any rules-version change across core, protocol, relay, mobile negotiation, documentation, fixtures, and replay compatibility; do not bump the wire protocol unless its shape or semantics require it. |
| 2026-08-12 | Mistake | The remote mobile controller originally discarded relay `snapshot.events`, which prevented authoritative V2 motion from reaching the UI. | Preserve ordered projected events end-to-end—especially `cards-played`, `stock-flipped`, bonus replacement, and bonus capture events—and keep animations downstream of state. |
| 2026-08-12 | Mistake | Running pnpm under mismatched x64 and arm64 Node environments caused dependency recreation and native Rollup-package failures. | Use the pinned Node 24.14 runtime consistently, verify architecture before installation, and never start a competing install while another task is using the shared dependency tree. |
| 2026-08-12 | Mistake | Stale conflict-style copies such as files ending in ` 2.tsx` and ` 2.md` existed before the initial GitHub import. | Before staging, inspect suspicious duplicate filenames and compare them with the canonical file; never publish stale conflict copies blindly. |
| 2026-08-12 | Decision | Dependencies, caches, and generated Expo bundles were removed after validation to reduce local storage from roughly 1 GB to 37 MB. | Do not reinstall them unless the task needs execution, and never clean them again without explicit approval and exact target verification. |
| 2026-08-12 | Decision | Online-room code exists, but a live relay and hosted browser preview have not been established by repository evidence. | Never claim either service is deployed until its URL and behavior are independently verified; local and AI modes remain the reliable offline paths. |

Update `docs/PROJECT_CONTEXT.md` whenever product scope, architecture, rules
version, deployment status, validation procedure, or known limitations
materially change.
