import { getAdministrativeNextRoundAction, getViewerSeatForState } from "../LocalGameController";

describe("AI round boundaries", () => {
  it("lets the session UI advance when an AI is the next dealer", () => {
    const action = getAdministrativeNextRoundAction(
      { phase: "round-complete", dealerSeat: 2 },
      "human-vs-ai"
    );
    expect(action?.kind).toBe("next-round");
    expect(action?.raw).toEqual({ type: "start-next-round", seatId: 2 });
  });

  it("does not impersonate a dealer in pass-and-play", () => {
    expect(getAdministrativeNextRoundAction(
      { phase: "round-complete", dealerSeat: 1 },
      "pass-and-play"
    )).toBeUndefined();
  });

  it("hands a completed pass-and-play round to the dealer, including nagari", () => {
    expect(getViewerSeatForState(
      { phase: "round-complete", dealerSeat: 1, round: { currentSeat: 0 } },
      "pass-and-play"
    )).toBe(1);
  });
});
