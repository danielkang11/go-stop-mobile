import {
  PROTOCOL_VERSION,
  RULES_VERSION,
  encodeServerMessage,
  type JsonValue,
  type RemoteSnapshot,
  type SeatId,
  type ServerMessage,
} from "@gostop/protocol";

import { projectSeatEvents, projectSeatView } from "./engine-adapter";
import type { SocketAttachment, StoredRoom } from "./types";

export function readSocketAttachment(socket: WebSocket): SocketAttachment | null {
  const value = socket.deserializeAttachment() as unknown;
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const candidate = value as Partial<SocketAttachment>;
  if (typeof candidate.connectionId !== "string") {
    return null;
  }
  if (
    candidate.seatId !== undefined &&
    candidate.seatId !== 0 &&
    candidate.seatId !== 1 &&
    candidate.seatId !== 2
  ) {
    return null;
  }
  return candidate as SocketAttachment;
}

function jsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

export function projectRoomForSeat(room: StoredRoom, seatId: SeatId): RemoteSnapshot {
  if (room.lifecycle === "lobby" || room.state === null) {
    return {
      kind: "lobby",
      roomCode: room.roomCode,
      selfSeatId: seatId,
      seats: room.seats.flatMap((seat) =>
        seat === null
          ? []
          : [
              {
                seatId: seat.seatId,
                displayName: seat.displayName,
                ready: seat.ready,
                connected: seat.disconnectedAt === undefined,
              },
            ],
      ),
    };
  }
  const projected = jsonValue(projectSeatView(room.state, seatId));
  if (typeof projected !== "object" || projected === null || Array.isArray(projected)) {
    return projected;
  }

  // Relay revisions include lobby commands, so the wire projection uses the
  // authoritative room revision rather than the engine's internal reduction count.
  const projectedObject = projected as { readonly [key: string]: JsonValue };
  const activeView: Record<string, JsonValue> = {
    ...projectedObject,
    revision: room.revision,
  };
  if (
    room.turnDeadlineAt !== undefined &&
    typeof activeView.round === "object" &&
    activeView.round !== null &&
    !Array.isArray(activeView.round)
  ) {
    const round = activeView.round as { readonly [key: string]: JsonValue };
    activeView.round = {
      ...round,
      turnDeadlineAt: room.turnDeadlineAt,
    };
  }
  return activeView;
}

export function sendServerMessage(socket: WebSocket, message: ServerMessage): void {
  try {
    socket.send(encodeServerMessage(message));
  } catch {
    // Revision-based resync repairs partial broadcasts after reconnect.
  }
}

export function sendWelcome(
  socket: WebSocket,
  room: StoredRoom,
  seatId: SeatId,
  resumeToken: string,
  connectionEpoch: string,
  now: number,
): void {
  sendServerMessage(socket, {
    v: PROTOCOL_VERSION,
    type: "welcome",
    seatId,
    resumeToken,
    connectionEpoch,
    rulesVersion: RULES_VERSION,
    revision: room.revision,
    snapshot: projectRoomForSeat(room, seatId),
    serverTime: now,
    ...(room.turnDeadlineAt === undefined
      ? {}
      : { turnDeadlineAt: room.turnDeadlineAt }),
  });
}

export interface BroadcastAcknowledgement {
  readonly seatId: SeatId;
  readonly commandId: string;
  readonly acceptedRevision: number;
}

export function broadcastSnapshots(
  sockets: readonly WebSocket[],
  room: StoredRoom,
  rawEvents: readonly import("@gostop/game-core").DomainEvent[],
  now: number,
  acknowledgement?: BroadcastAcknowledgement,
): void {
  for (const socket of sockets) {
    const attachment = readSocketAttachment(socket);
    if (attachment?.seatId === undefined || attachment.connectionEpoch === undefined) {
      continue;
    }
    const seat = room.seats[attachment.seatId];
    if (seat?.connectionEpoch !== attachment.connectionEpoch) {
      continue;
    }

    const isActor = acknowledgement?.seatId === attachment.seatId;
    sendServerMessage(socket, {
      v: PROTOCOL_VERSION,
      type: "snapshot",
      revision: room.revision,
      snapshot: projectRoomForSeat(room, attachment.seatId),
      events:
        room.state === null
          ? []
          : projectSeatEvents(rawEvents, attachment.seatId).map(jsonValue),
      serverTime: now,
      ...(room.turnDeadlineAt === undefined
        ? {}
        : { turnDeadlineAt: room.turnDeadlineAt }),
      ...(isActor && acknowledgement !== undefined
        ? {
            acknowledgedCommandId: acknowledgement.commandId,
            acceptedRevision: acknowledgement.acceptedRevision,
          }
        : {}),
    });
  }
}
