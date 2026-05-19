import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    prisma: "src/prisma/index.ts",
    ui: "src/ui/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
});
