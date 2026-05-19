import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '*.test.ts',
        '*.test.tsx',
        '**/__tests__/**',
        '**/types/**',
        '**/*.d.ts',
        '**/prisma/**',
        'src/middleware.ts',
        'src/app/**',
        'components/**',
        '.next/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
