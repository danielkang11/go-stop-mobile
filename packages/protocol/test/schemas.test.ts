import { describe, expect, it } from "vitest";

import { MAX_FRAME_BYTES, parseClientMessage } from "../src";

describe("parseClientMessage", () => {
  it("accepts a join hello", () => {
    const result = parseClientMessage(
      JSON.stringify({
        v: 1,
        type: "hello",
        clientBuild: "0.1.0",
        roomCode: "0123ABCD",
        supportedRulesVersions: ["mvp-2"],
        join: { displayName: "민수" },
      }),
    );

    expect(result.ok).toBe(true);
  });

  it("requires exactly one join mode", () => {
    const result = parseClientMessage(
      JSON.stringify({
        v: 1,
        type: "hello",
        clientBuild: "0.1.0",
        roomCode: "0123ABCD",
        supportedRulesVersions: ["mvp-2"],
      }),
    );

    expect(result).toMatchObject({ ok: false, code: "BAD_MESSAGE" });
  });

  it("rejects an oversized frame before parsing", () => {
    const result = parseClientMessage("x".repeat(MAX_FRAME_BYTES + 1));
    expect(result).toMatchObject({ ok: false, code: "FRAME_TOO_LARGE" });
  });

  it("rejects unknown command envelopes", () => {
    const result = parseClientMessage(
      JSON.stringify({ v: 1, type: "teleport", payload: {} }),
    );
    expect(result).toMatchObject({ ok: false, code: "BAD_MESSAGE" });
  });

  it("rejects clients that advertise only the legacy rules version", () => {
    const result = parseClientMessage(
      JSON.stringify({
        v: 1,
        type: "hello",
        clientBuild: "0.1.0",
        roomCode: "0123ABCD",
        supportedRulesVersions: ["mvp-1"],
        join: { displayName: "Legacy" },
      }),
    );

    expect(result).toMatchObject({ ok: false, code: "BAD_MESSAGE" });
  });
});
