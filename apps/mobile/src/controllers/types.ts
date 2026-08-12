import type { UiAction, UiGameView } from "../game/uiTypes";

export interface DispatchResult {
  ok: boolean;
  error?: string | undefined;
}

export interface GameController {
  subscribe(listener: () => void): () => void;
  getView(): UiGameView;
  dispatch(action: UiAction): Promise<DispatchResult>;
  dispose(): void;
}
