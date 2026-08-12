export type SeatId = 0 | 1 | 2;
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type GameMode = "pass-and-play" | "human-vs-ai" | "remote";
export type RulesVersion = "mvp-2";
export type CardId = string;

export type CardCategory = "bright" | "animal" | "ribbon" | "pi";
export type CardTag =
  | "bright"
  | "rain-bright"
  | "animal"
  | "bird"
  | "boar"
  | "cup"
  | "ribbon"
  | "red-poetry"
  | "blue-ribbon"
  | "plain-ribbon"
  | "rain-ribbon"
  | "pi"
  | "double-pi"
  | "colored-pi"
  | "bonus"
  | "service"
  | "joker";

export interface CardDefinition {
  readonly id: CardId;
  /** Bonus/service cards have no matching month and can never fish from the table. */
  readonly month: Month | null;
  readonly category: CardCategory;
  readonly tags: readonly CardTag[];
  readonly piValue: 0 | 1 | 2;
  readonly label: string;
}

export interface Rng {
  nextUint32(): number;
}

export type SeatRecord<T> = { 0: T; 1: T; 2: T };

export interface SeatState {
  id: SeatId;
  displayName: string;
  chips: number;
}

export interface ShakeDeclaration {
  month: Month;
  revealedCardIds: [CardId, CardId, CardId];
}

export interface PlayerRoundState {
  hand: CardId[];
  captured: CardId[];
  goCount: number;
  scoreAtLastGo?: number;
  firstGoTurn?: number;
  declaredShakes: ShakeDeclaration[];
  completedBombCount: number;
  skipHandCredits: number;
  ppeokCreated: number;
}

export interface TableGroup {
  month: Month;
  cards: CardId[];
  state: "loose" | "locked-ppeok";
  createdBySeatId?: SeatId;
}

export type RoundPhase =
  | "turn"
  | "awaiting-hand-match"
  | "awaiting-stock-match"
  | "awaiting-go-stop"
  | "complete";

export type PendingChoice =
  | {
      type: "hand-match";
      seatId: SeatId;
      candidateCardIds: [CardId, CardId];
    }
  | {
      type: "stock-match";
      seatId: SeatId;
      candidateCardIds: [CardId, CardId];
    }
  | {
      type: "go-stop";
      seatId: SeatId;
      baseScore: number;
    };

export type HandStage =
  | { type: "none" }
  | { type: "placed"; cardId: CardId; month: Month }
  | {
      type: "provisional-pair";
      cardIds: [CardId, CardId];
      month: Month;
      startedWithTwoMatches: boolean;
    }
  | { type: "resolved" };

export interface TurnContext {
  actorSeat: SeatId;
  source: "normal" | "bomb" | "skip";
  playedCardIds: CardId[];
  handCardId?: CardId;
  stockCardId?: CardId;
  handStage: HandStage;
  detachedCardIds: CardId[];
  capturedThisTurn: CardId[];
  specialEvents: SpecialEventName[];
  surrenderUnitsPerOpponent: number;
  finalStockDraw: boolean;
}

export type SpecialEventName =
  | "jjok"
  | "ttadak"
  | "sweep"
  | "ppeok-capture"
  | "self-ppeok"
  | "bomb";

export interface RoundState {
  roundId: string;
  dealAttempt: number;
  phase: RoundPhase;
  stock: CardId[];
  tableGroups: TableGroup[];
  players: SeatRecord<PlayerRoundState>;
  currentSeat: SeatId;
  pendingChoice?: PendingChoice;
  turnContext?: TurnContext;
  requiredShakeMonth?: Month;
  turnNumber: number;
  boarCapturer?: SeatId;
  boarAward: number;
  nagariStreakEnteringDeal: number;
  deadlineAt?: number;
}

export interface Transfer {
  payer: SeatId;
  owed: number;
  paid: number;
  shortfall: number;
  gwangBak: boolean;
  piBak: boolean;
  goBak: boolean;
}

export interface RoundSummary {
  roundNumber: number;
  roundId: string;
  result: "stop" | "chongtong" | "nagari";
  dealerSeat: SeatId;
  winnerSeat?: SeatId;
  baseScore?: number;
  goCount?: number;
  commonLiability?: number;
  globalExponent?: number;
  transfers: Transfer[];
  boarCapturer?: SeatId;
  boarAward: number;
  potCarried: number;
  nagariStreakEnteringDeal: number;
  walletsAfter: SeatRecord<number>;
}

export interface ChipLedgerEntry {
  type: "ante" | "boar-award" | "point-payment" | "pot-refund";
  amount: number;
  from?: SeatId;
  to?: SeatId;
  roundNumber: number;
}

export type SessionPhase = "playing" | "round-complete" | "session-ended";

export interface AuthoritativeSessionState {
  schemaVersion: 1;
  rulesVersion: RulesVersion;
  sessionId: string;
  mode: GameMode;
  revision: number;
  phase: SessionPhase;
  dealerSeat: SeatId;
  roundNumber: number;
  nagariStreak: number;
  pot: number;
  potContributionBySeat: SeatRecord<number>;
  antePostedForDeal: boolean;
  seats: [SeatState, SeatState, SeatState];
  round?: RoundState;
  currentRoundLedger: ChipLedgerEntry[];
  recentRoundSummaries: RoundSummary[];
  endReason?: "player-cannot-ante";
  endedAt?: number;
}

export type PlayerCommand =
  | { type: "declare-shake"; seatId: SeatId; month: Month }
  | { type: "play-card"; seatId: SeatId; cardId: CardId }
  | { type: "play-bomb"; seatId: SeatId; month: Month }
  | { type: "skip-hand"; seatId: SeatId }
  | { type: "choose-match"; seatId: SeatId; cardId: CardId }
  | { type: "choose-go"; seatId: SeatId }
  | { type: "choose-stop"; seatId: SeatId }
  | { type: "start-next-round"; seatId: SeatId };

export type DomainEvent =
  | { type: "session-created"; dealerSeat: SeatId }
  | { type: "ante-posted"; amountPerSeat: 1; pot: number }
  | { type: "deal-started"; roundNumber: number; dealAttempt: number; dealerSeat: SeatId }
  | { type: "administrative-redeal"; reason: "four-on-table" | "multiple-chongtong"; dealAttempt: number }
  | { type: "shake-declared"; seatId: SeatId; month: Month; cardIds: [CardId, CardId, CardId] }
  | { type: "cards-played"; seatId: SeatId; cardIds: CardId[]; action: "normal" | "bomb" | "skip" }
  | { type: "stock-flipped"; seatId: SeatId; cardId: CardId }
  | { type: "bonus-replacement-drawn"; seatId: SeatId; cardId: CardId }
  | {
      type: "bonus-captured";
      seatId: SeatId;
      cardId: CardId;
      source: "initial-table" | "hand" | "stock";
    }
  | { type: "cards-captured"; seatId: SeatId; cardIds: CardId[]; specials: SpecialEventName[] }
  | { type: "ppeok-created"; seatId: SeatId; month: Month; cardIds: CardId[] }
  | { type: "pi-surrendered"; from: SeatId; to: SeatId; cardIds: CardId[]; effectivePi: number }
  | { type: "boar-pot-awarded"; capturer: SeatId; award: number }
  | { type: "go-declared"; seatId: SeatId; goCount: number; baseScore: number }
  | { type: "round-ended"; summary: RoundSummary }
  | { type: "pot-refunded"; refunds: SeatRecord<number> }
  | { type: "session-ended"; reason: "player-cannot-ante" };

export type PlayerVisibleEvent = DomainEvent;

export interface ScoreBreakdown {
  baseScore: number;
  brightPoints: number;
  animalPoints: number;
  ribbonPoints: number;
  piPoints: number;
  brightCount: number;
  effectiveAnimals: number;
  ribbonCount: number;
  effectivePi: number;
  cupAllocation: "animal" | "pi";
  namedCombinations: ("godori" | "hongdan" | "cheongdan" | "chodan")[];
  hasScoringBrightCombination: boolean;
  hasPiScore: boolean;
  meongTta: boolean;
}

export interface PublicPlayerRoundView {
  seatId: SeatId;
  handCount: number;
  captured: CardId[];
  score: ScoreBreakdown;
  goCount: number;
  declaredShakes: ShakeDeclaration[];
  completedBombCount: number;
  skipHandCredits: number;
}

export interface PlayerRoundView {
  roundId: string;
  dealAttempt: number;
  phase: RoundPhase;
  stockCount: number;
  tableGroups: TableGroup[];
  players: [PublicPlayerRoundView, PublicPlayerRoundView, PublicPlayerRoundView];
  currentSeat: SeatId;
  turnNumber: number;
  boarCapturer?: SeatId;
  boarAward: number;
  pendingChoice?: PendingChoice;
  activeTurn?: {
    source: "normal" | "bomb" | "skip";
    playedCardIds: CardId[];
    stockCardId?: CardId;
  };
  turnDeadlineAt?: number;
}

export interface PlayerView {
  schemaVersion: 1;
  rulesVersion: RulesVersion;
  sessionId: string;
  mode: GameMode;
  revision: number;
  phase: SessionPhase;
  viewerSeat: SeatId;
  dealerSeat: SeatId;
  roundNumber: number;
  nagariStreak: number;
  wallets: SeatRecord<number>;
  pot: number;
  ownHand: CardId[];
  round?: PlayerRoundView;
  legalActions: PlayerCommand[];
  recentRoundSummaries: RoundSummary[];
  endReason?: "player-cannot-ante";
}

export interface CommandError {
  code:
    | "illegal-command"
    | "wrong-phase"
    | "wrong-seat"
    | "invalid-card"
    | "invalid-choice"
    | "rng-required";
  message: string;
}

export type ReduceResult =
  | { ok: true; state: AuthoritativeSessionState; events: DomainEvent[] }
  | { ok: false; state: AuthoritativeSessionState; error: CommandError };

export interface CreateSessionOptions {
  sessionId: string;
  mode: GameMode;
  rng: Rng;
  dealerSeat?: SeatId;
  displayNames?: [string, string, string];
  now?: number;
}

export interface ReduceDependencies {
  rng?: Rng;
  now?: number;
}
