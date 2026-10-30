import type { Metadata } from 'next'
import { IBM_Plex_Mono, Schibsted_Grotesk } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from '@/components/providers'
import { PublicSkipLink } from '@/components/public-skip-link'
import { Header } from '@/components/header'
import { getLocaleFromHeaders, t } from '@/lib/i18n'
import { getBaseUrl } from '@/lib/metadata'

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
  const locale = getLocaleFromHeaders(await headers())
  const title = t('META_HOME_TITLE', locale)
  const description = t('META_HOME_DESC', locale)
  const ogLocale = locale === 'fr' ? 'fr_FR' : 'en_US'

  return {
    metadataBase: new URL(getBaseUrl()),
    title: {
      default: title,
      template: '%s | Omnysync',
    },
    description,
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
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
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
          <PublicSkipLink />
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  )
}
