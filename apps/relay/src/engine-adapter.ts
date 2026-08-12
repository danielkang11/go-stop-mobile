import {
  createSession,
  projectEventsForSeat,
  projectPlayerView,
  reduceSession,
  type AuthoritativeSessionState,
  type DomainEvent,
  type PlayerCommand,
  type PlayerVisibleEvent,
  type Rng,
  type SeatId,
} from "@gostop/game-core";

const RANDOM_BUFFER_BYTES = 4096;

class BufferedCryptoRng implements Rng {
  private offset = 0;

  public constructor(private readonly bytes: Uint8Array) {}

  public nextUint32(): number {
    if (this.offset + 4 > this.bytes.byteLength) {
      throw new Error("Prepared random buffer exhausted");
    }
    const view = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.offset,
      4,
    );
    this.offset += 4;
    return view.getUint32(0, false);
  }
}

export function prepareEngineRng(): Rng {
  const bytes = new Uint8Array(RANDOM_BUFFER_BYTES);
  crypto.getRandomValues(bytes);
  return new BufferedCryptoRng(bytes);
}

export function createRemoteSession(
  sessionId: string,
  now: number,
  rng: Rng,
): AuthoritativeSessionState {
  return createSession({ sessionId, mode: "remote", now, rng });
}

export type ReduceEngineResult =
  | {
      readonly ok: true;
      readonly state: AuthoritativeSessionState;
      readonly events: readonly DomainEvent[];
    }
  | { readonly ok: false; readonly reason: string };

export function reduceEngineCommand(
  state: AuthoritativeSessionState,
  command: PlayerCommand,
  now: number,
  rng: Rng,
): ReduceEngineResult {
  const result = reduceSession(state, command, { now, rng });
  if (!result.ok) {
    return { ok: false, reason: result.error.message };
  }
  return { ok: true, state: result.state, events: result.events };
}

export function projectSeatView(
  state: AuthoritativeSessionState,
  seatId: SeatId,
): unknown {
  return projectPlayerView(state, seatId);
}

export function projectSeatEvents(
  events: readonly DomainEvent[],
  seatId: SeatId,
): readonly PlayerVisibleEvent[] {
  return projectEventsForSeat(events, seatId);
}

export function currentSeat(state: AuthoritativeSessionState): SeatId | null {
  if (state.phase === "round-complete") {
    return state.dealerSeat;
  }
  return state.round?.currentSeat ?? null;
}

export function isSessionEnded(state: AuthoritativeSessionState): boolean {
  return state.phase === "session-ended";
}

export function chooseTimeoutCommand(
  state: AuthoritativeSessionState,
  seatId: SeatId,
): PlayerCommand | null {
  // Timeout policy receives the same projected legal-action list as a client;
  // it never evaluates the authoritative stock or opponents' hands.
  const legal = projectPlayerView(state, seatId).legalActions;
  if (legal.length === 0) {
    return null;
  }

  // Prefer ending a scored round; otherwise choose the first stable core action.
  return (
    legal.find((command) => command.type === "choose-stop") ??
    legal.find((command) => command.type === "start-next-round") ??
    legal[0] ??
    null
  );
}

export function coercePlayerCommand(
  value: Readonly<Record<string, unknown>>,
  seatId: SeatId,
): PlayerCommand | null {
  switch (value.type) {
    case "declare-shake":
      return Number.isInteger(value.month) && Number(value.month) >= 1 && Number(value.month) <= 12
        ? ({ type: value.type, seatId, month: value.month } as PlayerCommand)
        : null;
    case "play-card":
      return typeof value.cardId === "string"
        ? ({ type: value.type, seatId, cardId: value.cardId } as PlayerCommand)
        : null;
    case "play-bomb":
      return Number.isInteger(value.month) && Number(value.month) >= 1 && Number(value.month) <= 12
        ? ({ type: value.type, seatId, month: value.month } as PlayerCommand)
        : null;
    case "choose-match":
      return typeof value.cardId === "string"
        ? ({ type: value.type, seatId, cardId: value.cardId } as PlayerCommand)
        : null;
    case "skip-hand":
    case "choose-go":
    case "choose-stop":
    case "start-next-round":
      return { type: value.type, seatId } as PlayerCommand;
    default:
      return null;
  }
}
