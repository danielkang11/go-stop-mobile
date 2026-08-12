import { describe, expect, it } from "vitest";

import {
  applyTokenOverlapDeadlines,
  earliestAlarmAt,
  releaseExpiredLobbySeats,
  retentionExpired,
} from "../src/expiry";
import type { StoredRoom, StoredSeat } from "../src/types";

function seat(seatId: 0 | 1 | 2): StoredSeat {
  return {
    seatId,
    displayName: `Guest ${seatId}`,
    ready: false,
    currentTokenHash: `old-${seatId}`,
    overlapRecoveryUsed: false,
  };
}

function room(): StoredRoom {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    rulesVersion: "mvp-2",
    roomCode: "0123ABCD",
    revision: 0,
    lifecycle: "lobby",
    state: null,
    seats: [seat(0), null, null],
    recentCommandResults: [],
    createdAt: 1,
    lastActivityAt: 1,
    expiresAt: 1_000,
  };
}

describe("room deadline handling", () => {
  it("selects the earliest public or private deadline", () => {
    const value = room();
    value.turnDeadlineAt = 900;
    value.seats[0]!.pendingToken = {
      hash: "next",
      connectionEpoch: "epoch",
      expiresAt: 800,
    };
    value.seats[0]!.reservationExpiresAt = 700;
    expect(earliestAlarmAt(value)).toBe(700);
  });

  it("promotes a pending token exactly at overlap expiry", () => {
    const value = room();
    value.seats[0]!.pendingToken = {
      hash: "next",
      connectionEpoch: "epoch",
      expiresAt: 500,
    };
    expect(applyTokenOverlapDeadlines(value, 499)).toBe(false);
    expect(applyTokenOverlapDeadlines(value, 500)).toBe(true);
    expect(value.seats[0]!.currentTokenHash).toBe("next");
    expect(value.seats[0]!.pendingToken).toBeUndefined();
  });

  it("releases only elapsed disconnected lobby reservations", () => {
    const value = room();
    value.seats[0]!.reservationExpiresAt = 500;
    expect(releaseExpiredLobbySeats(value, 499)).toBe(false);
    expect(releaseExpiredLobbySeats(value, 500)).toBe(true);
    expect(value.seats[0]).toBeNull();
  });

  it("treats a zero retention deadline as no absolute expiry", () => {
    const value = room();
    value.expiresAt = 0;
    expect(retentionExpired(value, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});
