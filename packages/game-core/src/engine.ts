import {
  BOAR_CARD_ID,
  CARDS,
  getCard,
  getMatchingMonth,
  isBonusCard,
} from "./cards";
import { assertSessionInvariants } from "./invariants";
import { randomIndex, shuffled } from "./rng";
import { scoreCaptured, scoreCapturedCandidates } from "./scoring";
import type {
  AuthoritativeSessionState,
  CardId,
  ChipLedgerEntry,
  CommandError,
  CreateSessionOptions,
  DomainEvent,
  HandStage,
  Month,
  PendingChoice,
  PlayerCommand,
  PlayerRoundState,
  PlayerRoundView,
  PlayerView,
  PlayerVisibleEvent,
  ReduceDependencies,
  ReduceResult,
  Rng,
  RoundState,
  RoundSummary,
  ScoreBreakdown,
  SeatId,
  SeatRecord,
  SpecialEventName,
  TableGroup,
  Transfer,
  TurnContext,
} from "./model";

const SEAT_IDS: readonly SeatId[] = [0, 1, 2];

const seatRecord = <T>(factory: (seatId: SeatId) => T): SeatRecord<T> => ({
  0: factory(0),
  1: factory(1),
  2: factory(2),
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const nextSeat = (seatId: SeatId): SeatId => ((seatId + 1) % 3) as SeatId;
const seatOrderFrom = (seatId: SeatId): [SeatId, SeatId, SeatId] => [
  seatId,
  nextSeat(seatId),
  nextSeat(nextSeat(seatId)),
];

function playerState(): PlayerRoundState {
  return {
    hand: [],
    captured: [],
    goCount: 0,
    declaredShakes: [],
    completedBombCount: 0,
    skipHandCredits: 0,
    ppeokCreated: 0,
  };
}

function wallets(state: AuthoritativeSessionState): SeatRecord<number> {
  return seatRecord((seatId) => state.seats[seatId].chips);
}

function sortTable(groups: TableGroup[]): void {
  groups.sort((left, right) => left.month - right.month);
  for (const group of groups) group.cards.sort();
}

function tableGroup(round: RoundState, month: Month): TableGroup | undefined {
  return round.tableGroups.find((group) => group.month === month);
}

function removeTableCard(round: RoundState, cardId: CardId): void {
  const index = round.tableGroups.findIndex((group) => group.cards.includes(cardId));
  if (index < 0) throw new Error(`Card is not on the table: ${cardId}`);
  const group = round.tableGroups[index]!;
  group.cards.splice(group.cards.indexOf(cardId), 1);
  if (group.cards.length === 0) round.tableGroups.splice(index, 1);
}

function removeTableGroup(round: RoundState, group: TableGroup): CardId[] {
  const index = round.tableGroups.indexOf(group);
  if (index < 0) throw new Error("Table group is no longer present");
  round.tableGroups.splice(index, 1);
  return [...group.cards];
}

function addLooseCard(round: RoundState, cardId: CardId): void {
  const month = getMatchingMonth(cardId);
  const group = tableGroup(round, month);
  if (!group) {
    round.tableGroups.push({ month, cards: [cardId], state: "loose" });
  } else {
    if (group.state !== "loose" || group.cards.length >= 2) {
      throw new Error(`Cannot add a loose card to month ${month}`);
    }
    group.cards.push(cardId);
  }
  sortTable(round.tableGroups);
}

function addLockedPpeok(
  round: RoundState,
  month: Month,
  cardIds: CardId[],
  createdBySeatId: SeatId,
): void {
  if (tableGroup(round, month)) throw new Error(`Month ${month} is already on the table`);
  round.tableGroups.push({
    month,
    cards: [...cardIds].sort(),
    state: "locked-ppeok",
    createdBySeatId,
  });
  sortTable(round.tableGroups);
}

function detach(context: TurnContext, cardId: CardId): void {
  if (!context.detachedCardIds.includes(cardId)) context.detachedCardIds.push(cardId);
}

function attach(context: TurnContext, cardIds: readonly CardId[]): void {
  for (const cardId of cardIds) {
    const index = context.detachedCardIds.indexOf(cardId);
    if (index < 0) throw new Error(`Cannot attach card that is not detached: ${cardId}`);
    context.detachedCardIds.splice(index, 1);
  }
}

function markCaptured(context: TurnContext, cardIds: readonly CardId[]): void {
  for (const cardId of cardIds) {
    if (!context.detachedCardIds.includes(cardId)) {
      throw new Error(`Captured card is not detached: ${cardId}`);
    }
    if (!context.capturedThisTurn.includes(cardId)) context.capturedThisTurn.push(cardId);
  }
}

function addSpecial(context: TurnContext, special: SpecialEventName, surrenderUnits = 0): void {
  if (!context.specialEvents.includes(special)) context.specialEvents.push(special);
  context.surrenderUnitsPerOpponent += surrenderUnits;
}

function createTurnContext(actorSeat: SeatId, source: TurnContext["source"]): TurnContext {
  return {
    actorSeat,
    source,
    playedCardIds: [],
    handStage: { type: "none" },
    detachedCardIds: [],
    capturedThisTurn: [],
    specialEvents: [],
    surrenderUnitsPerOpponent: 0,
    finalStockDraw: false,
  };
}

function buildTableGroups(tableCards: readonly CardId[]): TableGroup[] {
  const byMonth = new Map<Month, CardId[]>();
  for (const cardId of tableCards) {
    const month = getMatchingMonth(cardId);
    const cards = byMonth.get(month) ?? [];
    cards.push(cardId);
    byMonth.set(month, cards);
  }
  const groups = [...byMonth.entries()].map(([month, cards]): TableGroup => ({
    month,
    cards: cards.sort(),
    state: cards.length === 3 ? "locked-ppeok" : "loose",
  }));
  sortTable(groups);
  return groups;
}

function postAnte(state: AuthoritativeSessionState, events: DomainEvent[]): boolean {
  if (state.seats.some((seat) => seat.chips < 1)) {
    endSession(state, events, 0);
    return false;
  }
  for (const seatId of SEAT_IDS) {
    state.seats[seatId].chips -= 1;
    state.pot += 1;
    state.potContributionBySeat[seatId] += 1;
    state.currentRoundLedger.push({
      type: "ante",
      amount: 1,
      from: seatId,
      roundNumber: state.roundNumber,
    });
  }
  state.antePostedForDeal = true;
  events.push({ type: "ante-posted", amountPerSeat: 1, pot: state.pot });
  return true;
}

interface DealAttempt {
  round: RoundState;
  initialBonusCardIds: CardId[];
  invalidReason?: "four-on-table" | "multiple-chongtong";
  chongtongWinner?: SeatId;
}

function dealAttempt(state: AuthoritativeSessionState, rng: Rng, attempt: number): DealAttempt {
  const deck = shuffled(CARDS.map((card) => card.id), rng);
  let cursor = 0;
  const draw = (count: number): CardId[] => {
    const cards = deck.slice(cursor, cursor + count);
    cursor += count;
    return cards;
  };
  const players = seatRecord(() => playerState());
  const order = seatOrderFrom(state.dealerSeat);
  for (const seatId of order) players[seatId].hand.push(...draw(4));
  const tableCards = draw(3);
  for (const seatId of order) players[seatId].hand.push(...draw(3));
  tableCards.push(...draw(3));
  for (const seatId of SEAT_IDS) players[seatId].hand.sort();

  // A face-up service card belongs to the dealer immediately and does not
  // occupy one of the six layout slots. Replacements may themselves be bonus
  // cards, so continue until all six table cards are ordinary month cards.
  const initialBonusCardIds: CardId[] = [];
  const regularTableCards = tableCards.filter((cardId) => {
    if (!isBonusCard(cardId)) return true;
    initialBonusCardIds.push(cardId);
    return false;
  });
  while (regularTableCards.length < 6) {
    const replacement = draw(1)[0];
    if (!replacement) throw new Error("Stock exhausted while replacing an initial bonus card");
    if (isBonusCard(replacement)) initialBonusCardIds.push(replacement);
    else regularTableCards.push(replacement);
  }
  players[state.dealerSeat].captured.push(...initialBonusCardIds);
  players[state.dealerSeat].captured.sort();

  const tableGroups = buildTableGroups(regularTableCards);
  const round: RoundState = {
    roundId: `${state.sessionId}:r${state.roundNumber}:a${attempt}`,
    dealAttempt: attempt,
    phase: "turn",
    stock: deck.slice(cursor),
    tableGroups,
    players,
    currentSeat: state.dealerSeat,
    turnNumber: 1,
    boarAward: 0,
    nagariStreakEnteringDeal: state.nagariStreak,
  };

  if (tableGroups.some((group) => group.cards.length === 4)) {
    return { round, initialBonusCardIds, invalidReason: "four-on-table" };
  }

  const chongtongSeats = SEAT_IDS.filter((seatId) => {
    const counts = new Map<Month, number>();
    for (const cardId of players[seatId].hand) {
      if (isBonusCard(cardId)) continue;
      const month = getMatchingMonth(cardId);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    return [...counts.values()].some((count) => count === 4);
  });
  if (chongtongSeats.length > 1) {
    return { round, initialBonusCardIds, invalidReason: "multiple-chongtong" };
  }
  const winner = chongtongSeats[0];
  return winner === undefined
    ? { round, initialBonusCardIds }
    : { round, initialBonusCardIds, chongtongWinner: winner };
}

function dealUntilValid(state: AuthoritativeSessionState, rng: Rng, events: DomainEvent[]): void {
  for (let attempt = 1; attempt <= 10_000; attempt += 1) {
    const dealt = dealAttempt(state, rng, attempt);
    state.round = dealt.round;
    events.push({
      type: "deal-started",
      roundNumber: state.roundNumber,
      dealAttempt: attempt,
      dealerSeat: state.dealerSeat,
    });
    if (dealt.invalidReason) {
      events.push({ type: "administrative-redeal", reason: dealt.invalidReason, dealAttempt: attempt });
      continue;
    }
    for (const cardId of dealt.initialBonusCardIds) {
      events.push({
        type: "bonus-captured",
        seatId: state.dealerSeat,
        cardId,
        source: "initial-table",
      });
    }
    if (dealt.chongtongWinner !== undefined) {
      settlePointWin(state, dealt.chongtongWinner, events, { chongtong: true });
    }
    return;
  }
  throw new Error("Unable to produce a valid deal after 10,000 attempts");
}

function beginRound(state: AuthoritativeSessionState, rng: Rng, events: DomainEvent[], now: number): void {
  state.phase = "playing";
  state.currentRoundLedger = [];
  if (!postAnte(state, events)) return;
  dealUntilValid(state, rng, events);
  if (state.endedAt === 0 && now !== 0) state.endedAt = now;
}

function refundPot(state: AuthoritativeSessionState, events: DomainEvent[]): void {
  const refunds = seatRecord((seatId) => state.potContributionBySeat[seatId]);
  for (const seatId of SEAT_IDS) {
    const amount = refunds[seatId];
    state.seats[seatId].chips += amount;
    if (amount > 0) {
      state.currentRoundLedger.push({
        type: "pot-refund",
        amount,
        to: seatId,
        roundNumber: state.roundNumber,
      });
    }
    state.potContributionBySeat[seatId] = 0;
  }
  state.pot = 0;
  events.push({ type: "pot-refunded", refunds });
}

function endSession(state: AuthoritativeSessionState, events: DomainEvent[], now: number): void {
  if (state.pot > 0) refundPot(state, events);
  state.phase = "session-ended";
  state.endReason = "player-cannot-ante";
  state.endedAt = now;
  events.push({ type: "session-ended", reason: "player-cannot-ante" });
}

function maybeEndAfterRound(state: AuthoritativeSessionState, events: DomainEvent[], now: number): void {
  if (state.seats.some((seat) => seat.chips < 1)) endSession(state, events, now);
}

function awardBoarPot(state: AuthoritativeSessionState, capturer: SeatId, events: DomainEvent[]): void {
  const round = state.round!;
  if (round.boarCapturer !== undefined) return;
  const award = state.pot;
  round.boarCapturer = capturer;
  round.boarAward = award;
  state.seats[capturer].chips += award;
  state.pot = 0;
  for (const seatId of SEAT_IDS) state.potContributionBySeat[seatId] = 0;
  state.currentRoundLedger.push({
    type: "boar-award",
    amount: award,
    to: capturer,
    roundNumber: state.roundNumber,
  });
  events.push({ type: "boar-pot-awarded", capturer, award });
}

function commonLiability(
  score: ScoreBreakdown,
  player: PlayerRoundState,
  nagariStreakEnteringDeal: number,
): { amount: number; exponent: number } {
  const exponent =
    Math.max(0, player.goCount - 2) +
    player.declaredShakes.length +
    player.completedBombCount +
    (score.meongTta ? 1 : 0) +
    Math.min(nagariStreakEnteringDeal, 3);
  return { amount: (score.baseScore + player.goCount) * 2 ** exponent, exponent };
}

function loserBak(
  winnerScore: ScoreBreakdown,
  loser: PlayerRoundState,
): { gwangBak: boolean; piBak: boolean } {
  const candidates = scoreCapturedCandidates(loser.captured);
  const chosen = candidates.reduce((best, candidate) => {
    const bestPiBak = winnerScore.hasPiScore && best.effectivePi >= 1 && best.effectivePi <= 5;
    const candidatePiBak =
      winnerScore.hasPiScore && candidate.effectivePi >= 1 && candidate.effectivePi <= 5;
    return bestPiBak && !candidatePiBak ? candidate : best;
  });
  return {
    gwangBak: winnerScore.hasScoringBrightCombination && chosen.brightCount === 0,
    piBak: winnerScore.hasPiScore && chosen.effectivePi >= 1 && chosen.effectivePi <= 5,
  };
}

function chooseWinnerScore(state: AuthoritativeSessionState, winnerSeat: SeatId): ScoreBreakdown {
  const round = state.round!;
  const winner = round.players[winnerSeat];
  const maxBase = Math.max(...scoreCapturedCandidates(winner.captured).map((score) => score.baseScore));
  const candidates = scoreCapturedCandidates(winner.captured).filter((score) => score.baseScore === maxBase);
  let best = candidates[0]!;
  let bestNominal = -1;
  for (const candidate of candidates) {
    const common = commonLiability(candidate, winner, round.nagariStreakEnteringDeal).amount;
    const nominal = SEAT_IDS.filter((seatId) => seatId !== winnerSeat).reduce<number>((sum, seatId) => {
      const bak = loserBak(candidate, round.players[seatId]);
      return sum + common * (bak.gwangBak ? 2 : 1) * (bak.piBak ? 2 : 1);
    }, 0);
    if (nominal > bestNominal || (nominal === bestNominal && candidate.cupAllocation === "animal")) {
      best = candidate;
      bestNominal = nominal;
    }
  }
  return best;
}

function settlePointWin(
  state: AuthoritativeSessionState,
  winnerSeat: SeatId,
  events: DomainEvent[],
  options: { chongtong?: boolean } = {},
): void {
  const round = state.round!;
  const winnerPlayer = round.players[winnerSeat];
  const winnerScore = options.chongtong
    ? { ...scoreCaptured([]), baseScore: 3 }
    : chooseWinnerScore(state, winnerSeat);
  const liability = commonLiability(winnerScore, winnerPlayer, round.nagariStreakEnteringDeal);
  const losers = SEAT_IDS.filter((seatId) => seatId !== winnerSeat);
  const slot = new Map<SeatId, { amount: number; gwangBak: boolean; piBak: boolean }>();
  for (const loserSeat of losers) {
    const bak = options.chongtong
      ? { gwangBak: false, piBak: false }
      : loserBak(winnerScore, round.players[loserSeat]);
    slot.set(loserSeat, {
      amount: liability.amount * (bak.gwangBak ? 2 : 1) * (bak.piBak ? 2 : 1),
      ...bak,
    });
  }

  const goCallers = options.chongtong
    ? []
    : losers
        .filter((seatId) => round.players[seatId].firstGoTurn !== undefined)
        .sort(
          (left, right) =>
            round.players[left].firstGoTurn! - round.players[right].firstGoTurn! || left - right,
        );
  const goBakPayer = goCallers[0];
  const assigned = new Map<SeatId, number>(losers.map((seatId) => [seatId, slot.get(seatId)!.amount]));
  if (goBakPayer !== undefined) {
    const total = losers.reduce<number>((sum, seatId) => sum + slot.get(seatId)!.amount, 0);
    for (const seatId of losers) assigned.set(seatId, seatId === goBakPayer ? total : 0);
  }

  const transfers: Transfer[] = [];
  for (const payer of losers.sort((left, right) => left - right)) {
    const owed = assigned.get(payer)!;
    const paid = Math.min(state.seats[payer].chips, owed);
    state.seats[payer].chips -= paid;
    state.seats[winnerSeat].chips += paid;
    if (paid > 0) {
      const ledger: ChipLedgerEntry = {
        type: "point-payment",
        amount: paid,
        from: payer,
        to: winnerSeat,
        roundNumber: state.roundNumber,
      };
      state.currentRoundLedger.push(ledger);
    }
    const payerBak = slot.get(payer)!;
    transfers.push({
      payer,
      owed,
      paid,
      shortfall: owed - paid,
      gwangBak: payerBak.gwangBak,
      piBak: payerBak.piBak,
      goBak: payer === goBakPayer,
    });
  }

  state.dealerSeat = winnerSeat;
  state.nagariStreak = 0;
  state.antePostedForDeal = false;
  round.phase = "complete";
  delete round.pendingChoice;
  delete round.turnContext;
  const summary: RoundSummary = {
    roundNumber: state.roundNumber,
    roundId: round.roundId,
    result: options.chongtong ? "chongtong" : "stop",
    dealerSeat: state.dealerSeat,
    winnerSeat,
    baseScore: winnerScore.baseScore,
    goCount: winnerPlayer.goCount,
    commonLiability: liability.amount,
    globalExponent: liability.exponent,
    transfers,
    ...(round.boarCapturer !== undefined ? { boarCapturer: round.boarCapturer } : {}),
    boarAward: round.boarAward,
    potCarried: state.pot,
    nagariStreakEnteringDeal: round.nagariStreakEnteringDeal,
    walletsAfter: wallets(state),
  };
  state.recentRoundSummaries.push(summary);
  state.recentRoundSummaries = state.recentRoundSummaries.slice(-10);
  state.phase = "round-complete";
  events.push({ type: "round-ended", summary: clone(summary) });
  maybeEndAfterRound(state, events, 0);
}

function finishNagari(state: AuthoritativeSessionState, events: DomainEvent[]): void {
  const round = state.round!;
  state.nagariStreak += 1;
  state.antePostedForDeal = false;
  round.phase = "complete";
  delete round.pendingChoice;
  delete round.turnContext;
  const summary: RoundSummary = {
    roundNumber: state.roundNumber,
    roundId: round.roundId,
    result: "nagari",
    dealerSeat: state.dealerSeat,
    transfers: [],
    ...(round.boarCapturer !== undefined ? { boarCapturer: round.boarCapturer } : {}),
    boarAward: round.boarAward,
    potCarried: state.pot,
    nagariStreakEnteringDeal: round.nagariStreakEnteringDeal,
    walletsAfter: wallets(state),
  };
  state.recentRoundSummaries.push(summary);
  state.recentRoundSummaries = state.recentRoundSummaries.slice(-10);
  state.phase = "round-complete";
  events.push({ type: "round-ended", summary: clone(summary) });
  maybeEndAfterRound(state, events, 0);
}

function choosePiCards(captured: readonly CardId[], requested: number): CardId[] {
  if (requested <= 0) return [];
  const eligible = captured
    .filter((cardId) => getCard(cardId).category === "pi")
    .sort();
  const total = eligible.reduce((sum, cardId) => sum + getCard(cardId).piValue, 0);
  if (total <= requested) return eligible;

  type Candidate = { cards: CardId[]; value: number };
  const bestByValue = new Map<number, Candidate>([[0, { cards: [], value: 0 }]]);
  for (const cardId of eligible) {
    const value = getCard(cardId).piValue;
    const snapshot = [...bestByValue.values()];
    for (const prior of snapshot) {
      const candidate: Candidate = { cards: [...prior.cards, cardId], value: prior.value + value };
      const current = bestByValue.get(candidate.value);
      const candidateKey = candidate.cards.join("|");
      const currentKey = current?.cards.join("|") ?? "";
      if (
        !current ||
        candidate.cards.length < current.cards.length ||
        (candidate.cards.length === current.cards.length && candidateKey < currentKey)
      ) {
        bestByValue.set(candidate.value, candidate);
      }
    }
  }
  return [...bestByValue.values()]
    .filter((candidate) => candidate.value >= requested)
    .sort(
      (left, right) =>
        left.value - right.value ||
        left.cards.length - right.cards.length ||
        left.cards.join("|").localeCompare(right.cards.join("|")),
    )[0]!.cards;
}

function applyPiSurrender(state: AuthoritativeSessionState, context: TurnContext, events: DomainEvent[]): void {
  if (context.surrenderUnitsPerOpponent <= 0) return;
  const round = state.round!;
  for (const opponent of SEAT_IDS) {
    if (opponent === context.actorSeat) continue;
    const player = round.players[opponent];
    const cardIds = choosePiCards(player.captured, context.surrenderUnitsPerOpponent);
    if (cardIds.length === 0) continue;
    for (const cardId of cardIds) player.captured.splice(player.captured.indexOf(cardId), 1);
    round.players[context.actorSeat].captured.push(...cardIds);
    events.push({
      type: "pi-surrendered",
      from: opponent,
      to: context.actorSeat,
      cardIds,
      effectivePi: cardIds.reduce((sum, cardId) => sum + getCard(cardId).piValue, 0),
    });
  }
}

function captureLockedGroup(
  round: RoundState,
  context: TurnContext,
  group: TableGroup,
): void {
  const cards = removeTableGroup(round, group);
  for (const cardId of cards) detach(context, cardId);
  markCaptured(context, cards);
  if (group.createdBySeatId !== undefined) {
    if (group.createdBySeatId === context.actorSeat) addSpecial(context, "self-ppeok", 2);
    else addSpecial(context, "ppeok-capture", 1);
  }
}

function captureTurnBonus(
  context: TurnContext,
  cardId: CardId,
  source: "hand" | "stock",
  events: DomainEvent[],
): void {
  detach(context, cardId);
  markCaptured(context, [cardId]);
  events.push({
    type: "bonus-captured",
    seatId: context.actorSeat,
    cardId,
    source,
  });
}

function resolveGeneralStock(state: AuthoritativeSessionState, events: DomainEvent[]): void {
  const round = state.round!;
  const context = round.turnContext!;
  const stockCardId = context.stockCardId!;
  const group = tableGroup(round, getMatchingMonth(stockCardId));
  if (!group) {
    addLooseCard(round, stockCardId);
    attach(context, [stockCardId]);
    finalizeTurn(state, events);
    return;
  }
  if (group.state === "locked-ppeok") {
    captureLockedGroup(round, context, group);
    markCaptured(context, [stockCardId]);
    finalizeTurn(state, events);
    return;
  }
  if (group.cards.length === 1) {
    const match = group.cards[0]!;
    removeTableCard(round, match);
    detach(context, match);
    markCaptured(context, [stockCardId, match]);
    finalizeTurn(state, events);
    return;
  }
  const candidates = [...group.cards].sort() as [CardId, CardId];
  round.phase = "awaiting-stock-match";
  round.pendingChoice = { type: "stock-match", seatId: context.actorSeat, candidateCardIds: candidates };
}

function flipStock(state: AuthoritativeSessionState, events: DomainEvent[]): void {
  const round = state.round!;
  const context = round.turnContext!;
  const stockCardId = round.stock.shift();
  if (!stockCardId) {
    context.finalStockDraw = true;
    if (context.handStage.type === "provisional-pair") {
      markCaptured(context, context.handStage.cardIds);
      context.handStage = { type: "resolved" };
    }
    finalizeTurn(state, events);
    return;
  }
  events.push({ type: "stock-flipped", seatId: context.actorSeat, cardId: stockCardId });
  if (isBonusCard(stockCardId)) {
    captureTurnBonus(context, stockCardId, "stock", events);
    flipStock(state, events);
    return;
  }
  context.stockCardId = stockCardId;
  context.finalStockDraw = round.stock.length === 0;
  detach(context, stockCardId);
  const stockMonth = getMatchingMonth(stockCardId);
  const handStage = context.handStage;

  if (handStage.type === "provisional-pair" && handStage.month === stockMonth) {
    if (handStage.startedWithTwoMatches) {
      const remaining = tableGroup(round, stockMonth);
      if (!remaining || remaining.state !== "loose" || remaining.cards.length !== 1) {
        throw new Error("Ttadak resolution lost its remaining table card");
      }
      const remainingCard = remaining.cards[0]!;
      removeTableCard(round, remainingCard);
      detach(context, remainingCard);
      markCaptured(context, [...handStage.cardIds, stockCardId, remainingCard]);
      if (!context.finalStockDraw) addSpecial(context, "ttadak", 1);
      context.handStage = { type: "resolved" };
      finalizeTurn(state, events);
      return;
    }
    if (context.finalStockDraw) {
      markCaptured(context, [...handStage.cardIds, stockCardId]);
      context.handStage = { type: "resolved" };
      finalizeTurn(state, events);
      return;
    }
    const cards = [...handStage.cardIds, stockCardId];
    addLockedPpeok(round, stockMonth, cards, context.actorSeat);
    attach(context, cards);
    round.players[context.actorSeat].ppeokCreated += 1;
    events.push({ type: "ppeok-created", seatId: context.actorSeat, month: stockMonth, cardIds: cards });
    context.handStage = { type: "resolved" };
    finalizeTurn(state, events);
    return;
  }

  if (handStage.type === "placed" && handStage.month === stockMonth) {
    removeTableCard(round, handStage.cardId);
    detach(context, handStage.cardId);
    markCaptured(context, [handStage.cardId, stockCardId]);
    if (!context.finalStockDraw) addSpecial(context, "jjok", 1);
    context.handStage = { type: "resolved" };
    finalizeTurn(state, events);
    return;
  }

  if (handStage.type === "provisional-pair") {
    markCaptured(context, handStage.cardIds);
    context.handStage = { type: "resolved" };
  }
  resolveGeneralStock(state, events);
}

function resolvePlayedHandCard(
  state: AuthoritativeSessionState,
  cardId: CardId,
  events: DomainEvent[],
): void {
  const round = state.round!;
  const context = round.turnContext!;
  context.handCardId = cardId;
  detach(context, cardId);

  const month = getMatchingMonth(cardId);
  const group = tableGroup(round, month);
  if (!group) {
    addLooseCard(round, cardId);
    attach(context, [cardId]);
    context.handStage = { type: "placed", cardId, month };
    flipStock(state, events);
    return;
  }
  if (group.state === "locked-ppeok") {
    captureLockedGroup(round, context, group);
    markCaptured(context, [cardId]);
    context.handStage = { type: "resolved" };
    flipStock(state, events);
    return;
  }
  if (group.cards.length === 1) {
    const match = group.cards[0]!;
    removeTableCard(round, match);
    detach(context, match);
    context.handStage = {
      type: "provisional-pair",
      cardIds: [cardId, match],
      month,
      startedWithTwoMatches: false,
    };
    flipStock(state, events);
    return;
  }
  round.phase = "awaiting-hand-match";
  round.pendingChoice = {
    type: "hand-match",
    seatId: context.actorSeat,
    candidateCardIds: [...group.cards].sort() as [CardId, CardId],
  };
}

function drawHandReplacement(
  state: AuthoritativeSessionState,
  events: DomainEvent[],
): void {
  const round = state.round!;
  const context = round.turnContext!;
  const replacement = round.stock.shift();
  if (!replacement) {
    context.finalStockDraw = true;
    finalizeTurn(state, events);
    return;
  }
  context.playedCardIds.push(replacement);
  events.push({ type: "bonus-replacement-drawn", seatId: context.actorSeat, cardId: replacement });
  if (isBonusCard(replacement)) {
    captureTurnBonus(context, replacement, "stock", events);
    drawHandReplacement(state, events);
    return;
  }
  resolvePlayedHandCard(state, replacement, events);
}

function startNormalPlay(
  state: AuthoritativeSessionState,
  command: Extract<PlayerCommand, { type: "play-card" }>,
  events: DomainEvent[],
): void {
  const round = state.round!;
  const player = round.players[command.seatId];
  player.hand.splice(player.hand.indexOf(command.cardId), 1);
  const context = createTurnContext(command.seatId, "normal");
  context.playedCardIds = [command.cardId];
  round.turnContext = context;
  delete round.requiredShakeMonth;
  events.push({ type: "cards-played", seatId: command.seatId, cardIds: [command.cardId], action: "normal" });
  if (isBonusCard(command.cardId)) {
    captureTurnBonus(context, command.cardId, "hand", events);
    drawHandReplacement(state, events);
    return;
  }
  resolvePlayedHandCard(state, command.cardId, events);
}

function startBomb(
  state: AuthoritativeSessionState,
  command: Extract<PlayerCommand, { type: "play-bomb" }>,
  events: DomainEvent[],
): void {
  const round = state.round!;
  const player = round.players[command.seatId];
  const handCards = player.hand.filter(
    (cardId) => !isBonusCard(cardId) && getMatchingMonth(cardId) === command.month,
  );
  const group = tableGroup(round, command.month)!;
  const tableCard = group.cards[0]!;
  for (const cardId of handCards) player.hand.splice(player.hand.indexOf(cardId), 1);
  removeTableCard(round, tableCard);
  const context = createTurnContext(command.seatId, "bomb");
  context.playedCardIds = [...handCards];
  round.turnContext = context;
  for (const cardId of [...handCards, tableCard]) detach(context, cardId);
  markCaptured(context, [...handCards, tableCard]);
  addSpecial(context, "bomb", 1);
  player.completedBombCount += 1;
  player.skipHandCredits += 2;
  events.push({ type: "cards-played", seatId: command.seatId, cardIds: handCards, action: "bomb" });
  flipStock(state, events);
}

function startSkip(
  state: AuthoritativeSessionState,
  command: Extract<PlayerCommand, { type: "skip-hand" }>,
  events: DomainEvent[],
): void {
  const round = state.round!;
  const player = round.players[command.seatId];
  if (player.skipHandCredits > 0) player.skipHandCredits -= 1;
  else if (player.hand.length !== 0) throw new Error("A funded skip requires a bomb credit");
  round.turnContext = createTurnContext(command.seatId, "skip");
  events.push({ type: "cards-played", seatId: command.seatId, cardIds: [], action: "skip" });
  flipStock(state, events);
}

function finalizeTurn(state: AuthoritativeSessionState, events: DomainEvent[]): void {
  const round = state.round!;
  const context = round.turnContext!;
  if (round.tableGroups.length === 0 && !context.finalStockDraw) addSpecial(context, "sweep", 1);

  if (context.capturedThisTurn.length > 0) {
    const captured = [...context.capturedThisTurn].sort();
    round.players[context.actorSeat].captured.push(...captured);
    round.players[context.actorSeat].captured.sort();
    attach(context, captured);
    events.push({
      type: "cards-captured",
      seatId: context.actorSeat,
      cardIds: captured,
      specials: [...context.specialEvents],
    });
    if (captured.includes(BOAR_CARD_ID)) awardBoarPot(state, context.actorSeat, events);
  }
  if (context.detachedCardIds.length !== 0) {
    throw new Error(`Turn finished with detached cards: ${context.detachedCardIds.join(", ")}`);
  }
  applyPiSurrender(state, context, events);

  const actor = context.actorSeat;
  const baseScore = scoreCaptured(round.players[actor].captured).baseScore;
  const lastGo = round.players[actor].scoreAtLastGo;
  delete round.turnContext;
  if (baseScore >= 3 && (lastGo === undefined || baseScore > lastGo)) {
    round.phase = "awaiting-go-stop";
    round.pendingChoice = { type: "go-stop", seatId: actor, baseScore };
    return;
  }
  if (round.stock.length === 0) {
    finishNagari(state, events);
    return;
  }
  round.currentSeat = nextSeat(actor);
  round.turnNumber += 1;
  round.phase = "turn";
}

function commandMatches(left: PlayerCommand, right: PlayerCommand): boolean {
  if (left.type !== right.type || left.seatId !== right.seatId) return false;
  switch (left.type) {
    case "declare-shake":
    case "play-bomb":
      return "month" in right && left.month === right.month;
    case "play-card":
    case "choose-match":
      return "cardId" in right && left.cardId === right.cardId;
    default:
      return true;
  }
}

function reject(
  state: AuthoritativeSessionState,
  code: CommandError["code"],
  message: string,
): ReduceResult {
  return { ok: false, state, error: { code, message } };
}

export function getLegalActions(
  state: AuthoritativeSessionState,
  seatId: SeatId,
): PlayerCommand[] {
  if (state.phase === "session-ended") return [];
  if (state.phase === "round-complete") {
    return seatId === state.dealerSeat ? [{ type: "start-next-round", seatId }] : [];
  }
  const round = state.round;
  if (!round || seatId !== round.currentSeat) return [];
  const pending = round.pendingChoice;
  if (pending) {
    if (pending.seatId !== seatId) return [];
    if (pending.type === "go-stop") {
      return [
        { type: "choose-go", seatId },
        { type: "choose-stop", seatId },
      ];
    }
    return pending.candidateCardIds.map((cardId) => ({ type: "choose-match", seatId, cardId }));
  }
  if (round.phase !== "turn") return [];
  const player = round.players[seatId];
  if (round.requiredShakeMonth !== undefined) {
    return player.hand
      .filter(
        (cardId) =>
          !isBonusCard(cardId) && getMatchingMonth(cardId) === round.requiredShakeMonth,
      )
      .map((cardId) => ({ type: "play-card", seatId, cardId }));
  }

  const byMonth = new Map<Month, CardId[]>();
  for (const cardId of player.hand) {
    if (isBonusCard(cardId)) continue;
    const month = getMatchingMonth(cardId);
    const cards = byMonth.get(month) ?? [];
    cards.push(cardId);
    byMonth.set(month, cards);
  }
  const declaredMonths = new Set(player.declaredShakes.map((shake) => shake.month));
  const actions: PlayerCommand[] = [];
  for (const [month, cards] of [...byMonth.entries()].sort(([left], [right]) => left - right)) {
    if (cards.length !== 3 || declaredMonths.has(month)) continue;
    actions.push({ type: "declare-shake", seatId, month });
    const group = tableGroup(round, month);
    if (group?.state === "loose" && group.cards.length === 1) {
      actions.push({ type: "play-bomb", seatId, month });
    }
  }
  // Bombs and service-card replacement chains can leave stock after a seat's
  // hand is exhausted. Such a seat must still perform the stock half-turn so
  // the deal cannot strand cards with no legal command.
  if (player.skipHandCredits > 0 || player.hand.length === 0) {
    actions.push({ type: "skip-hand", seatId });
  }
  actions.push(...player.hand.map((cardId) => ({ type: "play-card" as const, seatId, cardId })));
  return actions;
}

export function reduceSession(
  state: AuthoritativeSessionState,
  command: PlayerCommand,
  dependencies: ReduceDependencies = {},
): ReduceResult {
  const legal = getLegalActions(state, command.seatId);
  if (!legal.some((candidate) => commandMatches(candidate, command))) {
    return reject(state, "illegal-command", `Command ${command.type} is not legal in the current state`);
  }
  if (command.type === "start-next-round" && !dependencies.rng) {
    return reject(state, "rng-required", "Starting a round requires an injected RNG");
  }

  const next = clone(state);
  const events: DomainEvent[] = [];
  const round = next.round;
  switch (command.type) {
    case "declare-shake": {
      const cards = round!.players[command.seatId].hand
        .filter(
          (cardId) => !isBonusCard(cardId) && getMatchingMonth(cardId) === command.month,
        )
        .sort() as [CardId, CardId, CardId];
      round!.players[command.seatId].declaredShakes.push({ month: command.month, revealedCardIds: cards });
      round!.requiredShakeMonth = command.month;
      events.push({ type: "shake-declared", seatId: command.seatId, month: command.month, cardIds: cards });
      break;
    }
    case "play-card":
      startNormalPlay(next, command, events);
      break;
    case "play-bomb":
      startBomb(next, command, events);
      break;
    case "skip-hand":
      startSkip(next, command, events);
      break;
    case "choose-match": {
      const pending = round!.pendingChoice!;
      const context = round!.turnContext!;
      delete round!.pendingChoice;
      if (pending.type === "hand-match") {
        removeTableCard(round!, command.cardId);
        detach(context, command.cardId);
        context.handStage = {
          type: "provisional-pair",
          cardIds: [context.handCardId!, command.cardId],
          month: getMatchingMonth(command.cardId),
          startedWithTwoMatches: true,
        };
        round!.phase = "turn";
        flipStock(next, events);
      } else if (pending.type === "stock-match") {
        removeTableCard(round!, command.cardId);
        detach(context, command.cardId);
        markCaptured(context, [context.stockCardId!, command.cardId]);
        round!.phase = "turn";
        finalizeTurn(next, events);
      }
      break;
    }
    case "choose-go": {
      const pending = round!.pendingChoice as Extract<PendingChoice, { type: "go-stop" }>;
      const player = round!.players[command.seatId];
      player.goCount += 1;
      player.scoreAtLastGo = pending.baseScore;
      if (player.firstGoTurn === undefined) player.firstGoTurn = round!.turnNumber;
      delete round!.pendingChoice;
      events.push({
        type: "go-declared",
        seatId: command.seatId,
        goCount: player.goCount,
        baseScore: pending.baseScore,
      });
      if (round!.stock.length === 0) finishNagari(next, events);
      else {
        round!.currentSeat = nextSeat(command.seatId);
        round!.turnNumber += 1;
        round!.phase = "turn";
      }
      break;
    }
    case "choose-stop":
      settlePointWin(next, command.seatId, events);
      break;
    case "start-next-round":
      next.roundNumber += 1;
      beginRound(next, dependencies.rng!, events, dependencies.now ?? 0);
      break;
  }
  next.revision += 1;
  if (next.phase === "session-ended" && next.endedAt === 0 && dependencies.now !== undefined) {
    next.endedAt = dependencies.now;
  }
  assertSessionInvariants(next);
  return { ok: true, state: next, events };
}

export function createSession(options: CreateSessionOptions): AuthoritativeSessionState {
  if (!options.sessionId) throw new Error("sessionId is required");
  const dealerSeat = options.dealerSeat ?? (randomIndex(options.rng, 3) as SeatId);
  const names = options.displayNames ?? ["Player 1", "Player 2", "Player 3"];
  const state: AuthoritativeSessionState = {
    schemaVersion: 1,
    rulesVersion: "mvp-2",
    sessionId: options.sessionId,
    mode: options.mode,
    revision: 0,
    phase: "playing",
    dealerSeat,
    roundNumber: 1,
    nagariStreak: 0,
    pot: 0,
    potContributionBySeat: seatRecord(() => 0),
    antePostedForDeal: false,
    seats: [
      { id: 0, displayName: names[0], chips: 50 },
      { id: 1, displayName: names[1], chips: 50 },
      { id: 2, displayName: names[2], chips: 50 },
    ],
    currentRoundLedger: [],
    recentRoundSummaries: [],
  };
  const events: DomainEvent[] = [{ type: "session-created", dealerSeat }];
  beginRound(state, options.rng, events, options.now ?? 0);
  assertSessionInvariants(state);
  return state;
}

export function projectPlayerView(state: AuthoritativeSessionState, seatId: SeatId): PlayerView {
  const legalActions = getLegalActions(state, seatId);
  const view: PlayerView = {
    schemaVersion: 1,
    rulesVersion: state.rulesVersion,
    sessionId: state.sessionId,
    mode: state.mode,
    revision: state.revision,
    phase: state.phase,
    viewerSeat: seatId,
    dealerSeat: state.dealerSeat,
    roundNumber: state.roundNumber,
    nagariStreak: state.nagariStreak,
    wallets: wallets(state),
    pot: state.pot,
    ownHand: state.round ? [...state.round.players[seatId].hand] : [],
    legalActions: clone(legalActions),
    recentRoundSummaries: clone(state.recentRoundSummaries),
  };
  if (state.endReason) view.endReason = state.endReason;
  if (state.round) {
    const round = state.round;
    const players = SEAT_IDS.map((playerSeat) => {
      const player = round.players[playerSeat];
      return {
        seatId: playerSeat,
        handCount: player.hand.length,
        captured: [...player.captured],
        score: scoreCaptured(player.captured),
        goCount: player.goCount,
        declaredShakes: clone(player.declaredShakes),
        completedBombCount: player.completedBombCount,
        skipHandCredits: player.skipHandCredits,
      };
    }) as PlayerRoundView["players"];
    const projectedRound: PlayerRoundView = {
      roundId: round.roundId,
      dealAttempt: round.dealAttempt,
      phase: round.phase,
      stockCount: round.stock.length,
      tableGroups: clone(round.tableGroups),
      players,
      currentSeat: round.currentSeat,
      turnNumber: round.turnNumber,
      boarAward: round.boarAward,
    };
    if (round.boarCapturer !== undefined) projectedRound.boarCapturer = round.boarCapturer;
    if (round.pendingChoice) projectedRound.pendingChoice = clone(round.pendingChoice);
    if (round.deadlineAt !== undefined) projectedRound.turnDeadlineAt = round.deadlineAt;
    if (round.turnContext) {
      projectedRound.activeTurn = {
        source: round.turnContext.source,
        playedCardIds: [...round.turnContext.playedCardIds],
        ...(round.turnContext.stockCardId ? { stockCardId: round.turnContext.stockCardId } : {}),
      };
    }
    view.round = projectedRound;
  }
  return view;
}

/** Domain events contain only public card information in mvp-2. */
export function projectEventsForSeat(
  events: readonly DomainEvent[],
  _seatId: SeatId,
): PlayerVisibleEvent[] {
  return clone([...events]);
}
