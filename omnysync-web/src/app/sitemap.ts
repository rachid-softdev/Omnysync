import type { MetadataRoute } from 'next'

// Use NEXT_PUBLIC_APP_URL (public-facing canonical URL) instead of NEXTAUTH_URL
// because NEXTAUTH_URL may point to an internal server URL (e.g. localhost or
// a container hostname) that is not resolvable by search engines.
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://omnysync.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/auth/signin`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
  ]

  return [...staticPages]
}
