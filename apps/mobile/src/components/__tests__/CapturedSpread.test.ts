import type { UiCard } from "../../game/uiTypes";
import { groupCapturedCards } from "../../game/capturedGroups";

const card = (id: string, category: UiCard["category"], piValue = 1): UiCard => ({
  id,
  month: id === "bonus" ? null : 1,
  category,
  categoryKo: category === "bright" ? "광" : category === "animal" ? "열끗" : category === "ribbon" ? "띠" : "피",
  name: id,
  nameKo: id,
  piValue,
  bonus: id === "bonus"
});

describe("groupCapturedCards", () => {
  it("groups actual cards and preserves effective double-pi value", () => {
    const groups = groupCapturedCards([
      card("bright", "bright"),
      card("pi", "pi"),
      card("double", "pi", 2),
      card("bonus", "pi", 2)
    ]);
    expect(groups.find((group) => group.category === "bright")?.cards).toHaveLength(1);
    expect(groups.find((group) => group.category === "pi")?.cards).toHaveLength(3);
    expect(groups.find((group) => group.category === "pi")?.effectiveCount).toBe(5);
  });
});
