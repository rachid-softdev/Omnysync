import en from './en.json'
import fr from './fr.json'

const translations: Record<string, Record<string, string>> = {
  en,
  fr,
}

export function getLocaleFromHeaders(headers: Headers): string {
  const acceptLang = headers.get('Accept-Language') || 'en'
  if (acceptLang.includes('fr')) return 'fr'
  return 'en'
}

export function t(key: string, locale: string = 'en'): string {
  return translations[locale]?.[key] || translations.en?.[key] || key
}

/**
 * Request-scoped translator for Server Components.
 *
 * Resolves the locale from `Accept-Language` once so every string on a page
 * comes from the same dictionary. Pair it with `useTranslations` on the client
 * (which reads `<html lang>`), so server and client output never disagree.
 */
export async function getT() {
  const { headers } = await import('next/headers')
  const locale = getLocaleFromHeaders(await headers())
  return (key: string) => t(key, locale)
}
