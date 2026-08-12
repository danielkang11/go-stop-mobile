import type { PlayerCommand, PlayerView } from "@gostop/game-core";

import { evaluateAction } from "./evaluate";
import type { AiDecision, AiDecisionOptions, AiDifficulty, AiPolicy } from "./types";

function legalActions(view: PlayerView, override?: readonly PlayerCommand[]): readonly PlayerCommand[] {
  if (override) return override;
  const source = (view as unknown as { legalActions?: readonly PlayerCommand[] }).legalActions;
  return source ?? [];
}

function pickIndex(length: number, random: () => number) {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

export function decideAiAction(view: PlayerView, options: AiDecisionOptions = {}): AiDecision {
  const actions = legalActions(view, options.legalActions);
  if (actions.length === 0) throw new Error("AI cannot decide without a legal action");
  const random = options.random ?? Math.random;

  if ((options.difficulty ?? "standard") === "easy") {
    return { command: actions[pickIndex(actions.length, random)]!, score: 0, reason: "Easy AI selects a seeded random legal action" };
  }

  const ranked = actions.map((command, index) => ({ command, index, ...evaluateAction(command, view) }));
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  const bestScore = ranked[0]!.score;
  const nearBest = ranked.filter((item) => item.score >= bestScore - 3);
  const chosen = nearBest[pickIndex(nearBest.length, random)]!;
  return { command: chosen.command, score: chosen.score, reason: chosen.reason };
}

export function createAiPolicy(difficulty: AiDifficulty = "standard"): AiPolicy {
  return {
    difficulty,
    decide(view, options) {
      return decideAiAction(view, { ...options, difficulty });
    }
  };
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
