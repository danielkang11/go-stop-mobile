export type UiSeatId = 0 | 1 | 2;

export interface UiCard {
  id: string;
  month: number | null;
  category: "bright" | "animal" | "ribbon" | "pi";
  categoryKo: "광" | "열끗" | "띠" | "피";
  name: string;
  nameKo: string;
  bonus?: boolean | undefined;
  piValue?: number | undefined;
  isBoar?: boolean | undefined;
  tags?: readonly string[] | undefined;
}

export interface UiMotionEvent {
  id: string;
  kind: "played-card" | "stock-flip";
  actorSeatId: UiSeatId;
  cards: readonly UiCard[];
}

export interface UiSeat {
  id: UiSeatId;
  name: string;
  chips: number;
  score: number;
  goCount: number;
  handCount: number;
  captured: readonly UiCard[];
  isDealer: boolean;
  isCurrent: boolean;
  connected?: boolean | undefined;
  ready?: boolean | undefined;
  isAi?: boolean | undefined;
}

export interface UiAction {
  id: string;
  kind: "play-card" | "bomb" | "shake" | "skip" | "choose-match" | "go" | "stop" | "next-round" | "other";
  label: string;
  labelKo: string;
  cardId?: string | undefined;
  targetCardId?: string | undefined;
  raw: unknown;
}

export interface UiScoreLine {
  label: string;
  labelKo: string;
  points: number;
}

export interface UiRoundSummary {
  winnerSeatId?: UiSeatId | undefined;
  winnerName?: string | undefined;
  baseScore: number;
  payableScore: number;
  scoreLines: readonly UiScoreLine[];
  payments: readonly { from: string; requested: number; paid: number; shortfall: number }[];
  potAward?: { player: string; chips: number } | undefined;
  potCarried: number;
  nagari?: boolean | undefined;
}

export interface UiGameView {
  sessionId: string;
  revision: number;
  mode: "pass-and-play" | "human-vs-ai" | "remote";
  phase: "playing" | "round-summary" | "session-summary" | "lobby" | "loading" | "error";
  activeSeatId: UiSeatId;
  viewerSeatId: UiSeatId;
  roundNumber: number;
  stockCount: number;
  pot: number;
  table: readonly UiCard[];
  hand: readonly UiCard[];
  seats: readonly UiSeat[];
  legalActions: readonly UiAction[];
  motionEvents: readonly UiMotionEvent[];
  pendingChoice?: "match" | "go-stop" | undefined;
  recentMessage?: string | undefined;
  recentMessageKo?: string | undefined;
  roundSummary?: UiRoundSummary | undefined;
  sessionEndReason?: string | undefined;
}

export interface StartSessionOptions {
  mode: "pass-and-play" | "human-vs-ai";
  names: readonly [string, string, string];
  aiSeats?: readonly UiSeatId[] | undefined;
  difficulty?: "easy" | "standard" | undefined;
  seed?: number | undefined;
}
