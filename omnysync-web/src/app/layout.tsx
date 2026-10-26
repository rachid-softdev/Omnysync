import type { Metadata } from 'next'
import { IBM_Plex_Mono, Schibsted_Grotesk } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from '@/components/providers'
import { Header } from '@/components/header'

// One display/UI family plus a mono for technical metadata (see DESIGN.md).
// The CSS variables are consumed by the `--font-sans` and `--font-mono` tokens.
const fontSans = Schibsted_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui',
})

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono-ui',
})

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language') || ''
  const locale = acceptLanguage.split(',')[0]?.split('-')[0] || 'en'
  const ogLocale = locale === 'fr' ? 'fr_FR' : 'en_US'

  return {
    title: {
      default: 'Omnysync - Content Routing for Publishers',
      template: '%s | Omnysync',
    },
    description:
      'Route a draft from Google Docs, Notion, Airtable or Contentful to the CMS you publish with. One destination per document, with a clear run log.',
    keywords: [
      'content routing',
      'publishing automation',
      'WordPress',
      'Ghost',
      'CMS',
      'scheduled sync',
    ],
    authors: [{ name: 'Omnysync' }],
    openGraph: {
      type: 'website',
      locale: ogLocale,
      siteName: 'Omnysync',
    },
    twitter: {
      card: 'summary_large_image',
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language') || ''
  const locale = acceptLanguage.split(',')[0]?.split('-')[0] || 'en'

  return (
    <html
      lang={locale}
      className={`${fontSans.variable} ${fontMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  )
}
