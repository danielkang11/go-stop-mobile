# Go-Stop Mobile MVP V2

A three-seat Korean Go-Stop (`고스톱`) mobile game for iOS and Android. V2 supports local pass-and-play, one human against two computer players, and invite-code guest rooms. Every session starts each seat with 50 non-purchasable chips; each deal posts a one-chip ante to the Boar Pot.

V2 adds traditional Hwatu card faces with legible month badges, two double-pi service cards, a centered physical table layout, played-card and stock-flip animation, and public captured-card spreads grouped by 광·열끗·띠·피.

The original architecture and V1 decisions are documented in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md); the V2 service-card profile and research basis are documented in [docs/JOKER_RULES.md](./docs/JOKER_RULES.md).

For a durable handoff into a new development task, read
[docs/PROJECT_CONTEXT.md](./docs/PROJECT_CONTEXT.md). Repository-wide agent
instructions live in [AGENTS.md](./AGENTS.md).

## Prerequisites

- Node.js 22.13 or newer (the workspace pins Node 24.14 in `.node-version`)
- pnpm 11.16 or newer
- Expo Go or an iOS/Android development build for device testing

## Run locally

```sh
pnpm install
pnpm dev:mobile
```

From the Expo terminal, press `i` for the iOS simulator or `a` for an Android emulator. Scan the displayed QR code to use a physical device on the same network.

For the ephemeral online-room relay:

```sh
pnpm dev:relay
```

Set `EXPO_PUBLIC_RELAY_URL` for the mobile app when connecting it to a deployed or local relay. Local and AI games do not require the relay.

## Validate

```sh
pnpm check
pnpm test:simulation
```

The first command runs strict TypeScript checks and focused tests in every workspace package. The second runs the separate 10,000-deal deterministic replay and conservation gate.

## Packages

- `packages/game-core` — deterministic `mvp-2` rules, scoring, settlement, state projection, and 50-card catalog
- `packages/game-ai` — legal-action-only Easy and Standard computer policies
- `packages/protocol` — runtime-validated, versioned guest-room messages
- `apps/mobile` — Expo Router mobile client and the three controller implementations
- `apps/relay` — Cloudflare Worker with one Durable Object per guest room

Chips are session-only game counters. They cannot be bought, transferred, redeemed, or cashed out. Accounts, matchmaking, rebuys, and persistent balances are intentionally out of scope for this MVP.
