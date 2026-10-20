'use client'

import { useState, useEffect, useCallback } from 'react'
import enJson from './en.json'

const en: Record<string, string> = enJson

const TranslationCache: Record<string, Record<string, string>> = {}

function detectLocale(): string {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language || 'en'
  return lang.startsWith('fr') ? 'fr' : 'en'
}

export function useTranslations(locale?: string) {
  const [resolvedLocale] = useState(locale || detectLocale())
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const loadTranslations = useCallback(async () => {
    if (TranslationCache[resolvedLocale]) {
      setTranslations(TranslationCache[resolvedLocale])
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/i18n?locale=${resolvedLocale}`)
      const data = await res.json()
      TranslationCache[resolvedLocale] = data
      setTranslations(data)
    } catch (error) {
      console.error('Failed to load translations:', error)
    } finally {
      setLoading(false)
    }
  }, [resolvedLocale])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTranslations()
  }, [loadTranslations])

  const t = useCallback(
    (key: string): string => {
      // Until the locale finishes loading, fall back to English rather than
      // rendering raw keys (UI_SETTINGS, TEAM_TITLE, ...) in the UI.
      return translations[key] || en[key] || key
    },
    [translations]
  )

  return { t, loading, locale: resolvedLocale }
}
