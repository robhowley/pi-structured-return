import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    root: path.resolve(import.meta.dirname, "src"),
    include: ["**/*.test.ts"],
  },
});
