import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: { provider: "v8", include: ["src/**"], exclude: ["src/contracts/**", "src/components/ui/**", "src/test/**"] },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
