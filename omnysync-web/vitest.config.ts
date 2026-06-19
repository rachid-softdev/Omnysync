import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    env: {
      DATABASE_URL: 'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public',
      NEXTAUTH_SECRET: 'test-secret',
      NEXTAUTH_URL: 'http://localhost:3000',
      ENCRYPTION_KEY: 'test-encryption-key-32-chars-minimum!',
      ENCRYPTION_SALT: 'test-salt-value',
      OAUTH_ENCRYPTION_KEY: 'test-oauth-key-for-testing-purposes!',
    },
    setupFiles: ['./src/__tests__/setup-core-mock.ts', './src/__tests__/setup-global.ts'],
    server: {
      deps: {
        inline: ['@radix-ui'],
      },
    },
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
      // Use source files so vi.mock can intercept individual module imports
      '@omnysync/core': path.resolve(__dirname, '../packages/omnysync-core/src'),
      // Explicit sub-path aliases for common @omnysync/core sub-imports
      '@omnysync/core/prisma': path.resolve(
        __dirname,
        '../packages/omnysync-core/src/prisma/index.ts'
      ),
      '@omnysync/core/services': path.resolve(__dirname, '../packages/omnysync-core/src/services'),
      '@omnysync/core/auth': path.resolve(__dirname, '../packages/omnysync-core/src/auth'),
      '@omnysync/core/entitlements': path.resolve(
        __dirname,
        '../packages/omnysync-core/src/entitlements'
      ),
      '@omnysync/core/crypto': path.resolve(__dirname, '../packages/omnysync-core/src/crypto'),
      '@omnysync/core/subscriptions': path.resolve(
        __dirname,
        '../packages/omnysync-core/src/subscriptions'
      ),
      '@omnysync/core/hooks': path.resolve(__dirname, '../packages/omnysync-core/src/hooks'),
      // Force React resolution to the web app's node_modules so packages in the
      // root node_modules (e.g. @radix-ui/*) can find react (pnpm doesn't hoist it)
      react: path.resolve(__dirname, 'node_modules/react'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client.js'),
      'react-dom/server': path.resolve(__dirname, 'node_modules/react-dom/server.js'),
    },
  },
})
