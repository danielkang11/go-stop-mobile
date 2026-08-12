import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["test/simulation.test.ts", "**/node_modules/**"],
  },
});
