'use client'

import { useCallback, useSyncExternalStore } from 'react'
import en from './en.json'
import fr from './fr.json'

const dictionaries: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
  fr: fr as Record<string, string>,
}
const english = en as Record<string, string>

function detectLocale(): string {
  if (typeof document === 'undefined') return 'en'
  // The server sets `<html lang>` from Accept-Language. Reading it keeps the
  // client in sync with server-rendered copy instead of guessing from
  // `navigator.language` (which caused mixed FR/EN pages).
  return document.documentElement.lang.startsWith('fr') ? 'fr' : 'en'
}

// The locale never changes after load (it's resolved per request), so there is
// nothing to subscribe to. `useSyncExternalStore` still gives React the right
// server snapshot, avoiding hydration mismatches for FR visitors.
const subscribe = () => () => {}
const getServerLocale = () => 'en'

/**
 * Client-side translator.
 *
 * Dictionaries are bundled so a client component never renders raw keys: the
 * previous fetch-based version displayed `UI_*` placeholders whenever the
 * `/api/i18n` request failed or was rate-limited.
 */
export function useTranslations(locale?: string) {
  const detectedLocale = useSyncExternalStore(subscribe, detectLocale, getServerLocale)
  const resolvedLocale = locale ? (locale.startsWith('fr') ? 'fr' : 'en') : detectedLocale
  const dictionary = dictionaries[resolvedLocale] ?? english

  const t = useCallback(
    (key: string): string => dictionary[key] || english[key] || key,
    [dictionary]
  )

  /**
   * Translate a template containing `{placeholders}`.
   *
   * Keeps word order in the dictionary instead of composing sentences in JSX,
   * which is required for French versus English phrasing.
   */
  const tf = useCallback(
    (key: string, values: Record<string, string | number>): string => {
      const template = dictionary[key] || english[key] || key
      return template.replace(/\{(\w+)\}/g, (match, token: string) => {
        const value = values[token]
        return value === undefined ? match : String(value)
      })
    },
    [dictionary]
  )

  return { t, tf, loading: false, locale: resolvedLocale }
}
