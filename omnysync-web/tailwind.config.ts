import type { Config } from "@omnysync/config/tailwind"
import { baseConfig } from "@omnysync/config/tailwind"

export default {
  ...baseConfig,
  content: ["./src/**/*.{ts,tsx}"],
} satisfies Config
