import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://omnysync.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/dashboard/', '/_next/', '/static/'],
      },
      // Allow specific paths for SEO
      {
        userAgent: '*',
        allow: ['/pricing', '/blog', '/blog/'],
      },
      // Sitemap location
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
