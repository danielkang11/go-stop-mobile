import type { StoredRoom } from "./types";

export const LOBBY_RETENTION_MS = 6 * 60 * 60 * 1000;
export const PREGAME_RESERVATION_MS = 60 * 1000;
export const TOKEN_OVERLAP_MS = 60 * 1000;
export const TURN_DEADLINE_MS = 90 * 1000;
export const ALL_DISCONNECTED_RETENTION_MS = 15 * 60 * 1000;
export const COMPLETED_RETENTION_MS = 10 * 60 * 1000;

export function earliestAlarmAt(room: StoredRoom): number | null {
  if (room.lifecycle === "expiring") {
    return null;
  }

  const deadlines: number[] = [];
  if (room.expiresAt > 0) {
    deadlines.push(room.expiresAt);
  }
  if (room.turnDeadlineAt !== undefined) {
    deadlines.push(room.turnDeadlineAt);
  }
  for (const seat of room.seats) {
    if (seat?.pendingToken !== undefined) {
      deadlines.push(seat.pendingToken.expiresAt);
    }
    if (seat?.reservationExpiresAt !== undefined) {
      deadlines.push(seat.reservationExpiresAt);
    }
  }

  return deadlines.length === 0 ? null : Math.min(...deadlines);
}

/** Promotes a pending token when its overlap elapses, revoking the prior one. */
export function applyTokenOverlapDeadlines(room: StoredRoom, now: number): boolean {
  let changed = false;
  for (const seat of room.seats) {
    const pending = seat?.pendingToken;
    if (seat === null || pending === undefined || pending.expiresAt > now) {
      continue;
    }
    seat.currentTokenHash = pending.hash;
    delete seat.pendingToken;
    seat.overlapRecoveryUsed = false;
    changed = true;
  }
  return changed;
}

export function releaseExpiredLobbySeats(room: StoredRoom, now: number): boolean {
  if (room.lifecycle !== "lobby") {
    return false;
  }
  let changed = false;
  for (let seatId = 0; seatId < room.seats.length; seatId += 1) {
    const seat = room.seats[seatId];
    if (
      seat !== undefined &&
      seat !== null &&
      seat.reservationExpiresAt !== undefined &&
      seat.reservationExpiresAt <= now
    ) {
      room.seats[seatId] = null;
      changed = true;
    }
  }
  return changed;
}

export function retentionExpired(room: StoredRoom, now: number): boolean {
  return room.expiresAt > 0 && room.expiresAt <= now;
}
