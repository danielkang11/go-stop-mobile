import * as SecureStore from "expo-secure-store";

import { normalizeView } from "../game/coreAdapter";
import type { UiAction, UiGameView, UiSeatId } from "../game/uiTypes";
import type { DispatchResult, GameController } from "./types";

type UnknownRecord = Record<string, unknown>;

export interface LobbySeat {
  seatId: UiSeatId;
  displayName: string;
  ready: boolean;
  connected: boolean;
}

export interface LobbyView {
  roomCode: string;
  selfSeatId: UiSeatId;
  seats: readonly LobbySeat[];
}

export interface RemoteConnectionState {
  status: "connecting" | "connected" | "reconnecting" | "closed" | "error";
  lobby?: LobbyView | undefined;
  error?: string | undefined;
}

interface ConnectOptions {
  relayUrl: string;
  roomCode: string;
  displayName: string;
}

const CLIENT_BUILD = "0.2.0";

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function socketUrl(relayUrl: string, roomCode: string) {
  const base = relayUrl.replace(/\/$/, "").replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${base}/v1/rooms/${encodeURIComponent(roomCode)}/ws`;
}

function tokenKey(roomCode: string) {
  return `gostop.room.${roomCode}.resume`;
}

export async function createOnlineRoom(relayUrl: string): Promise<string> {
  const response = await fetch(`${relayUrl.replace(/\/$/, "")}/v1/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
  if (!response.ok) throw new Error(`Room service returned ${response.status}`);
  const result = (await response.json()) as { roomCode?: string };
  if (!result.roomCode) throw new Error("Room service did not return a room code");
  return result.roomCode;
}

export class RemoteGameController implements GameController {
  private socket?: WebSocket;
  private projected: unknown;
  private revision = 0;
  private seat: UiSeatId = 0;
  private names: [string, string, string] = ["Player 1", "Player 2", "Player 3"];
  private connection: RemoteConnectionState = { status: "connecting" };
  private readonly listeners = new Set<() => void>();
  private disposed = false;
  private readonly options: ConnectOptions;
  private latestEvents: readonly unknown[] = [];

  constructor(options: ConnectOptions) {
    this.options = { ...options, roomCode: options.roomCode.toUpperCase() };
  }

  connect() {
    if (this.disposed) return;
    this.connection = { ...this.connection, status: "connecting", error: undefined };
    this.emit();
    const socket = new WebSocket(socketUrl(this.options.relayUrl, this.options.roomCode));
    this.socket = socket;
    socket.onopen = () => this.sendHello();
    socket.onmessage = (event) => this.onMessage(String(event.data));
    socket.onerror = () => {
      this.connection = { ...this.connection, status: "error", error: "Unable to reach the room." };
      this.emit();
    };
    socket.onclose = () => {
      if (this.disposed) return;
      this.connection = { ...this.connection, status: "reconnecting" };
      this.emit();
      setTimeout(() => this.connect(), 1800);
    };
  }

  private async sendHello() {
    const stored = await SecureStore.getItemAsync(tokenKey(this.options.roomCode)).catch(() => null);
    let resume: { seatId: UiSeatId; token: string; lastRevision: number } | undefined;
    if (stored) {
      try {
        resume = JSON.parse(stored) as { seatId: UiSeatId; token: string; lastRevision: number };
      } catch {
        await SecureStore.deleteItemAsync(tokenKey(this.options.roomCode)).catch(() => undefined);
      }
    }
    this.socket?.send(
      JSON.stringify({
        v: 1,
        type: "hello",
        clientBuild: CLIENT_BUILD,
        roomCode: this.options.roomCode,
        supportedRulesVersions: ["mvp-2"],
        ...(resume
          ? { resume }
          : { join: { displayName: this.options.displayName.trim().slice(0, 16) || "Guest" } })
      })
    );
  }

  private onMessage(raw: string) {
    let message: UnknownRecord;
    try {
      message = record(JSON.parse(raw));
    } catch {
      return;
    }
    const type = String(message.type ?? "");
    if (type === "welcome") {
      this.seat = Number(message.seatId ?? 0) as UiSeatId;
      this.revision = Number(message.revision ?? 0);
      this.projected = message.snapshot;
      this.latestEvents = [];
      this.connection = { ...this.connection, status: "connected" };
      if (typeof message.resumeToken === "string") {
        SecureStore.setItemAsync(
          tokenKey(this.options.roomCode),
          JSON.stringify({ seatId: this.seat, token: message.resumeToken, lastRevision: this.revision })
        ).then(() => {
          if (message.connectionEpoch) this.socket?.send(JSON.stringify({ v: 1, type: "token_ack", connectionEpoch: message.connectionEpoch }));
        }).catch(() => undefined);
      }
      this.consumeSnapshot(message.snapshot);
      return;
    }
    if (type === "snapshot") {
      this.revision = Number(message.revision ?? this.revision);
      this.projected = message.snapshot;
      this.latestEvents = Array.isArray(message.events) ? message.events : [];
      this.consumeSnapshot(message.snapshot);
      SecureStore.getItemAsync(tokenKey(this.options.roomCode)).then((stored) => {
        if (!stored) return;
        const data = JSON.parse(stored) as UnknownRecord;
        data.lastRevision = this.revision;
        return SecureStore.setItemAsync(tokenKey(this.options.roomCode), JSON.stringify(data));
      }).catch(() => undefined);
      return;
    }
    if (type === "command_rejected") {
      if (message.snapshot) this.projected = message.snapshot;
      this.latestEvents = [];
      this.connection = { ...this.connection, error: String(message.code ?? "Move rejected") };
      this.emit();
      return;
    }
    if (type === "upgrade_required") {
      this.connection = { status: "error", error: "This room needs a newer app version." };
      this.emit();
      return;
    }
    if (type === "error") {
      if (message.code === "INVALID_TOKEN") {
        SecureStore.deleteItemAsync(tokenKey(this.options.roomCode)).catch(() => undefined);
      }
      const code = String(message.code ?? "ROOM_ERROR").replaceAll("_", " ").toLowerCase();
      this.connection = {
        ...this.connection,
        status: "error",
        error: typeof message.message === "string" ? message.message : `Unable to join: ${code}.`
      };
      this.emit();
    }
  }

  private consumeSnapshot(snapshot: unknown) {
    const value = record(snapshot);
    if (value.kind === "lobby" || Array.isArray(value.seats) && !value.phase && !value.round) {
      const seats = (Array.isArray(value.seats) ? value.seats : []).map((item) => {
        const source = record(item);
        const id = Number(source.seatId ?? 0) as UiSeatId;
        const displayName = String(source.displayName ?? `Player ${id + 1}`);
        this.names[id] = displayName;
        return { seatId: id, displayName, ready: Boolean(source.ready), connected: Boolean(source.connected) };
      });
      this.connection = {
        ...this.connection,
        status: "connected",
        lobby: { roomCode: String(value.roomCode ?? this.options.roomCode), selfSeatId: Number(value.selfSeatId ?? this.seat) as UiSeatId, seats }
      };
    } else {
      this.connection = { ...this.connection, status: "connected", lobby: undefined };
    }
    this.emit();
  }

  getConnectionState() {
    return this.connection;
  }

  isPlaying() {
    return Boolean(this.projected && !this.connection.lobby && (record(this.projected).phase || record(this.projected).round));
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  getView(): UiGameView {
    return normalizeView(this.projected, this.names, "remote", this.seat, undefined, this.latestEvents);
  }

  async setReady(ready: boolean) {
    return this.sendCommand({ type: "set-ready", ready });
  }

  async dispatch(action: UiAction): Promise<DispatchResult> {
    return this.sendCommand(action.raw);
  }

  private async sendCommand(payload: unknown): Promise<DispatchResult> {
    if (this.socket?.readyState !== WebSocket.OPEN) return { ok: false, error: "The room is reconnecting." };
    const commandId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    this.socket.send(JSON.stringify({ v: 1, type: "command", commandId, expectedRevision: this.revision, payload }));
    return { ok: true };
  }

  dispose() {
    this.disposed = true;
    this.socket?.close();
    this.listeners.clear();
  }
}
