import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    env: {
      ENCRYPTION_KEY: "test-encryption-key-32-chars-minimum!",
      ENCRYPTION_SALT: "test-salt-value",
      OAUTH_ENCRYPTION_KEY: "test-oauth-key-for-testing-purposes!",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
