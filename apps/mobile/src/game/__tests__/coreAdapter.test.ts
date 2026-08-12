import { normalizeMotionEvents } from "../coreAdapter";

describe("normalizeMotionEvents", () => {
  it("keeps reducer order for played and stock cards", () => {
    const events = normalizeMotionEvents([
      { type: "cards-played", seatId: 1, cardIds: ["m03-pi-a"] },
      { type: "stock-flipped", seatId: 1, cardId: "m07-boar" }
    ], 8);
    expect(events.map((event) => event.kind)).toEqual(["played-card", "stock-flip"]);
    expect(events[0]?.actorSeatId).toBe(1);
    expect(events[1]?.cards[0]?.id).toBe("m07-boar");
    expect(events.every((event) => event.id.startsWith("8:"))).toBe(true);
  });

  it("animates a bonus hand replacement as a draw from the stock", () => {
    const [event] = normalizeMotionEvents([
      { type: "bonus-replacement-drawn", seatId: 0, cardId: "m04-bird" }
    ], 12);
    expect(event?.kind).toBe("stock-flip");
    expect(event?.cards[0]?.month).toBe(4);
  });

});
