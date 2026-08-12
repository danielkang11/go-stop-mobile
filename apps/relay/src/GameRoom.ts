import {
  MAX_FRAME_BYTES,
  PING_BYTES,
  PONG_BYTES,
  PROTOCOL_VERSION,
  RULES_VERSION,
  parseClientMessage,
  type ClientMessage,
  type CommandMessage,
  type RejectCode,
  type SeatId,
} from "@gostop/protocol";

import {
  acceptResumeCredential,
  acknowledgeTokenRotation,
  beginTokenRotation,
  createConnectionEpoch,
  createConnectionId,
  createResumeToken,
  hashResumeToken,
  normalizeDisplayName,
} from "./auth";
import {
  chooseTimeoutCommand,
  coercePlayerCommand,
  createRemoteSession,
  currentSeat,
  isSessionEnded,
  prepareEngineRng,
  reduceEngineCommand,
} from "./engine-adapter";
import {
  ALL_DISCONNECTED_RETENTION_MS,
  COMPLETED_RETENTION_MS,
  LOBBY_RETENTION_MS,
  PREGAME_RESERVATION_MS,
  TOKEN_OVERLAP_MS,
  TURN_DEADLINE_MS,
  applyTokenOverlapDeadlines,
  earliestAlarmAt,
  releaseExpiredLobbySeats,
  retentionExpired,
} from "./expiry";
import {
  broadcastSnapshots,
  projectRoomForSeat,
  readSocketAttachment,
  sendServerMessage,
  sendWelcome,
} from "./projection-broadcast";
import type {
  Env,
  ProcessedCommand,
  SocketAttachment,
  StoredRoom,
  StoredSeat,
} from "./types";

const ROOM_ROW_ID = 1;
const MAX_COMMAND_RESULTS = 64;
const MAX_TIMEOUT_ACTIONS = 8;

type CommandOutcome =
  | {
      readonly kind: "accepted";
      readonly room: StoredRoom;
      readonly events: readonly import("@gostop/game-core").DomainEvent[];
      readonly acceptedRevision: number;
    }
  | {
      readonly kind: "duplicate";
      readonly room: StoredRoom;
      readonly acceptedRevision: number;
    }
  | {
      readonly kind: "rejected";
      readonly room: StoredRoom;
      readonly code: RejectCode;
    };

interface CreateRoomPayload {
  readonly roomCode: string;
  readonly now: number;
}

export class GameRoom implements DurableObject {
  private expiringInMemory = false;

  public constructor(
    private readonly context: DurableObjectState,
    private readonly env: Env,
  ) {
    void this.env;
    this.context.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        snapshot TEXT NOT NULL
      )
    `);
    this.context.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(PING_BYTES, PONG_BYTES),
    );
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/internal/create") {
      return this.createRoom(request);
    }
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return jsonResponse({ code: "BAD_MESSAGE" }, 400);
    }

    const room = this.readRoom();
    if (room === null) {
      return jsonResponse({ code: "ROOM_NOT_FOUND" }, 404);
    }
    if (room.lifecycle === "expiring" || this.expiringInMemory) {
      return jsonResponse({ code: "ROOM_EXPIRED" }, 410);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.serializeAttachment({
      connectionId: createConnectionId(),
    } satisfies SocketAttachment);
    this.context.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  public async webSocketMessage(
    socket: WebSocket,
    frame: string | ArrayBuffer,
  ): Promise<void> {
    if (this.expiringInMemory) {
      safeClose(socket, 4004, "Room expired");
      return;
    }
    if (typeof frame !== "string") {
      this.sendError(socket, "BAD_MESSAGE", "Only JSON text frames are accepted");
      safeClose(socket, 1003, "Text frames required");
      return;
    }
    if (new TextEncoder().encode(frame).byteLength > MAX_FRAME_BYTES) {
      this.sendError(socket, "FRAME_TOO_LARGE", "Frame is too large");
      safeClose(socket, 1009, "Frame is too large");
      return;
    }

    const parsed = parseClientMessage(frame);
    if (!parsed.ok) {
      this.sendError(socket, parsed.code, parsed.reason);
      return;
    }

    try {
      await this.handleMessage(socket, parsed.value);
    } catch {
      this.sendError(socket, "INTERNAL_ERROR", "The room could not process that message");
    }
  }

  public async webSocketClose(socket: WebSocket): Promise<void> {
    await this.handleDisconnect(socket);
  }

  public async webSocketError(socket: WebSocket): Promise<void> {
    await this.handleDisconnect(socket);
  }

  public async alarm(): Promise<void> {
    if (this.expiringInMemory) {
      return;
    }
    const now = Date.now();
    const rng = prepareEngineRng();
    let shouldDelete = false;
    let shouldBroadcast = false;
    let alarmEvents: readonly import("@gostop/game-core").DomainEvent[] = [];

    const room = this.context.storage.transactionSync(() => {
      const current = this.readRoom();
      if (current === null || current.lifecycle === "expiring") {
        return current;
      }

      let changed = applyTokenOverlapDeadlines(current, now);
      changed = releaseExpiredLobbySeats(current, now) || changed;
      shouldBroadcast = changed;

      if (retentionExpired(current, now)) {
        current.lifecycle = "expiring";
        this.writeRoom(current);
        shouldDelete = true;
        return current;
      }

      if (
        current.lifecycle === "active" &&
        current.state !== null &&
        current.pausedAllDisconnectedAt === undefined &&
        current.turnDeadlineAt !== undefined &&
        current.turnDeadlineAt <= now
      ) {
        const timedOutSeat = currentSeat(current.state);
        const events: import("@gostop/game-core").DomainEvent[] = [];
        for (let step = 0; step < MAX_TIMEOUT_ACTIONS; step += 1) {
          if (timedOutSeat === null || currentSeat(current.state) !== timedOutSeat) {
            break;
          }
          const command = chooseTimeoutCommand(current.state, timedOutSeat);
          if (command === null) {
            break;
          }
          const reduced = reduceEngineCommand(current.state, command, now, rng);
          if (!reduced.ok) {
            break;
          }
          current.state = reduced.state;
          current.revision += 1;
          events.push(...reduced.events);
          if (isSessionEnded(current.state)) {
            break;
          }
        }
        alarmEvents = events;
        shouldBroadcast = shouldBroadcast || events.length > 0;
        if (isSessionEnded(current.state)) {
          current.lifecycle = "completed";
          delete current.turnDeadlineAt;
          current.expiresAt = now + COMPLETED_RETENTION_MS;
        } else {
          current.turnDeadlineAt = now + TURN_DEADLINE_MS;
        }
        current.lastActivityAt = now;
        changed = true;
      }

      if (changed) {
        this.writeRoom(current);
      }
      return current;
    });

    if (shouldDelete) {
      await this.deleteExpiringRoom();
      return;
    }
    if (room !== null && shouldBroadcast) {
      broadcastSnapshots(this.context.getWebSockets(), room, alarmEvents, now);
    }
    if (room !== null) {
      await this.scheduleNextAlarm(room);
    }
  }

  private async createRoom(request: Request): Promise<Response> {
    let payload: CreateRoomPayload;
    try {
      payload = (await request.json()) as CreateRoomPayload;
    } catch {
      return jsonResponse({ code: "BAD_MESSAGE" }, 400);
    }
    if (
      typeof payload.roomCode !== "string" ||
      typeof payload.now !== "number" ||
      !Number.isSafeInteger(payload.now)
    ) {
      return jsonResponse({ code: "BAD_MESSAGE" }, 400);
    }

    const created = this.context.storage.transactionSync(() => {
      if (this.readRoom() !== null) {
        return false;
      }
      const room: StoredRoom = {
        schemaVersion: 1,
        protocolVersion: PROTOCOL_VERSION,
        rulesVersion: RULES_VERSION,
        roomCode: payload.roomCode,
        revision: 0,
        lifecycle: "lobby",
        state: null,
        seats: [null, null, null],
        recentCommandResults: [],
        createdAt: payload.now,
        lastActivityAt: payload.now,
        expiresAt: payload.now + LOBBY_RETENTION_MS,
      };
      this.writeRoom(room);
      return true;
    });
    if (!created) {
      return jsonResponse({ code: "ROOM_EXISTS" }, 409);
    }

    const room = this.readRoom();
    if (room !== null) {
      await this.scheduleNextAlarm(room);
    }
    return jsonResponse(
      { created: true, expiresAt: payload.now + LOBBY_RETENTION_MS },
      201,
    );
  }

  private async handleMessage(socket: WebSocket, message: ClientMessage): Promise<void> {
    switch (message.type) {
      case "hello":
        await this.handleHello(socket, message);
        return;
      case "command":
        await this.handleCommand(socket, message);
        return;
      case "token_ack":
        await this.handleTokenAck(socket, message.connectionEpoch);
        return;
      case "ping":
        sendServerMessage(socket, { v: PROTOCOL_VERSION, type: "pong" });
        return;
    }
  }

  private async handleHello(
    socket: WebSocket,
    message: Extract<ClientMessage, { type: "hello" }>,
  ): Promise<void> {
    const oldAttachment = readSocketAttachment(socket);
    if (oldAttachment?.seatId !== undefined) {
      this.sendError(socket, "BAD_MESSAGE", "Socket is already authenticated");
      return;
    }
    const before = this.readRoom();
    if (before === null || before.roomCode !== message.roomCode) {
      this.sendError(socket, "ROOM_NOT_FOUND");
      safeClose(socket, 4004, "Room not found");
      return;
    }
    if (!message.supportedRulesVersions.includes(RULES_VERSION)) {
      sendServerMessage(socket, { v: PROTOCOL_VERSION, type: "upgrade_required" });
      safeClose(socket, 4006, "Upgrade required");
      return;
    }

    if (message.join !== undefined) {
      await this.joinSeat(socket, message.join.displayName);
      return;
    }
    if (message.resume !== undefined) {
      await this.resumeSeat(socket, message.resume.seatId, message.resume.token);
    }
  }

  private async joinSeat(socket: WebSocket, displayNameInput: string): Promise<void> {
    const displayName = normalizeDisplayName(displayNameInput);
    if (displayName === null) {
      this.sendError(socket, "INVALID_NAME");
      return;
    }
    const now = Date.now();
    const token = createResumeToken();
    const tokenHash = await hashResumeToken(token);
    const epoch = createConnectionEpoch();

    const result = this.context.storage.transactionSync(() => {
      const room = this.readRoom();
      if (room === null) {
        return { code: "ROOM_NOT_FOUND" as const };
      }
      if (room.lifecycle !== "lobby") {
        return { code: "ROOM_FULL" as const };
      }
      const seatId = room.seats.findIndex((seat) => seat === null) as SeatId | -1;
      if (seatId === -1) {
        return { code: "ROOM_FULL" as const };
      }
      const seat: StoredSeat = {
        seatId,
        displayName,
        ready: false,
        currentTokenHash: tokenHash,
        overlapRecoveryUsed: false,
        connectionEpoch: epoch,
      };
      room.seats[seatId] = seat;
      room.lastActivityAt = now;
      this.writeRoom(room);
      return { room, seatId };
    });

    if ("code" in result) {
      this.sendError(socket, result.code);
      return;
    }
    this.authenticateSocket(socket, result.seatId, epoch);
    sendWelcome(socket, result.room, result.seatId, token, epoch, now);
    broadcastSnapshots(this.context.getWebSockets(), result.room, [], now);
    await this.scheduleNextAlarm(result.room);
  }

  private async resumeSeat(
    socket: WebSocket,
    seatId: SeatId,
    suppliedToken: string,
  ): Promise<void> {
    const now = Date.now();
    const suppliedHash = await hashResumeToken(suppliedToken);
    const nextToken = createResumeToken();
    const nextHash = await hashResumeToken(nextToken);
    const nextEpoch = createConnectionEpoch();

    const result = this.context.storage.transactionSync(() => {
      const room = this.readRoom();
      if (room === null) {
        return { code: "ROOM_NOT_FOUND" as const };
      }
      if (room.lifecycle === "expiring") {
        return { code: "ROOM_EXPIRED" as const };
      }
      const seat = room.seats[seatId];
      if (seat === null) {
        return { code: "INVALID_TOKEN" as const };
      }

      if (acceptResumeCredential(seat, suppliedHash) === null) {
        return { code: "INVALID_TOKEN" as const };
      }
      beginTokenRotation(seat, {
        hash: nextHash,
        connectionEpoch: nextEpoch,
        expiresAt: now + TOKEN_OVERLAP_MS,
      });
      delete seat.disconnectedAt;
      delete seat.reservationExpiresAt;
      room.lastActivityAt = now;
      if (room.lifecycle === "active" && room.pausedAllDisconnectedAt !== undefined) {
        delete room.pausedAllDisconnectedAt;
        room.turnDeadlineAt = now + TURN_DEADLINE_MS;
        room.expiresAt = 0;
      }
      this.writeRoom(room);
      return { room };
    });

    if ("code" in result) {
      this.sendError(socket, result.code);
      return;
    }
    this.closeOlderSeatSockets(socket, seatId);
    this.authenticateSocket(socket, seatId, nextEpoch);
    sendWelcome(socket, result.room, seatId, nextToken, nextEpoch, now);
    broadcastSnapshots(this.context.getWebSockets(), result.room, [], now);
    await this.scheduleNextAlarm(result.room);
  }

  private async handleTokenAck(socket: WebSocket, connectionEpoch: string): Promise<void> {
    const attachment = readSocketAttachment(socket);
    if (attachment?.seatId === undefined || attachment.connectionEpoch !== connectionEpoch) {
      this.sendError(socket, "NOT_AUTHENTICATED");
      return;
    }
    const seatId = attachment.seatId;
    const room = this.context.storage.transactionSync(() => {
      const current = this.readRoom();
      const seat = current?.seats[seatId];
      if (
        current === null ||
        seat === undefined ||
        seat === null ||
        seat.connectionEpoch !== connectionEpoch
      ) {
        return null;
      }
      if (acknowledgeTokenRotation(seat, connectionEpoch)) {
        current.lastActivityAt = Date.now();
        this.writeRoom(current);
      }
      return current;
    });
    if (room === null) {
      this.sendError(socket, "INVALID_TOKEN");
      return;
    }
    await this.scheduleNextAlarm(room);
  }

  private async handleCommand(socket: WebSocket, message: CommandMessage): Promise<void> {
    const attachment = readSocketAttachment(socket);
    if (attachment?.seatId === undefined || attachment.connectionEpoch === undefined) {
      this.sendError(socket, "NOT_AUTHENTICATED");
      return;
    }
    const now = Date.now();
    const rng = prepareEngineRng();
    const seatId = attachment.seatId;

    let outcome: CommandOutcome;
    try {
      outcome = this.context.storage.transactionSync(() => {
        const room = this.readRoom();
        if (room === null || room.lifecycle === "expiring") {
          return {
            kind: "rejected",
            room: room ?? emptyExpiredRoom(),
            code: room === null ? "ROOM_NOT_FOUND" : "ROOM_EXPIRED",
          };
        }
        const seat = room.seats[seatId];
        if (seat === null || seat.connectionEpoch !== attachment.connectionEpoch) {
          return { kind: "rejected", room, code: "NOT_AUTHENTICATED" };
        }

        const duplicate = room.recentCommandResults.find(
          (entry) => entry.seatId === seatId && entry.commandId === message.commandId,
        );
        if (duplicate !== undefined) {
          return {
            kind: "duplicate",
            room,
            acceptedRevision: duplicate.acceptedRevision,
          };
        }
        if (message.expectedRevision !== room.revision) {
          return { kind: "rejected", room, code: "STALE_REVISION" };
        }

        let events: readonly import("@gostop/game-core").DomainEvent[] = [];
        if (room.lifecycle === "lobby") {
          if (
            message.payload.type !== "set-ready" ||
            typeof message.payload.ready !== "boolean"
          ) {
            return { kind: "rejected", room, code: "ILLEGAL_COMMAND" };
          }
          seat.ready = message.payload.ready;
          if (room.seats.every((candidate) => candidate?.ready === true)) {
            room.state = createRemoteSession(
              `${room.roomCode}-${room.createdAt}`,
              now,
              rng,
            );
            room.lifecycle = "active";
            room.turnDeadlineAt = now + TURN_DEADLINE_MS;
            room.expiresAt = 0;
          }
        } else if (room.lifecycle === "active" && room.state !== null) {
          if (message.payload.type === "set-ready") {
            return { kind: "rejected", room, code: "ILLEGAL_COMMAND" };
          }
          const command = coercePlayerCommand(
            message.payload as Readonly<Record<string, unknown>>,
            seatId,
          );
          if (command === null) {
            return { kind: "rejected", room, code: "ILLEGAL_COMMAND" };
          }
          const reduced = reduceEngineCommand(room.state, command, now, rng);
          if (!reduced.ok) {
            return { kind: "rejected", room, code: "ILLEGAL_COMMAND" };
          }
          room.state = reduced.state;
          events = reduced.events;
          if (isSessionEnded(room.state)) {
            room.lifecycle = "completed";
            delete room.turnDeadlineAt;
            room.expiresAt = now + COMPLETED_RETENTION_MS;
          } else {
            room.turnDeadlineAt = now + TURN_DEADLINE_MS;
          }
        } else {
          return { kind: "rejected", room, code: "ILLEGAL_COMMAND" };
        }

        room.revision += 1;
        room.lastActivityAt = now;
        const acceptedRevision = room.revision;
        appendCommandResult(room, { seatId, commandId: message.commandId, acceptedRevision });
        this.writeRoom(room);
        return { kind: "accepted", room, events, acceptedRevision };
      });
    } catch {
      const room = this.readRoom();
      if (room === null) {
        this.sendError(socket, "ROOM_NOT_FOUND");
        return;
      }
      outcome = { kind: "rejected", room, code: "INTERNAL_ERROR" };
    }

    if (outcome.kind === "rejected") {
      this.sendCommandRejection(socket, message.commandId, outcome.code, outcome.room, now);
      return;
    }
    if (outcome.kind === "duplicate") {
      broadcastSnapshots([socket], outcome.room, [], now, {
        seatId,
        commandId: message.commandId,
        acceptedRevision: outcome.acceptedRevision,
      });
      return;
    }
    broadcastSnapshots(this.context.getWebSockets(), outcome.room, outcome.events, now, {
      seatId,
      commandId: message.commandId,
      acceptedRevision: outcome.acceptedRevision,
    });
    await this.scheduleNextAlarm(outcome.room);
  }

  private sendCommandRejection(
    socket: WebSocket,
    commandId: string,
    code: RejectCode,
    room: StoredRoom,
    now: number,
  ): void {
    const attachment = readSocketAttachment(socket);
    sendServerMessage(socket, {
      v: PROTOCOL_VERSION,
      type: "command_rejected",
      commandId,
      code,
      revision: room.revision,
      ...(attachment?.seatId === undefined || room.seats[attachment.seatId] === null
        ? {}
        : { snapshot: projectRoomForSeat(room, attachment.seatId) }),
      serverTime: now,
      ...(room.turnDeadlineAt === undefined
        ? {}
        : { turnDeadlineAt: room.turnDeadlineAt }),
    });
  }

  private async handleDisconnect(socket: WebSocket): Promise<void> {
    if (this.expiringInMemory) {
      return;
    }
    const attachment = readSocketAttachment(socket);
    if (attachment?.seatId === undefined || attachment.connectionEpoch === undefined) {
      return;
    }
    const seatId = attachment.seatId;
    const now = Date.now();
    const room = this.context.storage.transactionSync(() => {
      const current = this.readRoom();
      const seat = current?.seats[seatId];
      if (
        current === null ||
        current.lifecycle === "expiring" ||
        seat === undefined ||
        seat === null ||
        seat.connectionEpoch !== attachment.connectionEpoch
      ) {
        return null;
      }
      seat.disconnectedAt = now;
      if (current.lifecycle === "lobby") {
        seat.ready = false;
        seat.reservationExpiresAt = now + PREGAME_RESERVATION_MS;
      } else if (
        current.lifecycle === "active" &&
        current.seats.every((candidate) => candidate?.disconnectedAt !== undefined)
      ) {
        current.pausedAllDisconnectedAt = now;
        delete current.turnDeadlineAt;
        current.expiresAt = now + ALL_DISCONNECTED_RETENTION_MS;
      }
      current.lastActivityAt = now;
      this.writeRoom(current);
      return current;
    });
    if (room !== null) {
      broadcastSnapshots(this.context.getWebSockets(), room, [], now);
      await this.scheduleNextAlarm(room);
    }
  }

  private authenticateSocket(socket: WebSocket, seatId: SeatId, epoch: string): void {
    const attachment = readSocketAttachment(socket);
    socket.serializeAttachment({
      connectionId: attachment?.connectionId ?? createConnectionId(),
      seatId,
      connectionEpoch: epoch,
    } satisfies SocketAttachment);
  }

  private closeOlderSeatSockets(current: WebSocket, seatId: SeatId): void {
    for (const socket of this.context.getWebSockets()) {
      if (socket === current) {
        continue;
      }
      if (readSocketAttachment(socket)?.seatId === seatId) {
        safeClose(socket, 4001, "Seat resumed elsewhere");
      }
    }
  }

  private sendError(socket: WebSocket, code: RejectCode, message?: string): void {
    sendServerMessage(socket, {
      v: PROTOCOL_VERSION,
      type: "error",
      code,
      ...(message === undefined ? {} : { message }),
    });
  }

  private readRoom(): StoredRoom | null {
    const cursor = this.context.storage.sql.exec<{ snapshot: string }>(
      "SELECT snapshot FROM room_state WHERE id = ?",
      ROOM_ROW_ID,
    );
    const row = Array.from(cursor)[0];
    if (row === undefined) {
      return null;
    }
    const parsed = JSON.parse(row.snapshot) as StoredRoom;
    if (
      parsed.schemaVersion !== 1 ||
      parsed.protocolVersion !== PROTOCOL_VERSION ||
      parsed.rulesVersion !== RULES_VERSION
    ) {
      throw new Error("Unsupported stored room schema");
    }
    return parsed;
  }

  private writeRoom(room: StoredRoom): void {
    if (this.expiringInMemory || room.lifecycle === "expiring" && this.readRoom() === null) {
      return;
    }
    this.context.storage.sql.exec(
      `INSERT INTO room_state (id, snapshot) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot`,
      ROOM_ROW_ID,
      JSON.stringify(room),
    );
  }

  private async scheduleNextAlarm(room: StoredRoom): Promise<void> {
    if (this.expiringInMemory || room.lifecycle === "expiring") {
      return;
    }
    const next = earliestAlarmAt(room);
    if (next === null) {
      await this.context.storage.deleteAlarm();
      return;
    }
    await this.context.storage.setAlarm(next);
  }

  private async deleteExpiringRoom(): Promise<void> {
    this.expiringInMemory = true;
    for (const socket of this.context.getWebSockets()) {
      safeClose(socket, 4004, "Room expired");
    }
    await this.context.storage.deleteAll();
  }
}

function appendCommandResult(room: StoredRoom, result: ProcessedCommand): void {
  room.recentCommandResults.push(result);
  if (room.recentCommandResults.length > MAX_COMMAND_RESULTS) {
    room.recentCommandResults.splice(
      0,
      room.recentCommandResults.length - MAX_COMMAND_RESULTS,
    );
  }
}

function safeClose(socket: WebSocket, code: number, reason: string): void {
  try {
    socket.close(code, reason);
  } catch {
    // Already closed.
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function emptyExpiredRoom(): StoredRoom {
  return {
    schemaVersion: 1,
    protocolVersion: 1,
    rulesVersion: "mvp-2",
    roomCode: "00000000",
    revision: 0,
    lifecycle: "expiring",
    state: null,
    seats: [null, null, null],
    recentCommandResults: [],
    createdAt: 0,
    lastActivityAt: 0,
    expiresAt: 0,
  };
}
