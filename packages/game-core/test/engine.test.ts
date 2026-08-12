import { describe, expect, it } from "vitest";
import {
  CARDS,
  assertSessionInvariants,
  createSeededRng,
  createSession,
  getCard,
  getLegalActions,
  projectPlayerView,
  reduceSession,
  type AuthoritativeSessionState,
  type CardId,
  type PlayerCommand,
  type SeatId,
  type TableGroup,
} from "../src/index";

const ALL_IDS = CARDS.map((card) => card.id);

function fresh(seed = 1): AuthoritativeSessionState {
  return createSession({
    sessionId: `test-${seed}`,
    mode: "pass-and-play",
    rng: createSeededRng(seed),
    dealerSeat: 0,
  });
}

interface Layout {
  hands?: Partial<Record<SeatId, CardId[]>>;
  captured?: Partial<Record<SeatId, CardId[]>>;
  table?: CardId[];
  stockFront?: CardId[];
  stockExact?: boolean;
}

function setLayout(state: AuthoritativeSessionState, layout: Layout): void {
  const round = state.round!;
  const used = new Set<CardId>();
  const take = (ids: readonly CardId[]): CardId[] => {
    for (const id of ids) {
      if (used.has(id)) throw new Error(`duplicate fixture card ${id}`);
      used.add(id);
    }
    return [...ids];
  };
  for (const seatId of [0, 1, 2] as const) {
    round.players[seatId].hand = take(layout.hands?.[seatId] ?? []);
    round.players[seatId].captured = take(layout.captured?.[seatId] ?? []);
    round.players[seatId].goCount = 0;
    delete round.players[seatId].scoreAtLastGo;
    delete round.players[seatId].firstGoTurn;
    round.players[seatId].declaredShakes = [];
    round.players[seatId].completedBombCount = 0;
    round.players[seatId].skipHandCredits = 0;
  }
  const tableCards = take(layout.table ?? []);
  const byMonth = new Map<number, CardId[]>();
  for (const id of tableCards) {
    const month = getCard(id).month;
    if (month === null) throw new Error(`bonus card cannot be placed on fixture table: ${id}`);
    byMonth.set(month, [...(byMonth.get(month) ?? []), id]);
  }
  round.tableGroups = [...byMonth.entries()].map(([month, cards]) => ({
    month: month as TableGroup["month"],
    cards,
    state: cards.length === 3 ? "locked-ppeok" : "loose",
  }));
  const stockFront = take(layout.stockFront ?? []);
  const remainder = ALL_IDS.filter((id) => !used.has(id));
  if (layout.stockExact) {
    round.stock = stockFront;
    round.players[2].captured.push(...remainder);
  } else {
    round.stock = [...stockFront, ...remainder];
  }
  round.currentSeat = 0;
  round.phase = "turn";
  round.turnNumber = 1;
  delete round.pendingChoice;
  delete round.turnContext;
  delete round.requiredShakeMonth;
  assertSessionInvariants(state);
}

function accept(state: AuthoritativeSessionState, command: PlayerCommand): AuthoritativeSessionState {
  const result = reduceSession(state, command, { rng: createSeededRng(999) });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  assertSessionInvariants(result.state);
  return result.state;
}

describe("session lifecycle and projections", () => {
  it("posts the three antes and partitions all 50 cards", () => {
    const state = fresh(11);
    expect(state.seats.map((seat) => seat.chips)).toEqual([49, 49, 49]);
    expect(state.pot).toBe(3);
    expect(state.potContributionBySeat).toEqual({ 0: 1, 1: 1, 2: 1 });
    // Two service cards enlarge the deck; initial-table bonuses can shorten
    // stock further because they are replaced before play.
    expect(state.round!.stock.length).toBeGreaterThanOrEqual(21);
    expect(state.round!.stock.length).toBeLessThanOrEqual(23);
    expect(state.round?.players[0].hand).toHaveLength(7);
    assertSessionInvariants(state);
  });

  it("uses mvp-2 and replaces initial-table service cards into the dealer capture area", () => {
    let state: AuthoritativeSessionState | undefined;
    for (let seed = 1; seed <= 10_000; seed += 1) {
      const candidate = fresh(seed);
      const dealerBonuses = candidate.round!.players[candidate.dealerSeat].captured.filter((cardId) =>
        cardId.startsWith("bonus-2pi-"),
      );
      if (dealerBonuses.length > 0) {
        state = candidate;
        break;
      }
    }
    expect(state).toBeDefined();
    if (!state) return;
    expect(state.rulesVersion).toBe("mvp-2");
    const bonuses = state.round!.players[state.dealerSeat].captured.filter((cardId) =>
      cardId.startsWith("bonus-2pi-"),
    );
    expect(state.round!.tableGroups.flatMap((group) => group.cards)).toHaveLength(6);
    expect(
      state.round!.tableGroups.flatMap((group) => group.cards).some((cardId) =>
        cardId.startsWith("bonus-2pi-"),
      ),
    ).toBe(false);
    expect(state.round!.stock).toHaveLength(23 - bonuses.length);
    assertSessionInvariants(state);
  });

  it("does not reveal another hand or stock order in a player projection", () => {
    const state = fresh(12);
    const viewText = JSON.stringify(projectPlayerView(state, 0));
    for (const hidden of [...state.round!.players[1].hand, ...state.round!.players[2].hand]) {
      expect(viewText).not.toContain(hidden);
    }
    for (const hidden of state.round!.stock) expect(viewText).not.toContain(hidden);
    expect(projectPlayerView(state, 0).ownHand).toEqual(state.round!.players[0].hand);
  });

  it("rejects an illegal command without changing state or revision", () => {
    const state = fresh(13);
    const before = JSON.stringify(state);
    const result = reduceSession(state, { type: "choose-stop", seatId: 2 });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(result.state).toBe(state);
  });
});

describe("capture flow and specials", () => {
  it("plays a hand service card, captures it, and resolves a stock replacement as the hand card", () => {
    const state = fresh(19);
    setLayout(state, {
      hands: { 0: ["bonus-2pi-a"] },
      captured: { 1: ["m03-pi-a"], 2: ["m06-pi-a"] },
      table: ["m01-pi-a", "m02-pi-b", "m04-pi-a"],
      stockFront: ["m01-bright", "m02-pi-a"],
    });
    const result = reduceSession(state, {
      type: "play-card",
      seatId: 0,
      cardId: "bonus-2pi-a",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round!.players[0].captured).toEqual(
      expect.arrayContaining([
        "bonus-2pi-a",
        "m01-bright",
        "m01-pi-a",
        "m02-pi-a",
        "m02-pi-b",
      ]),
    );
    expect(result.events).toContainEqual({
      type: "bonus-captured",
      seatId: 0,
      cardId: "bonus-2pi-a",
      source: "hand",
    });
    expect(result.events).toContainEqual({
      type: "bonus-replacement-drawn",
      seatId: 0,
      cardId: "m01-bright",
    });
    expect(result.events.some((event) => event.type === "pi-surrendered")).toBe(false);
    expect(result.state.round!.players[1].captured).toContain("m03-pi-a");
    expect(result.state.round!.players[2].captured).toContain("m06-pi-a");
    assertSessionInvariants(result.state);
  });

  it("auto-captures chained stock service cards and continues to an ordinary flip", () => {
    const state = fresh(191);
    setLayout(state, {
      hands: { 0: ["m01-bright"] },
      table: ["m01-pi-a", "m04-pi-a"],
      stockFront: ["bonus-2pi-a", "bonus-2pi-b", "m05-pi-a"],
    });
    const result = reduceSession(state, {
      type: "play-card",
      seatId: 0,
      cardId: "m01-bright",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round!.players[0].captured).toEqual(
      expect.arrayContaining(["m01-bright", "m01-pi-a", "bonus-2pi-a", "bonus-2pi-b"]),
    );
    expect(result.state.round!.tableGroups.flatMap((group) => group.cards)).toContain("m05-pi-a");
    expect(
      result.events.filter((event) => event.type === "stock-flipped").map((event) => event.cardId),
    ).toEqual(["bonus-2pi-a", "bonus-2pi-b", "m05-pi-a"]);
    expect(
      result.events.filter((event) => event.type === "bonus-captured"),
    ).toHaveLength(2);
    assertSessionInvariants(result.state);
  });

  it("keeps chained service captures when the stock ends before a hand replacement", () => {
    const state = fresh(1911);
    setLayout(state, {
      hands: { 0: ["bonus-2pi-a"] },
      table: ["m04-pi-a"],
      stockFront: ["bonus-2pi-b"],
      stockExact: true,
    });
    const result = reduceSession(state, {
      type: "play-card",
      seatId: 0,
      cardId: "bonus-2pi-a",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round!.players[0].captured).toEqual(
      expect.arrayContaining(["bonus-2pi-a", "bonus-2pi-b"]),
    );
    expect(result.state.phase).toBe("round-complete");
    expect(result.state.recentRoundSummaries.at(-1)?.result).toBe("nagari");
    expect(result.events.some((event) => event.type === "pi-surrendered")).toBe(false);
    assertSessionInvariants(result.state);
  });

  it("does not grant pi theft for a service card, but can later surrender it as valuable pi", () => {
    const state = fresh(192);
    setLayout(state, {
      hands: { 0: ["m01-pi-a"] },
      captured: { 1: ["bonus-2pi-a"], 2: ["m03-pi-a"] },
      table: ["m04-pi-a"],
      stockFront: ["m01-pi-b"],
    });
    const result = reduceSession(state, {
      type: "play-card",
      seatId: 0,
      cardId: "m01-pi-a",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const transfer = result.events.find(
      (event) => event.type === "pi-surrendered" && event.from === 1,
    );
    expect(transfer).toEqual({
      type: "pi-surrendered",
      from: 1,
      to: 0,
      cardIds: ["bonus-2pi-a"],
      effectivePi: 2,
    });
    expect(result.state.round!.players[0].captured).toContain("bonus-2pi-a");
    expect(result.state.round!.players[1].captured).not.toContain("bonus-2pi-a");
  });

  it("resolves jjok, surrenders one pi per opponent, and keeps every card unique", () => {
    const state = fresh(20);
    setLayout(state, {
      hands: { 0: ["m01-pi-a"] },
      captured: { 1: ["m02-pi-a"], 2: ["m03-pi-a"] },
      table: ["m04-pi-a"],
      stockFront: ["m01-pi-b"],
    });
    const result = reduceSession(state, { type: "play-card", seatId: 0, cardId: "m01-pi-a" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const capture = result.events.find((event) => event.type === "cards-captured");
    expect(capture && capture.type === "cards-captured" ? capture.specials : []).toContain("jjok");
    expect(result.state.round!.players[0].captured).toEqual(
      expect.arrayContaining(["m01-pi-a", "m01-pi-b", "m02-pi-a", "m03-pi-a"]),
    );
    expect(result.state.round!.players[1].captured).not.toContain("m02-pi-a");
    assertSessionInvariants(result.state);
  });

  it("creates a locked ppeok instead of capturing a hand pair plus same-month flip", () => {
    const state = fresh(21);
    setLayout(state, {
      hands: { 0: ["m01-pi-a"] },
      table: ["m01-red-poetry", "m04-pi-a"],
      stockFront: ["m01-pi-b"],
    });
    const next = accept(state, { type: "play-card", seatId: 0, cardId: "m01-pi-a" });
    const group = next.round!.tableGroups.find((candidate) => candidate.month === 1);
    expect(group?.state).toBe("locked-ppeok");
    expect(group?.cards).toHaveLength(3);
    expect(next.round!.players[0].captured).toHaveLength(0);
  });

  it("awards two surrender units for recapturing one's own ppeok", () => {
    const state = fresh(211);
    setLayout(state, {
      hands: { 0: ["m01-pi-b"] },
      captured: {
        1: ["m02-pi-a", "m02-pi-b"],
        2: ["m03-pi-a", "m03-pi-b"],
      },
      table: ["m01-bright", "m01-red-poetry", "m01-pi-a", "m04-pi-a"],
      stockFront: ["m05-pi-a"],
    });
    const locked = state.round!.tableGroups.find((group) => group.month === 1)!;
    locked.createdBySeatId = 0;
    const result = reduceSession(state, { type: "play-card", seatId: 0, cardId: "m01-pi-b" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const capture = result.events.find((event) => event.type === "cards-captured");
    expect(capture && capture.type === "cards-captured" ? capture.specials : []).toContain("self-ppeok");
    expect(result.state.round!.players[1].captured).toHaveLength(0);
    expect(result.state.round!.players[2].captured).toHaveLength(0);
  });

  it("pauses for a two-match choice, then resolves ttadak when the fourth card flips", () => {
    const state = fresh(22);
    setLayout(state, {
      hands: { 0: ["m01-bright"] },
      table: ["m01-red-poetry", "m01-pi-a", "m04-pi-a"],
      stockFront: ["m01-pi-b"],
    });
    const pending = accept(state, { type: "play-card", seatId: 0, cardId: "m01-bright" });
    expect(pending.round!.phase).toBe("awaiting-hand-match");
    expect(getLegalActions(pending, 0)).toHaveLength(2);
    const result = reduceSession(pending, {
      type: "choose-match",
      seatId: 0,
      cardId: "m01-red-poetry",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.round!.players[0].captured).toEqual(
      expect.arrayContaining(["m01-bright", "m01-red-poetry", "m01-pi-a", "m01-pi-b"]),
    );
    const capture = result.events.find((event) => event.type === "cards-captured");
    expect(capture && capture.type === "cards-captured" ? capture.specials : []).toContain("ttadak");
  });

  it("bombs an exposed fourth card and grants two skip credits", () => {
    const state = fresh(23);
    setLayout(state, {
      hands: { 0: ["m01-bright", "m01-red-poetry", "m01-pi-a"] },
      table: ["m01-pi-b", "m04-pi-a"],
      stockFront: ["m05-pi-a"],
    });
    const actions = getLegalActions(state, 0);
    expect(actions).toContainEqual({ type: "play-bomb", seatId: 0, month: 1 });
    const next = accept(state, { type: "play-bomb", seatId: 0, month: 1 });
    expect(next.round!.players[0].completedBombCount).toBe(1);
    expect(next.round!.players[0].skipHandCredits).toBe(2);
    expect(next.round!.players[0].captured).toEqual(
      expect.arrayContaining(["m01-bright", "m01-red-poetry", "m01-pi-a", "m01-pi-b"]),
    );
  });

  it("records a shake and constrains the next play to the revealed triplet", () => {
    const state = fresh(231);
    setLayout(state, {
      hands: {
        0: ["m01-bright", "m01-red-poetry", "m01-pi-a", "m02-pi-a"],
      },
      table: ["m04-pi-a"],
      stockFront: ["m05-pi-a"],
    });
    const declared = accept(state, { type: "declare-shake", seatId: 0, month: 1 });
    expect(declared.round!.players[0].declaredShakes).toHaveLength(1);
    const actions = getLegalActions(declared, 0);
    expect(actions).toHaveLength(3);
    expect(actions.every((action) => action.type === "play-card")).toBe(true);
    expect(
      actions.every(
        (action) => action.type !== "play-card" || getCard(action.cardId).month === 1,
      ),
    ).toBe(true);
  });

  it("suppresses final-draw jjok surrender while preserving the capture", () => {
    const state = fresh(232);
    setLayout(state, {
      hands: { 0: ["m01-pi-a"] },
      captured: { 1: ["m02-pi-a"], 2: ["m03-pi-a"] },
      table: ["m04-pi-a"],
      stockFront: ["m01-pi-b"],
      stockExact: true,
    });
    const result = reduceSession(state, { type: "play-card", seatId: 0, cardId: "m01-pi-a" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const capture = result.events.find((event) => event.type === "cards-captured");
    expect(capture && capture.type === "cards-captured" ? capture.specials : []).not.toContain("jjok");
    expect(result.state.round!.players[0].captured).toEqual(
      expect.arrayContaining(["m01-pi-a", "m01-pi-b"]),
    );
    expect(result.state.round!.players[1].captured).toContain("m02-pi-a");
    expect(result.state.round!.players[2].captured).toContain("m03-pi-a");
  });

  it("awards the entire Boar Pot at capture time", () => {
    const state = fresh(24);
    setLayout(state, {
      hands: { 0: ["m07-boar"] },
      table: ["m07-pi-a", "m04-pi-a"],
      stockFront: ["m05-pi-a"],
    });
    const next = accept(state, { type: "play-card", seatId: 0, cardId: "m07-boar" });
    expect(next.pot).toBe(0);
    expect(next.potContributionBySeat).toEqual({ 0: 0, 1: 0, 2: 0 });
    expect(next.seats[0].chips).toBe(52);
    expect(next.round!.boarCapturer).toBe(0);
    expect(next.round!.boarAward).toBe(3);
  });
});

describe("Go/Stop settlement", () => {
  it("caps a losing payment at the payer wallet and ends/refunds at bankruptcy", () => {
    const state = fresh(30);
    state.seats[0].chips = 100;
    state.seats[1].chips = 1;
    state.seats[2].chips = 49;
    state.pot = 0;
    state.potContributionBySeat = { 0: 0, 1: 0, 2: 0 };
    setLayout(state, {
      captured: { 0: ["m01-red-poetry", "m02-red-poetry", "m03-red-poetry"] },
    });
    state.round!.phase = "awaiting-go-stop";
    state.round!.pendingChoice = { type: "go-stop", seatId: 0, baseScore: 3 };
    const result = reduceSession(state, { type: "choose-stop", seatId: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.seats.map((seat) => seat.chips)).toEqual([104, 0, 46]);
    expect(result.state.phase).toBe("session-ended");
    const transfers = result.state.recentRoundSummaries.at(-1)!.transfers;
    expect(transfers[0]).toMatchObject({ payer: 1, owed: 3, paid: 1, shortfall: 2 });
    expect(transfers[1]).toMatchObject({ payer: 2, owed: 3, paid: 3, shortfall: 0 });
  });

  it("reassigns both loser slots to the earliest losing Go caller", () => {
    const state = fresh(31);
    state.seats[0].chips = 100;
    state.seats[1].chips = 10;
    state.seats[2].chips = 40;
    state.pot = 0;
    state.potContributionBySeat = { 0: 0, 1: 0, 2: 0 };
    setLayout(state, {
      captured: { 0: ["m01-red-poetry", "m02-red-poetry", "m03-red-poetry"] },
    });
    state.round!.players[1].goCount = 1;
    state.round!.players[1].firstGoTurn = 2;
    state.round!.phase = "awaiting-go-stop";
    state.round!.pendingChoice = { type: "go-stop", seatId: 0, baseScore: 3 };
    const result = reduceSession(state, { type: "choose-stop", seatId: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.seats.map((seat) => seat.chips)).toEqual([106, 4, 40]);
    const transfers = result.state.recentRoundSummaries.at(-1)!.transfers;
    expect(transfers[0]).toMatchObject({ payer: 1, owed: 6, paid: 6, goBak: true });
    expect(transfers[1]).toMatchObject({ payer: 2, owed: 0, paid: 0 });
  });

  it("uses the mvp-2 3-Go formula and caps the nagari exponent", () => {
    const state = fresh(32);
    const ordinaryPi = CARDS.filter((card) => card.category === "pi" && card.piValue === 1)
      .slice(0, 12)
      .map((card) => card.id);
    setLayout(state, {
      captured: {
        0: ["m01-red-poetry", "m02-red-poetry", "m03-red-poetry", ...ordinaryPi],
      },
    });
    expect(state.round!.players[0].captured).toHaveLength(15);
    state.round!.players[0].goCount = 3;
    state.round!.players[0].scoreAtLastGo = 5;
    state.round!.players[0].firstGoTurn = 1;
    state.round!.nagariStreakEnteringDeal = 4;
    state.round!.phase = "awaiting-go-stop";
    state.round!.pendingChoice = { type: "go-stop", seatId: 0, baseScore: 6 };
    const result = reduceSession(state, { type: "choose-stop", seatId: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const summary = result.state.recentRoundSummaries.at(-1)!;
    expect(summary.baseScore).toBe(6);
    expect(summary.globalExponent).toBe(4); // one from 3-Go and max three from nagari
    expect(summary.commonLiability).toBe(144); // (6 + 3) × 16
  });

  it("allocates the losing September cup defensively to avoid pi-bak", () => {
    const state = fresh(33);
    const ordinaryPi = CARDS.filter((card) => card.category === "pi" && card.piValue === 1).map(
      (card) => card.id,
    );
    const winnerPi = ordinaryPi.slice(0, 10);
    const loserPi = ordinaryPi.slice(10, 14);
    setLayout(state, {
      captured: {
        0: ["m01-red-poetry", "m02-red-poetry", "m03-red-poetry", ...winnerPi],
        1: [...loserPi, "m09-cup"],
      },
    });
    state.round!.phase = "awaiting-go-stop";
    state.round!.pendingChoice = { type: "go-stop", seatId: 0, baseScore: 4 };
    const result = reduceSession(state, { type: "choose-stop", seatId: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const payer = result.state.recentRoundSummaries.at(-1)!.transfers.find(
      (transfer) => transfer.payer === 1,
    )!;
    expect(payer.piBak).toBe(false);
    expect(payer.owed).toBe(4);
  });

  it("carries a nagari pot and applies a second ante without growing debt", () => {
    const state = fresh(34);
    setLayout(state, {
      hands: { 0: ["m01-pi-a"] },
      table: ["m01-red-poetry"],
      stockFront: ["m02-pi-a"],
      stockExact: true,
    });
    const ended = accept(state, { type: "play-card", seatId: 0, cardId: "m01-pi-a" });
    expect(ended.phase).toBe("round-complete");
    expect(ended.nagariStreak).toBe(1);
    expect(ended.pot).toBe(3);
    const result = reduceSession(
      ended,
      { type: "start-next-round", seatId: ended.dealerSeat },
      { rng: createSeededRng(3400) },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pot).toBe(6);
    expect(result.state.seats.reduce((sum, seat) => sum + seat.chips, 0)).toBe(144);
    expect(result.state.round!.nagariStreakEnteringDeal).toBe(1);
  });

  it("refunds each contribution and still ends when the next ante is impossible", () => {
    const state = fresh(35);
    state.seats[0].chips = 100;
    state.seats[1].chips = 0;
    state.seats[2].chips = 47;
    state.pot = 3;
    state.potContributionBySeat = { 0: 1, 1: 1, 2: 1 };
    state.phase = "round-complete";
    state.round!.phase = "complete";
    assertSessionInvariants(state);
    const result = reduceSession(
      state,
      { type: "start-next-round", seatId: state.dealerSeat },
      { rng: createSeededRng(3500), now: 1234 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("session-ended");
    expect(result.state.seats.map((seat) => seat.chips)).toEqual([101, 1, 48]);
    expect(result.state.pot).toBe(0);
    expect(result.state.endedAt).toBe(1234);
  });
});

describe("deterministic simulations", () => {
  it("completes seeded deals without card/chip invariant failures", () => {
    for (let seed = 1; seed <= 250; seed += 1) {
      const rng = createSeededRng(seed);
      let state = createSession({
        sessionId: `simulation-${seed}`,
        mode: "human-vs-ai",
        rng,
        dealerSeat: 0,
      });
      let accepted = 0;
      while (state.phase === "playing" && accepted < 200) {
        const seat = state.round!.currentSeat;
        const actions = getLegalActions(state, seat);
        expect(actions.length).toBeGreaterThan(0);
        const stop = actions.find((action) => action.type === "choose-stop");
        const command = stop ?? actions[rng.nextUint32() % actions.length]!;
        const result = reduceSession(state, command, { rng });
        expect(result.ok).toBe(true);
        if (!result.ok) break;
        state = result.state;
        assertSessionInvariants(state);
        accepted += 1;
      }
      expect(state.phase).not.toBe("playing");
      expect(accepted).toBeLessThan(200);
    }
  });
});
