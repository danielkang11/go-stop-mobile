import type { UiCard } from "../uiTypes";
import { createTableLayout } from "../tableLayout";

const card = (id: string, month: number | null): UiCard => ({
  id,
  month,
  category: "pi",
  categoryKo: "피",
  name: id,
  nameKo: id,
  bonus: month === null
});

describe("createTableLayout", () => {
  const cards = [card("m03-pi-a", 3), card("m01-pi-a", 1), card("bonus-pi", null), card("m08-pi-b", 8)];

  it("is deterministic and independent of incoming card order", () => {
    const one = createTableLayout(cards, { width: 520, height: 300 });
    const two = createTableLayout([...cards].reverse(), { width: 520, height: 300 });
    expect(one).toEqual(two);
  });

  it("keeps every card inside the responsive field", () => {
    const layout = createTableLayout(cards, { width: 290, height: 180 });
    for (const placement of layout.cards) {
      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.y).toBeGreaterThanOrEqual(0);
      expect(placement.x + layout.cardWidth).toBeLessThanOrEqual(290);
      expect(placement.y + layout.cardHeight).toBeLessThanOrEqual(180);
    }
  });
});
