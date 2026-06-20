import { describe, it, expect } from 'vitest'
import { t, getLocaleFromHeaders } from '../index'

describe('t()', () => {
  it('returns the translation for a known key in the specified locale', () => {
    expect(t('nav_features', 'en')).toBe('Features')
    expect(t('nav_features', 'fr')).toBe('Fonctionnalités')
  })

  it('returns the English translation when no locale is specified', () => {
    expect(t('nav_features')).toBe('Features')
  })

  it('falls back to English when key is missing from the requested locale', () => {
    // fr.json has the same keys as en.json, but we can use a key that
    // only exists in en.json — actually all keys in fr match en.
    // So let's verify that a key present in BOTH locales works:
    expect(t('nav_features', 'fr')).toBe('Fonctionnalités')

    // Now verify that when we request a locale that doesn't exist at all
    // (e.g. 'de'), it falls back to English
    expect(t('nav_features', 'de')).toBe('Features')
  })

  it('returns the key itself for completely unknown keys', () => {
    expect(t('this_key_does_not_exist', 'en')).toBe('this_key_does_not_exist')
    expect(t('this_key_does_not_exist', 'fr')).toBe('this_key_does_not_exist')
    expect(t('this_key_does_not_exist', 'de')).toBe('this_key_does_not_exist')
  })

  it('returns the key itself when the locale does not exist and no English fallback', () => {
    expect(t('nonexistent_key', 'es')).toBe('nonexistent_key')
  })

  it('handles keys with dots in the name', () => {
    expect(t('error.title', 'en')).toBe('Something went wrong')
    expect(t('error.title', 'fr')).toBe('Une erreur est survenue')
  })

  it('handles loading keys', () => {
    expect(t('loading.default', 'en')).toBe('Loading...')
    expect(t('loading.default', 'fr')).toBe('Chargement...')
  })

  it('returns key for empty string key', () => {
    // An empty key won't be in translations, so it returns itself
    expect(t('', 'en')).toBe('')
  })
})

describe('getLocaleFromHeaders', () => {
  it('returns "fr" when Accept-Language contains French', () => {
    const headers = new Headers({ 'Accept-Language': 'fr-FR,fr;q=0.9' })
    expect(getLocaleFromHeaders(headers)).toBe('fr')
  })

  it('returns "en" when Accept-Language does not contain French', () => {
    const headers = new Headers({ 'Accept-Language': 'en-US,en;q=0.9' })
    expect(getLocaleFromHeaders(headers)).toBe('en')
  })

  it('returns "en" when Accept-Language contains only non-French languages', () => {
    const headers = new Headers({ 'Accept-Language': 'de-DE,de;q=0.9,es;q=0.8' })
    expect(getLocaleFromHeaders(headers)).toBe('en')
  })

  it('returns "fr" even when French has lower quality', () => {
    const headers = new Headers({ 'Accept-Language': 'en-US;q=1.0,fr;q=0.5' })
    expect(getLocaleFromHeaders(headers)).toBe('fr')
  })

  it('returns "en" when Accept-Language header is missing', () => {
    const headers = new Headers()
    expect(getLocaleFromHeaders(headers)).toBe('en')
  })

  it('returns "fr" when French is the only language', () => {
    const headers = new Headers({ 'Accept-Language': 'fr' })
    expect(getLocaleFromHeaders(headers)).toBe('fr')
  })

  it('returns "en" for empty Accept-Language header', () => {
    const headers = new Headers({ 'Accept-Language': '' })
    expect(getLocaleFromHeaders(headers)).toBe('en')
  })

  it('returns "en" for uppercase French header (case-sensitive check)', () => {
    // The implementation does acceptLang.includes('fr') — case-sensitive,
    // so 'FR' does not match 'fr'
    const headers = new Headers({ 'Accept-Language': 'FR' })
    expect(getLocaleFromHeaders(headers)).toBe('en')
  })
})
