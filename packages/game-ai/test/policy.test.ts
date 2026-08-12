import { describe, expect, it } from "vitest";

import { createSeededRandom } from "../src/policy";

describe("createSeededRandom", () => {
  it("replays the same stream", () => {
    const one = createSeededRandom(42);
    const two = createSeededRandom(42);
    expect([one(), one(), one()]).toEqual([two(), two(), two()]);
  });

  it("stays inside the unit interval", () => {
    const random = createSeededRandom(7);
    for (let index = 0; index < 100; index += 1) {
      expect(random()).toBeGreaterThanOrEqual(0);
      expect(random()).toBeLessThan(1);
    }
  });
});
