import { CARDS, getMatchingMonth, isBonusCard } from "./cards";
import type { AuthoritativeSessionState, CardId, SeatId } from "./model";

const SEATS: readonly SeatId[] = [0, 1, 2];

function assertInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a nonnegative integer`);
}

export function assertSessionInvariants(state: AuthoritativeSessionState): void {
  for (const seat of state.seats) assertInteger(seat.chips, `seat ${seat.id} chips`);
  assertInteger(state.pot, "pot");
  for (const seatId of SEATS) {
    assertInteger(state.potContributionBySeat[seatId], `seat ${seatId} pot contribution`);
  }
  const chipTotal = state.seats.reduce((sum, seat) => sum + seat.chips, 0) + state.pot;
  if (chipTotal !== 150) throw new Error(`Chip conservation failed: expected 150, received ${chipTotal}`);
  const contributionTotal = SEATS.reduce<number>(
    (sum, seatId) => sum + state.potContributionBySeat[seatId],
    0,
  );
  if (contributionTotal !== state.pot) {
    throw new Error(`Pot contribution mismatch: ${contributionTotal} !== ${state.pot}`);
  }

  if (!state.round) return;
  const zones: CardId[] = [];
  for (const seatId of SEATS) {
    zones.push(...state.round.players[seatId].hand, ...state.round.players[seatId].captured);
  }
  zones.push(...state.round.stock);
  for (const group of state.round.tableGroups) {
    if (group.cards.length === 0) throw new Error("An empty table group is not allowed");
    if (
      group.cards.some(
        (cardId) => isBonusCard(cardId) || getMatchingMonth(cardId) !== group.month,
      )
    ) {
      throw new Error(`Table group ${group.month} contains a card from another month`);
    }
    if (group.state === "locked-ppeok" && group.cards.length !== 3) {
      throw new Error("A locked ppeok must contain exactly three cards");
    }
    if (group.state === "loose" && group.cards.length > 2) {
      throw new Error("A loose table group cannot contain more than two cards");
    }
    zones.push(...group.cards);
  }
  zones.push(...(state.round.turnContext?.detachedCardIds ?? []));

  const expected = new Set(CARDS.map((card) => card.id));
  if (zones.length !== expected.size) {
    throw new Error(`Card partition has ${zones.length} cards; expected ${expected.size}`);
  }
  const actual = new Set(zones);
  if (actual.size !== zones.length) throw new Error("A card exists in more than one authoritative zone");
  for (const cardId of actual) {
    if (!expected.has(cardId)) throw new Error(`Unknown card in state: ${cardId}`);
  }
  for (const cardId of expected) {
    if (!actual.has(cardId)) throw new Error(`Missing card from state: ${cardId}`);
  }

  const pending = state.round.pendingChoice;
  if (pending) {
    if (pending.type !== "go-stop" && pending.candidateCardIds.length !== 2) {
      throw new Error("A match choice must have exactly two candidates");
    }
    if (pending.seatId !== state.round.currentSeat) throw new Error("Pending choice owner is not current seat");
  }
}
