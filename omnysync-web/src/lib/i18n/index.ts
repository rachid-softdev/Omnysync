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
