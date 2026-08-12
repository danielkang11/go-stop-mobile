import * as Core from "@gostop/game-core";

import type { StartSessionOptions, UiAction, UiCard, UiGameView, UiMotionEvent, UiRoundSummary, UiSeat, UiSeatId } from "./uiTypes";

type UnknownRecord = Record<string, unknown>;

interface CoreApi {
  CARDS: unknown;
  createSeededRng(seed: number): unknown;
  createSession(options: {
    sessionId: string;
    mode: StartSessionOptions["mode"] | "remote";
    rng: unknown;
    dealerSeat?: UiSeatId | undefined;
    displayNames?: [string, string, string] | undefined;
    now?: number | undefined;
  }): unknown;
  reduceSession(
    state: unknown,
    command: unknown,
    deps?: { rng?: unknown; now?: number | undefined }
  ): { ok: boolean; state: unknown; events?: readonly unknown[]; error?: unknown };
  getLegalActions(state: unknown, seatId: UiSeatId): readonly unknown[];
  projectPlayerView(state: unknown, seatId: UiSeatId): unknown;
}

export const core = Core as unknown as CoreApi;

export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function seatId(value: unknown, fallback: UiSeatId = 0): UiSeatId {
  const parsed = number(value, fallback);
  return parsed === 1 || parsed === 2 ? parsed : 0;
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return Object.values(asRecord(value));
}

function cardCatalog(): unknown[] {
  const catalog = core.CARDS;
  if (Array.isArray(catalog)) return catalog;
  if (catalog instanceof Map) return [...catalog.values()];
  return Object.values(asRecord(catalog));
}

function parseCategory(value: unknown): UiCard["category"] {
  const raw = String(value ?? "pi").toLowerCase();
  if (raw.includes("bright") || raw === "gwang" || raw === "광") return "bright";
  if (raw.includes("animal") || raw.includes("yeol") || raw === "열끗") return "animal";
  if (raw.includes("ribbon") || raw === "tti" || raw === "띠") return "ribbon";
  return "pi";
}

const categoryKo: Record<UiCard["category"], UiCard["categoryKo"]> = {
  bright: "광",
  animal: "열끗",
  ribbon: "띠",
  pi: "피"
};

export function normalizeCard(value: unknown): UiCard {
  const source = asRecord(value);
  const rawId = String(source.id ?? source.cardId ?? value ?? "unknown");
  const found = cardCatalog().map(asRecord).find((item) => String(item.id ?? item.cardId) === rawId);
  const card = found ?? source;
  const match = rawId.match(/(?:^|\D)(1[0-2]|0?[1-9])(?:\D|$)/);
  const bonus = Boolean(card.bonus) || card.month === null || tagsIncludeBonus(card.tags);
  const month = bonus ? null : number(card.month, match ? Number(match[1]) : 1);
  const category = parseCategory(card.category ?? card.kind ?? card.type);
  const tags = array(card.tags).map(String);
  const isBoar = Boolean(card.isBoar) || (month === 7 && category === "animal") || tags.some((tag) => tag.toLowerCase().includes("boar"));
  return {
    id: rawId,
    month,
    category,
    categoryKo: categoryKo[category],
    name: String(card.name ?? card.label ?? (bonus ? `Bonus ${category}` : `${month} ${category}`)),
    nameKo: String(card.nameKo ?? (bonus ? `보너스 ${categoryKo[category]}` : `${month}월 ${categoryKo[category]}`)),
    bonus,
    piValue: number(card.piValue, 1),
    isBoar,
    tags
  };
}

function tagsIncludeBonus(value: unknown): boolean {
  return array(value).some((tag) => String(tag).toLowerCase().includes("bonus"));
}

export function normalizeMotionEvents(rawEvents: unknown, revision: number): UiMotionEvent[] {
  return array(rawEvents).flatMap((value, index): UiMotionEvent[] => {
    const event = asRecord(value);
    const type = String(event.type ?? "");
    const actorSeatId = seatId(event.seatId ?? event.actorSeat ?? event.actor, 0);
    if (type === "cards-played") {
      const cards = array(event.cardIds ?? event.cards).map(normalizeCard);
      if (cards.length === 0) return [];
      return [{
        id: `${revision}:${index}:played:${cards.map((card) => card.id).join(",")}`,
        kind: "played-card",
        actorSeatId,
        cards
      }];
    }
    if (type === "stock-flipped" || type === "bonus-replacement-drawn") {
      const rawCard = event.cardId ?? event.card;
      if (rawCard === undefined) return [];
      const card = normalizeCard(rawCard);
      return [{
        id: `${revision}:${index}:stock:${card.id}`,
        kind: "stock-flip",
        actorSeatId,
        cards: [card]
      }];
    }
    return [];
  });
}

function describeEvents(rawEvents: unknown, names: readonly string[]): { en: string; ko: string } | undefined {
  const events = array(rawEvents).map(asRecord);
  const captured = [...events].reverse().find((event) => event.type === "cards-captured");
  if (captured) {
    const actor = names[seatId(captured.seatId)] ?? "Player";
    const count = array(captured.cardIds ?? captured.cards).length;
    const specials = array(captured.specials).map(String);
    const suffix = specials.length ? ` · ${specials.join(" · ")}` : "";
    return { en: `${actor} captured ${count} card${count === 1 ? "" : "s"}${suffix}`, ko: `${actor} · ${count}장 획득${suffix}` };
  }
  const flipped = [...events].reverse().find((event) => event.type === "stock-flipped");
  if (flipped) {
    const card = normalizeCard(flipped.cardId ?? flipped.card);
    return {
      en: `Stock revealed ${card.bonus ? "a bonus card" : `month ${card.month}`}`,
      ko: `더미에서 ${card.bonus ? "보너스 패" : `${card.month}월 패`} 공개`
    };
  }
  return undefined;
}

function actionKind(type: string): UiAction["kind"] {
  if (type === "play-card") return "play-card";
  if (type === "play-bomb") return "bomb";
  if (type === "declare-shake") return "shake";
  if (type === "skip-hand") return "skip";
  if (type === "choose-match") return "choose-match";
  if (type === "choose-go") return "go";
  if (type === "choose-stop") return "stop";
  if (type === "start-next-round") return "next-round";
  return "other";
}

export function normalizeAction(value: unknown, index = 0): UiAction {
  const command = asRecord(value);
  const type = String(command.type ?? command.kind ?? "other");
  const kind = actionKind(type);
  const labels: Record<UiAction["kind"], [string, string]> = {
    "play-card": ["Play card", "패 내기"],
    bomb: ["Bomb", "폭탄"],
    shake: ["Shake", "흔들기"],
    skip: ["Skip hand", "패 건너뛰기"],
    "choose-match": ["Choose this card", "이 패 선택"],
    go: ["Go", "고"],
    stop: ["Stop", "스톱"],
    "next-round": ["Next round", "다음 판"],
    other: [type.replaceAll("-", " "), type]
  };
  return {
    id: `${type}:${String(command.cardId ?? command.month ?? index)}`,
    kind,
    label: labels[kind][0],
    labelKo: labels[kind][1],
    cardId: typeof command.cardId === "string" ? command.cardId : undefined,
    targetCardId: typeof command.targetCardId === "string" ? command.targetCardId : undefined,
    raw: value
  };
}

function cardsFromGroups(value: unknown): UiCard[] {
  return array(value).flatMap((group) => {
    const source = asRecord(group);
    const cards = source.cards ?? source.cardIds;
    if (cards) return array(cards).map(normalizeCard);
    return [normalizeCard(group)];
  });
}

function capturedFor(view: UnknownRecord, seat: UiSeatId, player: UnknownRecord): UiCard[] {
  const captures = player.captured ?? asRecord(view.capturedBySeat)[seat] ?? array(view.captured)[seat];
  return array(captures).map(normalizeCard);
}

function summarizeRound(view: UnknownRecord, names: readonly string[]): UiRoundSummary | undefined {
  const source = asRecord(view.roundSummary ?? view.latestRoundSummary ?? array(view.recentRoundSummaries).at(-1));
  if (Object.keys(source).length === 0) return undefined;
  const winner = source.winnerSeatId ?? source.winnerSeat ?? source.winner;
  const winnerId = winner === undefined ? undefined : seatId(winner);
  const player = winnerId === undefined ? {} : asRecord(array(asRecord(view.round).players)[winnerId]);
  const score = asRecord(player.score);
  const scoreLines = [
    ["Brights", "광", score.brightPoints],
    ["Animals", "열끗", score.animalPoints],
    ["Ribbons", "띠", score.ribbonPoints],
    ["Pi", "피", score.piPoints]
  ].filter((line) => number(line[2]) > 0).map((line) => ({ label: String(line[0]), labelKo: String(line[1]), points: number(line[2]) }));
  return {
    winnerSeatId: winnerId,
    winnerName: winnerId === undefined ? undefined : names[winnerId],
    baseScore: number(source.baseScore ?? source.winnerBaseScore ?? source.points),
    payableScore: number(source.payableScore ?? source.nominalPayableScore ?? source.commonLiability ?? source.totalPoints ?? source.points),
    scoreLines: array(source.scoreLines ?? source.scoreBreakdown).length ? array(source.scoreLines ?? source.scoreBreakdown).map((line) => {
      const item = asRecord(line);
      return {
        label: String(item.label ?? item.category ?? "Score"),
        labelKo: String(item.labelKo ?? item.categoryKo ?? item.label ?? "점수"),
        points: number(item.points ?? item.score)
      };
    }) : scoreLines,
    payments: array(source.payments ?? source.settlement ?? source.transfers).map((payment) => {
      const item = asRecord(payment);
      const from = seatId(item.fromSeatId ?? item.fromSeat ?? item.payer ?? 0);
      return {
        from: names[from] ?? `Player ${from + 1}`,
        requested: number(item.requested ?? item.liability ?? item.owed),
        paid: number(item.paid ?? item.amount),
        shortfall: number(item.shortfall)
      };
    }),
    potAward: source.potAward && typeof source.potAward === "object"
      ? {
          player: names[seatId(asRecord(source.potAward).seatId)] ?? "Player",
          chips: number(asRecord(source.potAward).chips ?? asRecord(source.potAward).amount)
        }
      : number(source.boarAward) > 0
        ? { player: names[seatId(source.boarCapturer)] ?? "Player", chips: number(source.boarAward) }
      : undefined,
    potCarried: number(source.potCarried ?? source.pot),
    nagari: Boolean(source.nagari ?? source.isNagari ?? source.result === "nagari")
  };
}

function normalizePhase(rawPhase: unknown, hasSummary: boolean): UiGameView["phase"] {
  const phase = String(rawPhase ?? "playing").toLowerCase();
  if (phase.includes("session") && (phase.includes("end") || phase.includes("complete"))) return "session-summary";
  if ((hasSummary && phase !== "playing") || phase.includes("round-summary") || phase.includes("round-complete") || phase.includes("round_end") || phase === "round-ended") return "round-summary";
  if (phase.includes("lobby")) return "lobby";
  if (phase.includes("error")) return "error";
  return "playing";
}

export function normalizeView(
  projected: unknown,
  names: readonly [string, string, string],
  mode: UiGameView["mode"],
  fallbackViewer: UiSeatId,
  state?: unknown,
  rawEvents: unknown = []
): UiGameView {
  const view = asRecord(projected);
  const stateRecord = asRecord(state);
  const round = asRecord(view.round ?? stateRecord.round);
  const viewer = seatId(view.viewerSeat ?? view.viewerSeatId ?? view.seatId, fallbackViewer);
  const current = seatId(view.currentSeat ?? round.currentSeat ?? stateRecord.currentSeat, viewer);
  const dealer = seatId(view.dealerSeat ?? stateRecord.dealerSeat, 0);
  const playersValue = view.seats ?? view.players ?? round.players;
  const players = Array.isArray(playersValue) ? playersValue : [0, 1, 2].map((id) => asRecord(playersValue)[id]);
  const wallets = view.wallets ?? stateRecord.wallets ?? asRecord(stateRecord).seats;
  const scores = view.scores ?? round.scores;

  const seats = [0, 1, 2].map((id): UiSeat => {
    const seat = id as UiSeatId;
    const player = asRecord(players[id]);
    const walletValue = Array.isArray(wallets) ? wallets[id] : asRecord(wallets)[id];
    const wallet = typeof walletValue === "object" ? asRecord(walletValue).chips : walletValue;
    const scoreValue = Array.isArray(scores) ? scores[id] : asRecord(scores)[id];
    return {
      id: seat,
      name: names[seat] || `Player ${seat + 1}`,
      chips: number(player.chips ?? player.wallet ?? wallet, 50),
      score: number(asRecord(player.score).baseScore ?? player.baseScore ?? scoreValue),
      goCount: number(player.goCount),
      handCount: number(player.handCount ?? array(player.hand).length ?? (seat === viewer ? array(view.ownHand).length : 0)),
      captured: capturedFor(view, seat, player),
      isDealer: seat === dealer,
      isCurrent: seat === current,
      connected: player.connected === undefined ? true : Boolean(player.connected),
      ready: Boolean(player.ready),
      isAi: Boolean(player.isAi)
    };
  }) as [UiSeat, UiSeat, UiSeat];

  const ownHand = view.ownHand ?? view.hand ?? asRecord(players[viewer]).hand;
  const legal = view.legalActions ?? (state ? core.getLegalActions(state, viewer) : []);
  const rawPhase = view.phase ?? stateRecord.phase ?? round.phase;
  const summary = String(rawPhase).includes("round-complete") || String(rawPhase).includes("session-ended") ? summarizeRound(view, names) : undefined;
  const pending = asRecord(view.pendingChoice ?? round.pendingChoice);
  const pendingType = String(pending.type ?? view.phase ?? "").toLowerCase();
  const eventDescription = describeEvents(rawEvents, names);

  return {
    sessionId: String(view.sessionId ?? stateRecord.sessionId ?? "session"),
    revision: number(view.revision ?? stateRecord.revision),
    mode,
    phase: normalizePhase(rawPhase, Boolean(summary)),
    activeSeatId: current,
    viewerSeatId: viewer,
    roundNumber: number(view.roundNumber ?? stateRecord.roundNumber, 1),
    stockCount: number(view.stockCount ?? round.stockCount ?? array(round.stock).length),
    pot: number(view.pot ?? stateRecord.pot),
    table: cardsFromGroups(view.tableGroups ?? view.table ?? round.tableGroups),
    hand: array(ownHand).map(normalizeCard),
    seats,
    legalActions: array(legal).map(normalizeAction),
    motionEvents: normalizeMotionEvents(rawEvents, number(view.revision ?? stateRecord.revision)),
    pendingChoice: pendingType.includes("match") ? "match" : pendingType.includes("go") || pendingType.includes("stop") ? "go-stop" : undefined,
    recentMessage: String(view.recentMessage ?? eventDescription?.en ?? ""),
    recentMessageKo: String(view.recentMessageKo ?? eventDescription?.ko ?? view.recentMessage ?? ""),
    roundSummary: summary,
    sessionEndReason: typeof (view.sessionEndReason ?? view.endReason) === "string" ? String(view.sessionEndReason ?? view.endReason) : undefined
  };
}

export function makeSessionId(prefix = "local") {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}
