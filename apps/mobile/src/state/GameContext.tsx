import { AppState } from "react-native";
import * as ScreenCapture from "expo-screen-capture";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { LocalGameController } from "../controllers/LocalGameController";
import type { GameController } from "../controllers/types";
import type { StartSessionOptions, UiAction, UiGameView, UiSeatId } from "../game/uiTypes";

interface GameContextValue {
  view?: UiGameView | undefined;
  busy: boolean;
  error?: string | undefined;
  curtainSeat?: UiSeatId | undefined;
  startLocal: (names: readonly [string, string, string]) => string;
  startAi: (humanName: string, difficulty: "easy" | "standard") => string;
  attachController: (controller: GameController) => string;
  dispatch: (action: UiAction) => Promise<boolean>;
  revealHand: () => void;
  coverHand: () => void;
  reset: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: React.PropsWithChildren) {
  const controllerRef = useRef<GameController | undefined>(undefined);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const currentSeatRef = useRef<UiSeatId>(0);
  const phaseRef = useRef<UiGameView["phase"]>("loading");
  const [view, setView] = useState<UiGameView>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [curtainSeat, setCurtainSeat] = useState<UiSeatId>();

  const mountController = useCallback((controller: GameController) => {
    unsubscribeRef.current?.();
    controllerRef.current?.dispose();
    controllerRef.current = controller;
    const initial = controller.getView();
    currentSeatRef.current = initial.activeSeatId;
    phaseRef.current = initial.phase;
    setView(initial);
    setCurtainSeat(initial.mode === "pass-and-play" && initial.phase === "playing" ? initial.activeSeatId : undefined);
    unsubscribeRef.current = controller.subscribe(() => {
      const next = controller.getView();
      if (next.mode === "pass-and-play" && next.phase === "playing" && (next.activeSeatId !== currentSeatRef.current || phaseRef.current !== "playing")) {
        setCurtainSeat(next.activeSeatId);
      }
      currentSeatRef.current = next.activeSeatId;
      phaseRef.current = next.phase;
      setView(next);
      setBusy(false);
    });
    return initial.sessionId;
  }, []);

  const startLocal = useCallback(
    (names: readonly [string, string, string]) =>
      mountController(new LocalGameController({ mode: "pass-and-play", names } satisfies StartSessionOptions)),
    [mountController]
  );

  const startAi = useCallback(
    (humanName: string, difficulty: "easy" | "standard") =>
      mountController(
        new LocalGameController({
          mode: "human-vs-ai",
          names: [humanName, "Hana AI", "Duri AI"],
          aiSeats: [1, 2],
          difficulty
        })
      ),
    [mountController]
  );

  const dispatch = useCallback(async (action: UiAction) => {
    if (!controllerRef.current || busy) return false;
    setBusy(true);
    setError(undefined);
    const result = await controllerRef.current.dispatch(action);
    if (!result.ok) {
      setError(result.error ?? "Move rejected");
      setBusy(false);
    }
    return result.ok;
  }, [busy]);

  const revealHand = useCallback(() => setCurtainSeat(undefined), []);
  const coverHand = useCallback(() => {
    if (view?.mode === "pass-and-play" && view.phase === "playing") setCurtainSeat(view.activeSeatId);
  }, [view]);

  const reset = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;
    controllerRef.current?.dispose();
    controllerRef.current = undefined;
    setView(undefined);
    setError(undefined);
    setCurtainSeat(undefined);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") coverHand();
    });
    return () => subscription.remove();
  }, [coverHand]);

  useEffect(() => {
    const shouldProtect = Boolean(view?.phase === "playing" && !curtainSeat);
    const promise = shouldProtect
      ? ScreenCapture.preventScreenCaptureAsync()
      : ScreenCapture.allowScreenCaptureAsync();
    promise.catch(() => undefined);
    return () => {
      if (shouldProtect) ScreenCapture.allowScreenCaptureAsync().catch(() => undefined);
    };
  }, [curtainSeat, view?.phase]);

  useEffect(() => reset, [reset]);

  const value = useMemo<GameContextValue>(
    () => ({ view, busy, error, curtainSeat, startLocal, startAi, attachController: mountController, dispatch, revealHand, coverHand, reset }),
    [view, busy, error, curtainSeat, startLocal, startAi, mountController, dispatch, revealHand, coverHand, reset]
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside GameProvider");
  return value;
}
