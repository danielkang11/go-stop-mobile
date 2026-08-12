import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/simulation.test.ts"],
    testTimeout: 120_000,
  },
});
