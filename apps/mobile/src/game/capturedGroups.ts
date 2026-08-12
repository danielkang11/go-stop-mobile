import type { UiCard } from "./uiTypes";

const CATEGORIES: readonly UiCard["category"][] = ["bright", "animal", "ribbon", "pi"];

export interface CapturedGroup {
  category: UiCard["category"];
  cards: readonly UiCard[];
  effectiveCount: number;
}

export function groupCapturedCards(cards: readonly UiCard[]): CapturedGroup[] {
  return CATEGORIES.map((category) => {
    const grouped = cards
      .filter((card) => card.category === category)
      .sort((left, right) => (left.month ?? 99) - (right.month ?? 99) || left.id.localeCompare(right.id));
    return {
      category,
      cards: grouped,
      effectiveCount: grouped.reduce((total, card) => total + (category === "pi" ? card.piValue ?? 1 : 1), 0)
    };
  });
}
