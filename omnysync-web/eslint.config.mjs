import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Node.js scripts (CommonJS) — tsconfig.json already excludes these
    'scripts/**',
  ]),
  // Relax rules for E2E test files (Playwright evaluates in browser context where types are dynamic)
  {
    files: ['e2e/**/*.ts', 'e2e/**/*.tsx', 'e2e/**/*.js', 'e2e/**/*.jsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])

export default eslintConfig
