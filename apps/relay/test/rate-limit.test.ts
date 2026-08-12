import { describe, expect, it } from "vitest";

import { takeRateLimit } from "../src";

describe("isolate-local abuse backstop", () => {
  it("fails closed after the configured window count", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(takeRateLimit(key, 2, 1_000)).toBe(true);
    expect(takeRateLimit(key, 2, 1_001)).toBe(true);
    expect(takeRateLimit(key, 2, 1_002)).toBe(false);
    expect(takeRateLimit(key, 2, 3_601_001)).toBe(true);
  });
});
