"use client"

import { useState, useEffect, useCallback } from "react"

const TranslationCache: Record<string, Record<string, string>> = {}

export function useTranslations(locale: string = "en") {
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const loadTranslations = useCallback(async () => {
    if (TranslationCache[locale]) {
      setTranslations(TranslationCache[locale])
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/i18n?locale=${locale}`)
      const data = await res.json()
      TranslationCache[locale] = data
      setTranslations(data)
    } catch (error) {
      console.error("Failed to load translations:", error)
    } finally {
      setLoading(false)
    }
  }, [locale])

  useEffect(() => {
    setLoading(true)
    loadTranslations()
  }, [loadTranslations])

  const t = useCallback((key: string): string => {
    return translations[key] || key
  }, [translations])

  return { t, loading, locale }
}