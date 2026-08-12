import {
  createSeededRng,
  createSession,
  type DomainEvent,
} from "@gostop/game-core";
import { describe, expect, it } from "vitest";

import {
  broadcastSnapshots,
  projectRoomForSeat,
} from "../src/projection-broadcast";
import type { StoredRoom } from "../src/types";

function activeRoom(): StoredRoom {
  const state = createSession({
    sessionId: "projection-test",
    mode: "remote",
    rng: createSeededRng(42),
    now: 1_000,
  });
  expect(state.round).toBeDefined();
  return {
      schemaVersion: 1,
      protocolVersion: 1,
      rulesVersion: "mvp-2",
      roomCode: "0123ABCD",
      revision: 7,
      lifecycle: "active",
      turnDeadlineAt: 90_000,
      state,
      seats: [
        {
          seatId: 0,
          displayName: "One",
          ready: true,
          currentTokenHash: "hash-0",
          overlapRecoveryUsed: false,
          connectionEpoch: "epoch-0",
        },
        {
          seatId: 1,
          displayName: "Two",
          ready: true,
          currentTokenHash: "hash-1",
          overlapRecoveryUsed: false,
          connectionEpoch: "epoch-1",
        },
        {
          seatId: 2,
          displayName: "Three",
          ready: true,
          currentTokenHash: "hash-2",
          overlapRecoveryUsed: false,
          connectionEpoch: "epoch-2",
        },
      ],
      recentCommandResults: [],
      createdAt: 1_000,
      lastActivityAt: 1_000,
      expiresAt: 0,
  };
}

describe("final relay projection", () => {
  it("includes only the viewer's hand and never the stock order", () => {
    const room = activeRoom();
    const state = room.state!;

    const encoded = JSON.stringify(projectRoomForSeat(room, 0));
    for (const ownCard of state.round!.players[0].hand) {
      expect(encoded).toContain(`"${ownCard}"`);
    }
    const concealed = [
      ...state.round!.players[1].hand,
      ...state.round!.players[2].hand,
      ...state.round!.stock,
    ];
    for (const hiddenCard of concealed) {
      expect(encoded).not.toContain(`"${hiddenCard}"`);
    }
    expect(JSON.parse(encoded)).toMatchObject({
      revision: 7,
      round: { turnDeadlineAt: 90_000 },
    });
  });

  it("preserves ordered public play, flip, and bonus events in the encoded snapshot", () => {
    const room = activeRoom();
    const sent: string[] = [];
    const socket = {
      deserializeAttachment: () => ({
        connectionId: "connection-0",
        seatId: 0,
        connectionEpoch: "epoch-0",
      }),
      send: (frame: string) => sent.push(frame),
    } as unknown as WebSocket;
    const events: DomainEvent[] = [
      {
        type: "cards-played",
        seatId: 0,
        cardIds: ["m01-pi-a"],
        action: "normal",
      },
      { type: "stock-flipped", seatId: 0, cardId: "bonus-2pi-a" },
      {
        type: "bonus-captured",
        seatId: 0,
        cardId: "bonus-2pi-a",
        source: "stock",
      },
    ];

    broadcastSnapshots([socket], room, events, 2_000);

    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]!).events).toEqual(events);
  });
});
