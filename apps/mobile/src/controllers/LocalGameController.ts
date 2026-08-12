import { createSeededRandom, decideAiAction, type AiDifficulty } from "@gostop/game-ai";

import { asRecord, core, makeSessionId, normalizeAction, normalizeView } from "../game/coreAdapter";
import type { StartSessionOptions, UiAction, UiGameView, UiSeatId } from "../game/uiTypes";
import type { DispatchResult, GameController } from "./types";

export class LocalGameController implements GameController {
  private state: unknown;
  private readonly rng: unknown;
  private readonly names: readonly [string, string, string];
  private readonly mode: StartSessionOptions["mode"];
  private readonly aiSeats: ReadonlySet<UiSeatId>;
  private readonly difficulty: AiDifficulty;
  private readonly listeners = new Set<() => void>();
  private aiTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private aiRandom: () => number;
  private latestEvents: readonly unknown[] = [];

  constructor(options: StartSessionOptions) {
    this.mode = options.mode;
    this.names = options.names;
    this.aiSeats = new Set(options.aiSeats ?? []);
    this.difficulty = options.difficulty ?? "standard";
    const seed = options.seed ?? Date.now();
    this.rng = core.createSeededRng(seed);
    this.aiRandom = createSeededRandom(seed ^ 0xa11ce);
    this.state = core.createSession({
      sessionId: makeSessionId(options.mode === "pass-and-play" ? "local" : "ai"),
      mode: options.mode,
      rng: this.rng,
      displayNames: [...options.names] as [string, string, string],
      now: Date.now()
    });
    this.queueAiIfNeeded();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getView(): UiGameView {
    const state = this.state as Record<string, unknown>;
    const viewer = getViewerSeatForState(state, this.mode);
    const view = normalizeView(core.projectPlayerView(this.state, viewer), this.names, this.mode, viewer, this.state, this.latestEvents);
    view.seats = view.seats.map((seat) => ({ ...seat, isAi: this.aiSeats.has(seat.id) }));
    const administrativeAction = getAdministrativeNextRoundAction(this.state, this.mode);
    if (administrativeAction && !view.legalActions.some((action) => action.kind === "next-round")) {
      view.legalActions = [...view.legalActions, administrativeAction];
    }
    return view;
  }

  async dispatch(action: UiAction): Promise<DispatchResult> {
    return this.reduce(action.raw);
  }

  private reduce(command: unknown): DispatchResult {
    if (this.disposed) return { ok: false, error: "Session is closed" };
    const result = core.reduceSession(this.state, command, { rng: this.rng, now: Date.now() });
    if (!result.ok) return { ok: false, error: formatError(result.error) };
    this.state = result.state;
    this.latestEvents = result.events ?? [];
    this.emit();
    this.queueAiIfNeeded();
    return { ok: true };
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private queueAiIfNeeded() {
    if (this.disposed || this.mode !== "human-vs-ai" || this.aiTimer) return;
    const view = this.getView();
    if (view.phase !== "playing" || !this.aiSeats.has(view.activeSeatId)) return;
    const aiSeat = view.activeSeatId;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = undefined;
      if (this.disposed) return;
      const projected = core.projectPlayerView(this.state, aiSeat);
      const legal = core.getLegalActions(this.state, aiSeat);
      if (legal.length === 0) return;
      const decision = decideAiAction(projected as never, {
        difficulty: this.difficulty,
        random: this.aiRandom,
        legalActions: legal as never
      });
      this.reduce(decision.command);
    }, 520);
  }

  dispose() {
    this.disposed = true;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.listeners.clear();
  }
}

export function getViewerSeatForState(state: unknown, mode: StartSessionOptions["mode"]): UiSeatId {
  if (mode === "human-vs-ai") return 0;
  const source = asRecord(state);
  if (source.phase === "round-complete") {
    const dealer = Number(source.dealerSeat);
    return dealer === 1 || dealer === 2 ? dealer : 0;
  }
  const current = Number(asRecord(source.round).currentSeat ?? source.currentSeat ?? 0);
  return current === 1 || current === 2 ? current : 0;
}

/**
 * In solo mode the human owns the session UI even when an AI winner becomes
 * dealer. Core correctly restricts the command to that dealer; this adapter
 * supplies the dealer-authored administrative command without exposing the
 * AI's hand or making a gameplay decision on its behalf.
 */
export function getAdministrativeNextRoundAction(
  state: unknown,
  mode: StartSessionOptions["mode"]
): UiAction | undefined {
  const source = asRecord(state);
  if (mode !== "human-vs-ai" || source.phase !== "round-complete") return undefined;
  const dealer = Number(source.dealerSeat);
  if (dealer !== 0 && dealer !== 1 && dealer !== 2) return undefined;
  return normalizeAction({ type: "start-next-round", seatId: dealer });
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "That move is no longer available.";
}
