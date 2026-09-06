import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    /* Anything over this is printed with its time. The budget is a whole
       suite under a minute; a test that needs seconds is testing the wrong
       layer, and this is how it gets noticed. */
    slowTestThreshold: 300,
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
});
