import type { Config } from 'tailwindcss'
import { baseConfig } from '@omnysync/config/tailwind'

export default {
  ...baseConfig,
  content: ['./src/**/*.{ts,tsx}'],
} satisfies Config
