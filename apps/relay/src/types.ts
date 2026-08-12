import type {
  AuthoritativeSessionState,
  DomainEvent,
  SeatId,
} from "@gostop/game-core";

export interface Env {
  readonly GAME_ROOMS: DurableObjectNamespace;
}

export type RoomLifecycle = "lobby" | "active" | "completed" | "expiring";

export interface PendingResumeToken {
  readonly hash: string;
  readonly connectionEpoch: string;
  readonly expiresAt: number;
}

export interface StoredSeat {
  readonly seatId: SeatId;
  readonly displayName: string;
  ready: boolean;
  currentTokenHash: string;
  pendingToken?: PendingResumeToken;
  /** The acknowledged token gets one recovery resume while rotation overlaps. */
  overlapRecoveryUsed: boolean;
  connectionEpoch?: string;
  disconnectedAt?: number;
  reservationExpiresAt?: number;
}

export interface ProcessedCommand {
  readonly seatId: SeatId;
  readonly commandId: string;
  readonly acceptedRevision: number;
}

export interface StoredRoom {
  readonly schemaVersion: 1;
  readonly protocolVersion: 1;
  readonly rulesVersion: "mvp-2";
  readonly roomCode: string;
  revision: number;
  lifecycle: RoomLifecycle;
  pausedAllDisconnectedAt?: number;
  turnDeadlineAt?: number;
  state: AuthoritativeSessionState | null;
  seats: [StoredSeat | null, StoredSeat | null, StoredSeat | null];
  recentCommandResults: ProcessedCommand[];
  readonly createdAt: number;
  lastActivityAt: number;
  /** Lobby, all-disconnected, or completed retention. Zero means no expiry. */
  expiresAt: number;
}

export interface SocketAttachment {
  readonly connectionId: string;
  readonly seatId?: SeatId;
  readonly connectionEpoch?: string;
}

export interface AcceptedMutation {
  readonly room: StoredRoom;
  readonly events: readonly DomainEvent[];
  readonly actorSeatId?: SeatId;
  readonly commandId?: string;
  readonly acceptedRevision?: number;
}
