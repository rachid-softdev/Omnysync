import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Disable turbopack for this project due to fs import issues
  serverExternalPackages: ['fs', 'path'],
  turbopack: {
    resolveAlias: {
      // Route @prisma/client to the single shared generated client, mirroring
      // the tsconfig `paths` and vitest aliases. Turbopack does not resolve the
      // legacy `.prisma/client` dot-directory that the @prisma/client package
      // falls back to, which left the module empty in the production bundle
      // (runtime enum exports such as DocumentStatus were `undefined`).
      '@prisma/client': './prisma/generated/client/index.js',
    },
  },
  // Le typecheck se fait via \	sc --noEmit\ séparé
  typescript: { ignoreBuildErrors: true },
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // NOTE: no enforcing CSP here. Next.js injects inline bootstrap
          // scripts; a static `script-src 'self'` policy blocks hydration.
          // The middleware emits a Report-Only policy while we migrate to a
          // per-request nonce (requires dynamic rendering — see the CSP guide).
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // === CORS headers ===
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'production' ? 'https://omnysync.app' : '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'oaidalleapiprodscus.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
    ],
  },
}

export default nextConfig
