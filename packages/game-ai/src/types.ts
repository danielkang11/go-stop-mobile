import type { PlayerCommand, PlayerView } from "@gostop/game-core";

export type AiDifficulty = "easy" | "standard";

export interface AiDecisionOptions {
  difficulty?: AiDifficulty;
  /** Injected for deterministic simulations; must return a number in [0, 1). */
  random?: () => number;
  legalActions?: readonly PlayerCommand[];
}

export interface AiDecision {
  command: PlayerCommand;
  score: number;
  reason: string;
}

export interface AiPolicy {
  readonly difficulty: AiDifficulty;
  decide(view: PlayerView, options?: Omit<AiDecisionOptions, "difficulty">): AiDecision;
}
