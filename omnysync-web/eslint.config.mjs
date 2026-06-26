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
  // Relax rules for E2E and unit test files (tests use dynamic types for mocking)
  {
    files: ['e2e/**/*.ts', 'e2e/**/*.tsx', 'e2e/**/*.js', 'e2e/**/*.jsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Type declaration stubs and utility files need `any` for compatibility
  {
    files: ['src/types/**', 'src/lib/monitoring.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Dashboard pages: useEffect → fetch → setState is an accepted pattern in this codebase
  {
    files: ['src/app/(dashboard)/dashboard/**/page.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])

export default eslintConfig
