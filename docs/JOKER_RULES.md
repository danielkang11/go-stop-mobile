# Go-Stop `mvp-2`: 2-Pi Bonus/Service Cards

## Evidence

- [Pagat's Go-Stop rules](https://www.pagat.com/fishing/gostop.html#jokers) describe jokers as bonus cards. A joker played from hand or turned from the stock goes directly to the acting player's capture area, and a stock card is immediately revealed to replace it. Face-up jokers in the initial layout go to the dealer, with an equal number of replacements revealed from the stock. Pagat also documents two- and three-pi joker values and identifies rules that attach a joker to a `뻑` as variants rather than the default behavior.
- [Fuda Wiki's Go-Stop compendium](https://fudawiki.org/en/hanafuda/games/go-stop) likewise describes immediately capturing a joker from hand and drawing a stock replacement that is treated as the hand card. It notes that a valuable joker may be surrendered when a player has no ordinary pi.
- [Hangame's official three-player Go-Stop guide](https://mgostop.hangame.com/guide/combine/04_05_game_mode.html) confirms that its three-player game uses bonus cards and, unlike its two-player Matgo mode, playing one does not steal an opponent's pi. This is platform-specific evidence, not a universal rule.

There is no single standardized joker set: values, quantities, pi theft, multipliers, and `뻑` interaction vary by deck, household, and platform. The following is therefore the fixed product profile, not a claim of a universal Korean rule.

## Fixed `mvp-2` profile

1. The deck has 50 unique cards: the 48 ordinary month cards plus exactly two service cards, `bonus-2pi-a` and `bonus-2pi-b`.
2. Each service card counts as two effective pi. It has no month, cannot match a table card, cannot form a triplet or `총통`, and is never a wildcard.
3. If a service card is among the six initial face-up cards, the dealer captures it immediately. Reveal replacements from the stock until the table again has six ordinary cards. A replacement that is also a service card is captured by the dealer and replaced again. Only then evaluate four-on-table, locked three-card stacks, and `총통`.
4. A service card dealt to a hand remains concealed and occupies a hand slot. When played, it is captured immediately. Reveal from the stock until an ordinary replacement appears; that ordinary card is resolved as the player's hand card. Then perform the turn's normal stock flip. This can consume more than two stock cards if the replacement is the other service card. If only service cards remain and the stock is exhausted before an ordinary replacement appears, keep the service-card captures and end the turn without inventing a card.
5. A service card revealed during the normal stock flip is captured immediately and another stock card is revealed for the same flip. Chained service cards repeat this process. If the stock ends after service cards, retain those captures and finish resolving the already-played hand card without inventing a replacement.
6. Capturing or playing a service card does not by itself take pi from opponents. Service cards never join a `뻑` stack; this deliberately excludes Pagat's documented alternative joker/`뻑` variant.
7. Each service card is a physical, captured 2-pi card for scoring, `피박`, and pi surrender. Automatic surrender prefers an ordinary 1-pi card. If none exists, a service card may satisfy a one-unit surrender request and transfers its full two-pi value, consistent with the existing valuable-pi rule.
8. Initial-table service cards do not create a pre-turn Go/Stop decision. Hand- or stock-captured service cards participate in the normal score check at the end of that turn.
9. Service cards do not affect chip antes, the Boar Pot, dealer rotation, bankruptcy, or limited liability.

## Explicitly excluded variants

- 1-pi or 3-pi jokers, boss-pi theft, score multipliers, bright protection, missions, and cash awards.
- Treating a service card as a month wildcard.
- Attaching a service card to a `뻑` created by its replacement.
- Opponent pi theft merely for playing or revealing a service card.

The rules version is `mvp-2`; replay compatibility must never infer this 50-card profile from an `mvp-1` state.
