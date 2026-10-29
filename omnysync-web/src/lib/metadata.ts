import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getLocaleFromHeaders, t } from '@/lib/i18n'

export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://omnysync.com'
  ).replace(/\/$/, '')
}

interface PageMetadataOptions {
  locale: string
  titleKey: string
  descriptionKey: string
  path: string
  index?: boolean
  absoluteTitle?: boolean
}

/**
 * Builds localized page metadata. Kept synchronous so it can be unit-tested
 * without mocking `next/headers`; `pageMetadata` resolves the request locale.
 */
export function buildPageMetadata({
  locale,
  titleKey,
  descriptionKey,
  path,
  index = true,
  absoluteTitle = false,
}: PageMetadataOptions): Metadata {
  const title = t(titleKey, locale)
  const description = t(descriptionKey, locale)
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: index ? { canonical: url } : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Omnysync',
      locale: locale === 'fr' ? 'fr_FR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
  }
}

export async function pageMetadata(
  options: Omit<PageMetadataOptions, 'locale'>
): Promise<Metadata> {
  const locale = getLocaleFromHeaders(await headers())
  return buildPageMetadata({ ...options, locale })
}
