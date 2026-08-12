import { describe, expect, it } from "vitest";
import {
  assertSessionInvariants,
  createSeededRng,
  createSession,
  getLegalActions,
  reduceSession,
  type PlayerCommand,
} from "../src/index";

const SIMULATION_COUNT = 10_000;
const MAX_COMMANDS_PER_DEAL = 200;

function selectCommand(actions: readonly PlayerCommand[], random: number): PlayerCommand {
  const stop = actions.find((action) => action.type === "choose-stop");
  return stop ?? actions[random % actions.length]!;
}

describe("10,000-deal deterministic conservation gate", () => {
  it("terminates, conserves all cards/chips, and replays every command log byte-for-byte", () => {
    for (let seed = 1; seed <= SIMULATION_COUNT; seed += 1) {
      const rng = createSeededRng(seed);
      let state = createSession({
        sessionId: `gate-${seed}`,
        mode: "human-vs-ai",
        rng,
        dealerSeat: 0,
      });
      const commands: PlayerCommand[] = [];

      while (state.phase === "playing" && commands.length < MAX_COMMANDS_PER_DEAL) {
        const actions = getLegalActions(state, state.round!.currentSeat);
        if (actions.length === 0) {
          throw new Error(
            `Seed ${seed} exposed an empty legal action set: ${JSON.stringify({
              phase: state.phase,
              roundPhase: state.round!.phase,
              currentSeat: state.round!.currentSeat,
              handCounts: [0, 1, 2].map(
                (seatId) => state.round!.players[seatId as 0 | 1 | 2].hand.length,
              ),
              stockCount: state.round!.stock.length,
              pendingChoice: state.round!.pendingChoice,
            })}`,
          );
        }
        const command = selectCommand(actions, rng.nextUint32());
        const result = reduceSession(state, command, { rng });
        if (!result.ok) throw new Error(`Seed ${seed} rejected a legal command: ${result.error.message}`);
        state = result.state;
        commands.push(command);
        assertSessionInvariants(state);
      }

      if (state.phase === "playing") {
        throw new Error(`Seed ${seed} did not terminate within ${MAX_COMMANDS_PER_DEAL} commands`);
      }
      expect(state.seats.reduce((sum, seat) => sum + seat.chips, 0) + state.pot).toBe(150);

      const replayRng = createSeededRng(seed);
      let replay = createSession({
        sessionId: `gate-${seed}`,
        mode: "human-vs-ai",
        rng: replayRng,
        dealerSeat: 0,
      });
      for (const command of commands) {
        const result = reduceSession(replay, command, { rng: replayRng });
        if (!result.ok) throw new Error(`Seed ${seed} replay rejected ${command.type}`);
        replay = result.state;
      }
      expect(JSON.stringify(replay)).toBe(JSON.stringify(state));
    }
  });
});
