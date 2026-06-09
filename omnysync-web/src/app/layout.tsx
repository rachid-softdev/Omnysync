import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from '@/components/providers'
import { Header } from '@/components/header'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: 'Omnysync - Sync Your Content Everywhere',
    template: '%s | Omnysync',
  },
  description:
    'Sync your content across all platforms automatically. Publish once, everywhere - WordPress, Ghost, Webflow, Shopify and more.',
  keywords: [
    'content sync',
    'multi-platform publishing',
    'WordPress',
    'Ghost',
    'CMS',
    'automation',
  ],
  authors: [{ name: 'Omnysync' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const acceptLanguage = headersList.get('accept-language') || ''
  const locale = acceptLanguage.split(',')[0]?.split('-')[0] || 'en'

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background`}>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  )
}
