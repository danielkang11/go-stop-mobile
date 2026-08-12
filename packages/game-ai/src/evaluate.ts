import { CARDS, type PlayerCommand, type PlayerView } from "@gostop/game-core";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function commandType(command: PlayerCommand): string {
  return String(record(command).type ?? "");
}

function cardFor(id: unknown): UnknownRecord | undefined {
  if (typeof id !== "string") return undefined;
  const catalog = CARDS as unknown;
  if (Array.isArray(catalog)) return catalog.find((card) => String(record(card).id) === id) as UnknownRecord | undefined;
  if (catalog instanceof Map) return record(catalog.get(id));
  return record(record(catalog)[id]);
}

function publicSeats(view: PlayerView): UnknownRecord[] {
  const data = record(view);
  const seats = data.seats ?? record(data.round).players ?? data.players;
  return Array.isArray(seats) ? seats.map(record) : Object.values(record(seats)).map(record);
}

function tableCards(view: PlayerView): UnknownRecord[] {
  const data = record(view);
  const groups = data.tableGroups ?? record(data.round).tableGroups ?? data.table;
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group) => {
    const item = record(group);
    if (Array.isArray(item.cards)) return item.cards.map((id) => cardFor(typeof id === "string" ? id : record(id).id) ?? record(id));
    return [cardFor(item.id) ?? item];
  });
}

function scoreGoStop(command: PlayerCommand, view: PlayerView): { score: number; reason: string } {
  const type = commandType(command);
  if (type === "choose-stop") return { score: 82, reason: "Locks in the current payable score" };
  if (type !== "choose-go") return { score: 0, reason: "Not a Go/Stop decision" };

  const data = record(view);
  const viewer = Number(data.viewerSeat ?? data.viewerSeatId ?? data.seatId ?? -1);
  const opponents = publicSeats(view).filter((seat) => Number(seat.id ?? seat.seatId) !== viewer);
  const highestOpponent = Math.max(0, ...opponents.map((seat) => Number(seat.score ?? seat.baseScore ?? 0)));
  const stockCount = Number(data.stockCount ?? record(data.round).stockCount ?? 0);
  const own = publicSeats(view).find((seat) => Number(seat.id ?? seat.seatId) === viewer);
  const chips = Number(own?.chips ?? own?.wallet ?? 0);

  let score = 68;
  if (highestOpponent >= 2) score -= 26;
  if (stockCount <= 6) score -= 20;
  if (chips <= 8) score -= 18;
  if (stockCount >= 12 && highestOpponent === 0) score += 15;
  return { score, reason: score > 82 ? "Opponents are far behind and the stock is favorable" : "Go carries meaningful exposure" };
}

function cardActionScore(command: PlayerCommand, view: PlayerView): { score: number; reason: string } {
  const data = record(command);
  const type = commandType(command);
  const id = data.cardId;
  const card = cardFor(id);
  const month = Number(card?.month ?? 0);
  const category = String(card?.category ?? card?.kind ?? "pi");
  const matches = tableCards(view).filter((item) => Number(item.month) === month).length;

  let score = 12 + matches * 22;
  if (category === "bright") score += 19;
  if (category === "animal") score += 13;
  if (category === "ribbon") score += 8;
  if (Number(card?.piValue ?? 1) > 1) score += 7;
  if (month === 7 && category === "animal") score += 28;
  if (type === "play-bomb") score += 45;
  if (type === "declare-shake") score += 16;
  if (type === "skip-hand") score += 4;
  return {
    score,
    reason: matches > 0 ? `Captures ${matches} visible same-month card${matches > 1 ? "s" : ""}` : "Preserves a legal tempo play"
  };
}

export function evaluateAction(command: PlayerCommand, view: PlayerView): { score: number; reason: string } {
  const type = commandType(command);
  if (type === "choose-go" || type === "choose-stop") return scoreGoStop(command, view);
  if (type === "choose-match") {
    const target = cardFor(record(command).cardId);
    const category = String(target?.category ?? "pi");
    const categoryScore = category === "bright" ? 25 : category === "animal" ? 18 : category === "ribbon" ? 12 : 8;
    return { score: 30 + categoryScore + Number(target?.piValue ?? 1), reason: `Selects the stronger visible ${category} capture` };
  }
  if (type === "start-next-round") return { score: 100, reason: "Continues the funded session" };
  return cardActionScore(command, view);
}
