import { describe, expect, it } from "vitest";
import { CARDS, scoreCaptured } from "../src/index";

describe("50-card mvp-2 catalog", () => {
  it("contains 48 month cards plus exactly two 2-pi service cards", () => {
    expect(CARDS).toHaveLength(50);
    expect(new Set(CARDS.map((card) => card.id)).size).toBe(50);
    for (let month = 1; month <= 12; month += 1) {
      expect(CARDS.filter((card) => card.month === month)).toHaveLength(4);
    }
    expect(CARDS.filter((card) => card.category === "bright")).toHaveLength(5);
    expect(CARDS.filter((card) => card.category === "animal")).toHaveLength(9);
    expect(CARDS.filter((card) => card.category === "ribbon")).toHaveLength(10);
    expect(CARDS.filter((card) => card.category === "pi")).toHaveLength(26);
    expect(CARDS.filter((card) => card.tags.includes("boar"))).toHaveLength(1);
    const bonusCards = CARDS.filter((card) => card.tags.includes("bonus"));
    expect(bonusCards).toHaveLength(2);
    expect(bonusCards.every((card) => card.month === null && card.piValue === 2)).toBe(true);
  });
});

describe("mvp-2 scoring", () => {
  it("scores bright sets, including rain and five-bright rules", () => {
    expect(scoreCaptured(["m01-bright", "m03-bright", "m08-bright"]).brightPoints).toBe(3);
    expect(scoreCaptured(["m01-bright", "m03-bright", "m12-rain-bright"]).brightPoints).toBe(2);
    expect(
      scoreCaptured(["m01-bright", "m03-bright", "m08-bright", "m11-bright"]).brightPoints,
    ).toBe(4);
    expect(
      scoreCaptured([
        "m01-bright",
        "m03-bright",
        "m08-bright",
        "m11-bright",
        "m12-rain-bright",
      ]).brightPoints,
    ).toBe(15);
  });

  it("adds category thresholds and named animal/ribbon combinations", () => {
    const animals = scoreCaptured([
      "m02-bird",
      "m04-bird",
      "m05-animal",
      "m06-animal",
      "m08-bird",
      "m10-animal",
      "m12-animal",
    ]);
    expect(animals.animalPoints).toBe(8); // 3 count points + 5 godori
    expect(animals.meongTta).toBe(true);
    expect(animals.namedCombinations).toContain("godori");

    const ribbons = scoreCaptured([
      "m01-red-poetry",
      "m02-red-poetry",
      "m03-red-poetry",
      "m04-plain-ribbon",
      "m05-plain-ribbon",
    ]);
    expect(ribbons.ribbonPoints).toBe(4); // 1 count point + 3 hongdan
    expect(ribbons.namedCombinations).toContain("hongdan");
  });

  it("counts ordinary, double pi, and auto-allocates the September cup", () => {
    const tenPi = CARDS.filter((card) => card.category === "pi" && card.piValue === 1)
      .slice(0, 10)
      .map((card) => card.id);
    expect(scoreCaptured(tenPi).piPoints).toBe(1);
    expect(scoreCaptured([...tenPi, "m11-double-pi"]).piPoints).toBe(3);

    const ninePi = tenPi.slice(0, 9);
    const cupAsPi = scoreCaptured([...ninePi, "m09-cup"]);
    expect(cupAsPi.cupAllocation).toBe("pi");
    expect(cupAsPi.effectivePi).toBe(11);
    expect(cupAsPi.piPoints).toBe(2);
  });

  it("counts each service card as exactly two effective pi", () => {
    const ordinaryPi = CARDS.filter(
      (card) => card.category === "pi" && card.piValue === 1,
    )
      .slice(0, 6)
      .map((card) => card.id);
    const score = scoreCaptured([...ordinaryPi, "bonus-2pi-a", "bonus-2pi-b"]);
    expect(score.effectivePi).toBe(10);
    expect(score.piPoints).toBe(1);
  });
});
