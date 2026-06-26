import path from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [
      "./tests/setup.ts",
      "./omnysync-web/src/__tests__/setup-core-mock.ts",
    ],
    server: {
      deps: {
        inline: ["@radix-ui"],
      },
    },
    include: [
      "omnysync-web/src/**/*.{test,spec}.{ts,tsx}",
      "packages/**/src/**/*.{test,spec}.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/types.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "omnysync-web/src"),
      // Source-level aliases so vi.mock can intercept @omnysync/core modules
      "@omnysync/core": path.resolve(__dirname, "packages/omnysync-core/src"),
      "@omnysync/core/prisma": path.resolve(
        __dirname,
        "packages/omnysync-core/src/prisma/index.ts",
      ),
      "@omnysync/core/services": path.resolve(
        __dirname,
        "packages/omnysync-core/src/services",
      ),
      "@omnysync/core/auth": path.resolve(
        __dirname,
        "packages/omnysync-core/src/auth",
      ),
      "@omnysync/core/entitlements": path.resolve(
        __dirname,
        "packages/omnysync-core/src/entitlements",
      ),
      "@omnysync/core/crypto": path.resolve(
        __dirname,
        "packages/omnysync-core/src/crypto",
      ),
      "@omnysync/core/subscriptions": path.resolve(
        __dirname,
        "packages/omnysync-core/src/subscriptions",
      ),
      "@omnysync/core/hooks": path.resolve(
        __dirname,
        "packages/omnysync-core/src/hooks",
      ),
      // Force React resolution to the web app's node_modules so packages from
      // the root node_modules (e.g. @radix-ui/*) can find react (pnpm doesn't hoist it)
      react: path.resolve(__dirname, "omnysync-web/node_modules/react"),
      "react/jsx-runtime": path.resolve(
        __dirname,
        "omnysync-web/node_modules/react/jsx-runtime.js",
      ),
      "react/jsx-dev-runtime": path.resolve(
        __dirname,
        "omnysync-web/node_modules/react/jsx-dev-runtime.js",
      ),
      "react-dom": path.resolve(
        __dirname,
        "omnysync-web/node_modules/react-dom",
      ),
      "react-dom/client": path.resolve(
        __dirname,
        "omnysync-web/node_modules/react-dom/client.js",
      ),
      "react-dom/server": path.resolve(
        __dirname,
        "omnysync-web/node_modules/react-dom/server.js",
      ),
      // Resolve pnpm-hoisted dependencies (isolated node-linker doesn't hoist to workspace)
      zod: path.resolve(
        __dirname,
        "node_modules/.pnpm/zod@4.4.3/node_modules/zod",
      ),
      "server-only": path.resolve(
        __dirname,
        "omnysync-web/src/__tests__/__mocks__/server-only.ts",
      ),
      resend: path.resolve(
        __dirname,
        "omnysync-web/src/__tests__/__mocks__/resend.ts",
      ),
      "lucide-react": path.resolve(
        __dirname,
        "node_modules/.pnpm/lucide-react@1.18.0_react@19.2.7/node_modules/lucide-react",
      ),
      "@upstash/redis": path.resolve(
        __dirname,
        "node_modules/.pnpm/@upstash+redis@1.38.0/node_modules/@upstash/redis",
      ),
    },
  },
});
