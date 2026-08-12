import type { RejectCode } from "./errors";

export type SeatId = 0 | 1 | 2;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface LobbySeatView {
  readonly seatId: SeatId;
  readonly displayName: string;
  readonly ready: boolean;
  readonly connected: boolean;
}

export interface LobbyView {
  readonly kind: "lobby";
  readonly roomCode: string;
  readonly selfSeatId: SeatId;
  readonly seats: readonly LobbySeatView[];
}

/**
 * Active game views are produced by game-core's explicit per-seat projector.
 * The protocol deliberately treats their internals as opaque JSON so protocol
 * releases do not need to duplicate or weaken that allowlist.
 */
export type RemoteSnapshot = LobbyView | JsonValue;

export interface SetReadyCommand {
  readonly type: "set-ready";
  readonly ready: boolean;
}

export interface WireGameCommand {
  readonly type: string;
  readonly [key: string]: JsonValue;
}

export type RemoteCommand = SetReadyCommand | WireGameCommand;

export interface HelloMessage {
  readonly v: 1;
  readonly type: "hello";
  readonly clientBuild: string;
  readonly roomCode: string;
  readonly supportedRulesVersions: readonly ["mvp-2"] | readonly "mvp-2"[];
  readonly join?: { readonly displayName: string };
  readonly resume?: {
    readonly seatId: SeatId;
    readonly token: string;
    readonly lastRevision: number;
  };
}

export interface CommandMessage {
  readonly v: 1;
  readonly type: "command";
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly payload: RemoteCommand;
}

export interface TokenAckMessage {
  readonly v: 1;
  readonly type: "token_ack";
  readonly connectionEpoch: string;
}

export interface PingMessage {
  readonly v: 1;
  readonly type: "ping";
}

export type ClientMessage =
  | HelloMessage
  | CommandMessage
  | TokenAckMessage
  | PingMessage;

export interface WelcomeMessage {
  readonly v: 1;
  readonly type: "welcome";
  readonly seatId: SeatId;
  readonly resumeToken: string;
  readonly connectionEpoch: string;
  readonly rulesVersion: "mvp-2";
  readonly revision: number;
  readonly snapshot: RemoteSnapshot;
  readonly serverTime: number;
  readonly turnDeadlineAt?: number;
}

export interface SnapshotMessage {
  readonly v: 1;
  readonly type: "snapshot";
  readonly revision: number;
  readonly snapshot: RemoteSnapshot;
  readonly events: readonly JsonValue[];
  readonly serverTime: number;
  readonly turnDeadlineAt?: number;
  readonly acknowledgedCommandId?: string;
  readonly acceptedRevision?: number;
}

export interface CommandRejectedMessage {
  readonly v: 1;
  readonly type: "command_rejected";
  readonly commandId: string;
  readonly code: RejectCode;
  readonly revision: number;
  readonly snapshot?: RemoteSnapshot;
  readonly serverTime: number;
  readonly turnDeadlineAt?: number;
}

export interface PongMessage {
  readonly v: 1;
  readonly type: "pong";
}

export interface UpgradeRequiredMessage {
  readonly v: 1;
  readonly type: "upgrade_required";
}

export interface ErrorMessage {
  readonly v: 1;
  readonly type: "error";
  readonly code: RejectCode;
  readonly message?: string;
}

export type ServerMessage =
  | WelcomeMessage
  | SnapshotMessage
  | CommandRejectedMessage
  | PongMessage
  | UpgradeRequiredMessage
  | ErrorMessage;

export interface CreateRoomResponse {
  readonly roomCode: string;
  readonly websocketPath: string;
  readonly expiresAt: number;
}
