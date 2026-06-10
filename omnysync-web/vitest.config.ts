import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      DATABASE_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public',
      NEXTAUTH_SECRET: 'test-secret',
      NEXTAUTH_URL: 'http://localhost:3000',
    },
    setupFiles: ['./src/__tests__/setup-core-mock.ts'],
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
