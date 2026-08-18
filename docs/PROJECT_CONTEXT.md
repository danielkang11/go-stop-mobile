# Go-Stop Mobile Project Context

Last updated: 2026-08-12

This file is the durable handoff for the Go-Stop Mobile project. It captures the
product intent, decisions, implemented state, known gaps, and verification
expectations that would otherwise live only in a long Codex conversation.

## Project snapshot

- **Product name:** Go Stop Together
- **Repository:** `https://github.com/danielkang11/go-stop-mobile` (private)
- **Stable branch:** `main`
- **Application/package version:** `0.2.0`
- **Current rules profile:** `mvp-2`
- **Wire protocol envelope:** version `1`
- **Targets:** iOS, Android, and browser-based development/testing through Expo
- **Player count:** exactly three

The published baseline before this context document was commit `e7e92d8`.

The initial logical history is intentionally split into four reviewable commits:

- `564bfe2` — researched architecture and MVP plan.
- `25cce3a` — deterministic core, AI, protocol, and relay services.
- `badf418` — Expo mobile application and V2 card presentation.
- `e7e92d8` — responsive browser and motion QA evidence.

## How to establish truth

When project sources disagree, use this order:

1. Current source code and tests.
2. `docs/JOKER_RULES.md` for the V2 two-pi service-card profile.
3. `README.md` and `design-qa.md` for current product and UI status.
4. `IMPLEMENTATION_PLAN.md` for the researched V1 rules and architecture
   baseline.

`IMPLEMENTATION_PLAN.md` was written before implementation and intentionally
freezes an `mvp-1` 48-card profile with no jokers. The project subsequently
moved to `mvp-2`, which has 50 cards. Its architecture, base rules, and economy
research remain useful, but its statements excluding bonus cards and referring
to `mvp-1` are historical. Do not use them to overwrite the V2 behavior.

If requirements, documentation, tests, and implementation disagree, call out
the discrepancy and resolve it deliberately. Do not silently invent a house
rule.

## Product intent

Build a polished, approachable three-player Korean Go-Stop (`고스톱`) game that
can be played on one device, against computer opponents, or with invited guests
on separate devices.

The requested poker-like element is a closed-session play-chip economy:

- Each seat starts a new session with 50 chips, for 150 chips total.
- Every playable deal requires a one-chip ante from each seat.
- Losers pay the winner according to the deal's payable Go-Stop score.
- A player can continue only while able to ante the next deal.
- A player who cannot cover a loss pays only the chips still in their wallet.
- Chips never go negative, and unpaid shortfall does not become debt.

These are non-purchasable, non-transferable, non-redeemable counters with no
cash value. The product must not imply gambling prizes, cash-out, or real-money
ownership.

## Scope and implemented modes

The MVP implements these three modes behind the same game-controller boundary:

1. **Local pass-and-play:** three humans share one device. An opaque handoff
   curtain hides the next player's hand until a deliberate hold-to-reveal.
2. **Human versus AI:** one human plays seats 1 and 2 against two computer
   opponents. Easy chooses a seeded random legal action; Standard uses a
   visible-state heuristic.
3. **Online guest room:** three guests join an invite-only room using an
   eight-character code. A Cloudflare Worker and one SQLite-backed Durable
   Object per room hold the authoritative ephemeral state.

Online code is implemented, but no deployed relay or hosted web preview is
configured in the repository. Local and AI play work without a relay.

The following remain deliberately out of scope:

- Accounts, friends, matchmaking, rankings, or player profiles.
- Persistent balances, cross-session chip ownership, or cloud saves.
- Rebuys, purchases, cash-out, prizes, ads, or monetization.
- Chat, spectators, moderation, tournaments, and long-term game history.
- Two-player Matgo or other player counts.

## Frozen `mvp-2` rules profile

There is no single universal Go-Stop rulebook. Household and platform variants
differ, so this project freezes a deterministic profile and discloses its house
rules.

### Deck and deal

- The deck has 50 unique cards: 48 traditional cards across January through
  December plus `bonus-2pi-a` and `bonus-2pi-b`.
- Each player receives seven cards. Six ordinary month cards are face-up on the
  table; the remaining cards form the stock.
- Cards capture by matching month, never by scoring category.
- Dealer acts first. The deal winner becomes the next dealer; the dealer remains
  after `나가리`.
- Four same-month cards initially on the table cause an administrative redeal
  without another ante. Three begin as a locked `뻑` group.
- A single `총통` holder wins immediately with a three-point Stop result;
  multiple holders cause an administrative redeal.

### Base scoring

Implemented scoring includes:

- Brights (`광`), including the rain-bright distinction.
- Animals (`열끗`) and `고도리`.
- Ribbons (`띠`) plus `홍단`, `청단`, and `초단`.
- Pi (`피`), including double-pi cards.
- The September cup, dynamically allocated as an animal or two pi according to
  the engine's scoring and liability tie-break rules.

A player first receives a Go/Stop choice upon reaching at least three base
points. After choosing Go, the base score must improve before another Go/Stop
choice is offered.

### Capture and multiplier rules

The engine implements `쪽`, `따닥`, `쓸`, `뻑`, `자뻑`, `폭탄`, `흔들기`,
pi surrender, `나가리`, `광박`, `피박`, `고박`, and `멍따`.

The common liability for a point winner is:

```text
(baseScore + goCount) * 2^exponent

exponent =
  max(0, goCount - 2)
  + declaredShakeCount
  + completedBombCount
  + (effectiveAnimals >= 7 ? 1 : 0)
  + min(nagariStreakEnteringDeal, 3)
```

Each losing slot then applies its own `광박` and `피박` multipliers. `고박` can
reassign both losing slots to the earliest losing player who previously called
Go. Every actual transfer is capped by that payer's current wallet.

### Two-pi service cards

The two monthless service cards are bonus cards, not unrestricted wildcards:

- Each counts as two effective pi.
- They cannot match a table card, form a month set, form `총통`, or attach to a
  `뻑`.
- A face-up service card in the initial layout goes immediately to the dealer;
  replacements are revealed until six ordinary table cards are present.
- A service card played from hand is captured immediately. Stock replacements
  are drawn until an ordinary card appears; that ordinary card resolves as the
  hand play, followed by the turn's normal stock flip.
- A service card revealed from stock is captured immediately and replaced for
  that same flip. Chained service cards are supported.
- Capturing one does not itself steal an opponent's pi.
- If no ordinary pi is available for surrender, a service card may transfer and
  satisfies the request with its full two-pi value.

The complete evidence and edge cases are in `docs/JOKER_RULES.md`.

## Chip economy and Boar Pot

The ante pot uses the documented optional “Catching the Boar” variation and is
mandatory for this product:

1. Before a playable deal, one chip is atomically collected from every seat.
2. The first player to capture the July boar animal immediately receives the
   entire pot, even if another player later wins the deal.
3. A boar award remains valid if the deal ends in `나가리`.
4. If the boar is not captured, the pot carries into the next deal and receives
   the next three antes.
5. If the session ends with an unclaimed pot, each seat is refunded its recorded
   contributions.
6. Boar-pot settlement happens before capped point payments, so a losing boar
   capturer may use those awarded chips to cover the later loss.

The engine asserts that wallets plus pot always equal 150 and that the recorded
pot contributions always equal the pot.

## V2 visual and interaction direction

V2 replaced placeholder card graphics with traditional Hwatu faces derived
from the project owner's supplied reference image.

- All 48 traditional faces are tracked as raster assets.
- Month-number badges remain app-owned overlays for small-screen legibility.
- The two `쌍피` service cards and card back use matching vermilion, black, and
  warm-ivory art direction.
- The stock is centered in the table field.
- Face-up table cards use deterministic irregular placement around the stock,
  rather than a grid.
- Played cards animate from the acting seat toward the table.
- Stock cards animate from the center deck with a flip reveal.
- Reduced-motion mode bypasses decorative movement without changing state.
- Captured physical cards remain visible for all players, grouped into Gwang,
  Animal, Tti, and Pi spreads with effective totals.
- Layouts were checked in portrait, compact landscape, and desktop landscape.
- Long-press card previews and descriptive accessibility labels are present.

Asset provenance is recorded in `docs/ASSET_MANIFEST.md`. The V2 browser review,
screenshots, and resolved findings are recorded in `design-qa.md`.

## Architecture

This is a strict-TypeScript pnpm monorepo:

| Area | Responsibility |
| --- | --- |
| `packages/game-core` | Framework-free deterministic reducer, 50-card catalog, legal actions, scoring, settlement, invariants, projections, and seeded RNG. |
| `packages/game-ai` | Easy and Standard policies that choose only among legal actions exposed in a projected player view. |
| `packages/protocol` | Protocol-v1 message types, Zod runtime validation, frame limits, errors, and the supported rules-version declaration. |
| `apps/mobile` | Expo SDK 57 application, Expo Router screens, presentation, local controller, remote controller, settings, and card assets. |
| `apps/relay` | Cloudflare Worker and Durable Object room authority, invite codes, readiness, persistence, reconnection, timeouts, projection broadcasts, and expiry. |

### Core boundary

`packages/game-core` is the sole authority for game semantics. Mobile screens,
controllers, AI, and relay code may submit commands and render projections, but
must not independently calculate captures, scores, legal moves, chip transfers,
or winners.

The engine follows a command/reducer/event model:

- `createSession` creates the authoritative state with injected randomness.
- `getLegalActions` enumerates commands available to a seat.
- `reduceSession` validates and applies one command without mutating its input.
- `projectPlayerView` creates a seat-specific view with only that seat's hand.
- `projectEventsForSeat` prepares public events for transport and animation.

Randomness and time are injected so an identical initial state, dependency
stream, and command log replay identically.

### Mobile controller boundary

Local, AI, and remote play implement the shared `GameController` interface.
Animations consume reducer/relay events and never determine state. Skipping an
animation must land on the same projected game view.

Current local and AI sessions live in React memory and are lost on refresh or
process death. Only app settings persist in AsyncStorage. Online resume tokens
are stored in SecureStore, while remote authoritative state remains in the
ephemeral relay. The optional AI recovery proposed in the historical plan was
not implemented.

### Online authority and privacy

The relay uses one SQLite-backed Durable Object per room and supports:

- Eight-character normalized room codes.
- Three ready seats before game start.
- Personalized snapshots with no foreign hand or stock order.
- Hashed, rotating resume tokens and old-socket replacement.
- Expected-revision checks and bounded command-ID deduplication.
- Reconnection, retention alarms, and deterministic timeout actions selected
  only from the timed-out seat's projected legal actions.
- Public domain-event delivery for authoritative animation ordering.

Protocol-envelope version and rules version are separate compatibility axes.
The current combination is protocol `1` plus rules `mvp-2`.

## Local development

### Prerequisites

- Node.js `24.14.0`, pinned in `.node-version`.
- pnpm `11.16.0`, pinned by the root `packageManager` field.

Dependencies and generated Expo bundles were intentionally removed after the
initial GitHub backup to save local storage. Restoring dependencies can consume
substantial disk space; install them when actively developing:

```sh
pnpm install
```

### Run the application

```sh
# Interactive Expo development server
pnpm dev:mobile

# Open V2 directly in a browser
pnpm --filter @gostop/mobile web

# Local Cloudflare relay
pnpm dev:relay
```

Expo normally serves the browser build at `http://localhost:8081`, but the
terminal output is authoritative if another port is selected.

Remote mode requires `EXPO_PUBLIC_RELAY_URL`. Use
`apps/mobile/.env.example` as a template and never commit a real `.env` or
secret. The checked-in example URL is only a placeholder.

## Validation

```sh
# Strict TypeScript plus focused tests in all workspaces
pnpm check

# Separate 10,000-deal deterministic simulation gate
pnpm test:simulation

# Full local gate
pnpm verify
```

The V2 implementation session recorded:

- Strict typechecks across the monorepo.
- 54 focused tests across core, AI, protocol, relay, and mobile.
- 10,000 seeded game simulations checking bounded termination, card and chip
  conservation, invariants after each command, and byte-equivalent replay.
- Expo export checks for iOS, Android, and web.
- A successful Cloudflare relay dry run and focused relay tests.
- Browser interaction and responsive visual QA with no final console errors or
  warnings and no remaining P0, P1, or P2 visual findings.

Those results describe the last completed implementation validation. Install
dependencies and rerun the relevant gates after new code changes. There is no
GitHub Actions workflow yet, so GitHub does not currently re-run them.

## Known limitations

- GitHub contains source and history but does not host a playable web preview.
- The relay is not proven deployed; the repository contains a placeholder URL.
- Local and AI games do not survive a browser refresh or app process death.
- Sound and high-contrast settings are stored but are not wired to gameplay or
  visual behavior yet.
- Haptics currently cover app-button presses, not every promised turn, capture,
  and result event.
- English and Korean message catalogs exist, but some screens still contain
  hard-coded English or mixed bilingual text.
- Standard AI is a visible-state heuristic, not a search or Monte Carlo player.
- No checked-in CI workflow, Maestro suite, or full physical-device test matrix
  exists.
- The 250 x 280 source reference limits detail in very large card previews.
- Art provenance is documented, but release-grade licensing and legal review
  remain product-owner responsibilities.
- App Store and Play Store publication, age ratings, privacy policy, production
  domains, monitoring, and cost controls are not complete.

## Recommended next milestones

1. Add GitHub Actions for `pnpm check` and the simulation gate.
2. Deploy a private web preview so V2 can be tested without reinstalling local
   dependencies.
3. Deploy and configure a preview Cloudflare relay, then complete a three-device
   reconnect and privacy test.
4. Finish localization, sound, high-contrast wiring, and expanded haptics.
5. Add mobile E2E coverage and validate iOS/Android development builds on
   physical devices.
6. Replace or redraw card art at higher resolution once a release-grade art and
   licensing direction is approved.
7. Consider rebuys, accounts, matchmaking, and persistent balances only as
   explicitly versioned post-MVP product work.

## Starting a new Codex task

Open the repository as the task workspace. Root `AGENTS.md` supplies operating
instructions automatically; use this bootstrap prompt to make the handoff
explicit:

> Continue the Go Stop Together project from the current repository state.
> Read `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, and `README.md` before making
> changes. For game-rule work, also read `IMPLEMENTATION_PLAN.md` and
> `docs/JOKER_RULES.md`. Inspect `git status` and recent history, then summarize
> the current state and proceed with my request. Treat the current profile as
> `mvp-2` unless I explicitly approve a versioned rules change.

Update this file whenever product scope, architecture, rules version, deployment
status, validation procedure, or known limitations materially change.
