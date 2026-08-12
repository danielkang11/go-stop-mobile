import { describe, expect, it } from "vitest";

import {
  acceptResumeCredential,
  acknowledgeTokenRotation,
  beginTokenRotation,
  createRoomCode,
  createResumeToken,
  hashResumeToken,
  normalizeDisplayName,
  normalizeRoomCode,
  tokenHashesEqual,
} from "../src/auth";
import type { StoredSeat } from "../src/types";

describe("room and guest authentication helpers", () => {
  it("creates unambiguous eight-character room codes", () => {
    const code = createRoomCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(code).toBe("01234567");
    expect(normalizeRoomCode(code.toLowerCase())).toBe(code);
    expect(normalizeRoomCode("ROOM-123")).toBeNull();
  });

  it("normalizes controls and caps display names by grapheme", () => {
    expect(normalizeDisplayName("  민\u0000 수  ")).toBe("민 수");
    expect(normalizeDisplayName("😀".repeat(20))).toBe("😀".repeat(16));
    expect(normalizeDisplayName("\u0000\u0001")).toBeNull();
  });

  it("creates 256-bit tokens and compares only their hashes", async () => {
    const token = createResumeToken();
    const hash = await hashResumeToken(token);
    expect(token).toMatch(/^[\w-]{43}$/u);
    expect(hash).toHaveLength(64);
    expect(tokenHashesEqual(hash, await hashResumeToken(token))).toBe(true);
    expect(tokenHashesEqual(hash, "0".repeat(64))).toBe(false);
  });

  it("keeps both rotation credentials through the two disconnect windows", () => {
    const seat: StoredSeat = {
      seatId: 0,
      displayName: "Guest",
      ready: false,
      currentTokenHash: "token-a",
      overlapRecoveryUsed: false,
    };

    expect(acceptResumeCredential(seat, "token-a")).toBe("current");
    beginTokenRotation(seat, {
      hash: "token-b",
      connectionEpoch: "epoch-b",
      expiresAt: 60_000,
    });

    // If token B was never received, acknowledged token A has one recovery use.
    expect(acceptResumeCredential(seat, "token-a")).toBe("current");
    beginTokenRotation(seat, {
      hash: "token-c",
      connectionEpoch: "epoch-c",
      expiresAt: 60_001,
    });
    expect(acceptResumeCredential(seat, "token-a")).toBeNull();

    // If token C was saved but its ACK was lost, it resumes and rotates again.
    expect(acceptResumeCredential(seat, "token-c")).toBe("pending");
    beginTokenRotation(seat, {
      hash: "token-d",
      connectionEpoch: "epoch-d",
      expiresAt: 60_002,
    });
    expect(acceptResumeCredential(seat, "token-c")).toBeNull();
    expect(acknowledgeTokenRotation(seat, "wrong-epoch")).toBe(false);
    expect(acknowledgeTokenRotation(seat, "epoch-d")).toBe(true);
    expect(seat.currentTokenHash).toBe("token-d");
    expect(seat.pendingToken).toBeUndefined();
  });
});
