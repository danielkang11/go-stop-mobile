import { CUP_CARD_ID, getCard } from "./cards";
import type { CardId, ScoreBreakdown } from "./model";

export interface ScoreOptions {
  cupAllocation?: "auto" | "animal" | "pi";
}

const GODORI = ["m02-bird", "m04-bird", "m08-bird"] as const;
const HONGDAN = ["m01-red-poetry", "m02-red-poetry", "m03-red-poetry"] as const;
const CHEONGDAN = ["m06-blue-ribbon", "m09-blue-ribbon", "m10-blue-ribbon"] as const;
const CHODAN = ["m04-plain-ribbon", "m05-plain-ribbon", "m07-plain-ribbon"] as const;

function includesAll(ids: ReadonlySet<CardId>, required: readonly CardId[]): boolean {
  return required.every((cardId) => ids.has(cardId));
}

function scoreWithCupAllocation(
  cardIds: readonly CardId[],
  cupAllocation: "animal" | "pi",
): ScoreBreakdown {
  const unique = new Set(cardIds);
  if (unique.size !== cardIds.length) throw new Error("Captured cards must be unique");
  const cards = cardIds.map(getCard);
  const hasCup = unique.has(CUP_CARD_ID);

  const brightCards = cards.filter((card) => card.category === "bright");
  const brightCount = brightCards.length;
  const hasRainBright = brightCards.some((card) => card.tags.includes("rain-bright"));
  let brightPoints = 0;
  if (brightCount === 3) brightPoints = hasRainBright ? 2 : 3;
  else if (brightCount === 4) brightPoints = 4;
  else if (brightCount >= 5) brightPoints = 15;

  const printedAnimalCount = cards.filter((card) => card.category === "animal").length;
  const effectiveAnimals = printedAnimalCount - (hasCup && cupAllocation === "pi" ? 1 : 0);
  let animalPoints = effectiveAnimals >= 5 ? effectiveAnimals - 4 : 0;
  const namedCombinations: ScoreBreakdown["namedCombinations"] = [];
  if (includesAll(unique, GODORI)) {
    animalPoints += 5;
    namedCombinations.push("godori");
  }

  const ribbonCount = cards.filter((card) => card.category === "ribbon").length;
  let ribbonPoints = ribbonCount >= 5 ? ribbonCount - 4 : 0;
  if (includesAll(unique, HONGDAN)) {
    ribbonPoints += 3;
    namedCombinations.push("hongdan");
  }
  if (includesAll(unique, CHEONGDAN)) {
    ribbonPoints += 3;
    namedCombinations.push("cheongdan");
  }
  if (includesAll(unique, CHODAN)) {
    ribbonPoints += 3;
    namedCombinations.push("chodan");
  }

  const printedPi = cards.reduce((sum, card) => sum + card.piValue, 0);
  const effectivePi = printedPi + (hasCup && cupAllocation === "pi" ? 2 : 0);
  const piPoints = effectivePi >= 10 ? effectivePi - 9 : 0;
  const baseScore = brightPoints + animalPoints + ribbonPoints + piPoints;

  return {
    baseScore,
    brightPoints,
    animalPoints,
    ribbonPoints,
    piPoints,
    brightCount,
    effectiveAnimals,
    ribbonCount,
    effectivePi,
    cupAllocation,
    namedCombinations,
    hasScoringBrightCombination: brightPoints > 0,
    hasPiScore: piPoints > 0,
    meongTta: effectiveAnimals >= 7,
  };
}

export function scoreCapturedCandidates(cardIds: readonly CardId[]): ScoreBreakdown[] {
  const hasCup = cardIds.includes(CUP_CARD_ID);
  if (!hasCup) return [scoreWithCupAllocation(cardIds, "animal")];
  return [scoreWithCupAllocation(cardIds, "animal"), scoreWithCupAllocation(cardIds, "pi")];
}

/**
 * Derives all Go-Stop scoring from captured cards. In auto mode the September
 * cup chooses the higher base score; an exact tie remains an animal.
 */
export function scoreCaptured(
  cardIds: readonly CardId[],
  options: ScoreOptions = {},
): ScoreBreakdown {
  const allocation = options.cupAllocation ?? "auto";
  if (allocation !== "auto") return scoreWithCupAllocation(cardIds, allocation);
  const candidates = scoreCapturedCandidates(cardIds);
  return candidates.reduce((best, candidate) =>
    candidate.baseScore > best.baseScore ? candidate : best,
  );
}
