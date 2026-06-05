import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    prisma: "src/prisma/index.ts",
    ui: "src/ui/index.ts",
    crypto: "src/crypto/index.ts",
    "services/two-factor": "src/services/two-factor.ts",
    "services/password-reset": "src/services/password-reset.ts",
    "services/sync": "src/services/sync.ts",
    "services/two-way-sync": "src/services/two-way-sync.ts",
    "services/image-upload": "src/services/image-upload.ts",
    "services/ai": "src/services/ai.ts",
    "services/email-verification": "src/services/email-verification.ts",
    "services/scheduler": "src/services/scheduler.ts",
    "services/queue": "src/services/queue.ts",
    "services/authz": "src/services/authz.ts",
    "services/sanitize": "src/services/sanitize.ts",
    "services/ai-usage": "src/services/ai-usage.ts",
    "services/html-parser": "src/services/html-parser.ts",
    "services/google-docs": "src/services/google-docs.ts",
    "services/notion": "src/services/notion.ts",
    "services/wordpress": "src/services/wordpress.ts",
    "services/ghost": "src/services/ghost.ts",
    "services/webflow": "src/services/webflow.ts",
    "services/shopify": "src/services/shopify.ts",
    "services/medium": "src/services/medium.ts",
    "services/airtable": "src/services/airtable.ts",
    "services/contentful": "src/services/contentful.ts",
  },
  format: ["esm", "cjs"],
  // DTS désactivé temporairement : la base de code a des erreurs préexistantes
  // dans sync.ts que les flags stricts révèlent.
  // Réactiver après refactoring de sync.ts, scheduler.ts, queue.ts
  // Utiliser `tsc --noEmit --project tsconfig.strict.json` pour vérifier le typage
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  jsx: "preserve",
  external: [
    "react",
    "react-dom",
    "bcrypt",
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "otpauth",
  ],
});
