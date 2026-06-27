/**
 * Locale-aware date formatting utilities.
 *
 * Use these instead of calling `toLocaleDateString('en-US')` directly.
 * - In client components, import `useFormatDate` and call `formatDate(date, opts)`.
 * - In server components, call `formatDate(date, locale, opts)` with the locale
 *   from `getLocaleFromHeaders(headers)`.
 */

type DateInput = string | number | Date

function normalizeLocale(locale: string): string {
  if (locale.startsWith('fr')) return 'fr-FR'
  return 'en-US'
}

/**
 * Format a date for display. Works in both server and client components.
 *
 * @param date - Date, timestamp, or ISO string
 * @param locale - BCP 47 locale tag (e.g. 'en', 'fr')
 * @param options - Intl.DateTimeFormat options
 */
export function formatDate(
  date: DateInput,
  locale: string = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return d.toLocaleDateString(normalizeLocale(locale), options)
}

/**
 * Format a date + time for display.
 */
export function formatDateTime(
  date: DateInput,
  locale: string = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  return d.toLocaleString(normalizeLocale(locale), options)
}

/**
 * Client-side hook that returns locale-aware formatters.
 * Uses `navigator.language` to detect the user's locale.
 */
export function detectClientLocale(): string {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language.startsWith('fr') ? 'fr' : 'en'
}

/**
 * Simple relative time formatter (e.g. "2 hours ago", "just now").
 * Falls back to formatDate for dates older than 7 days.
 */
export function timeAgo(date: DateInput, locale: string = 'en'): string {
  const now = Date.now()
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  const diffMs = now - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 10) return locale.startsWith('fr') ? "à l'instant" : 'just now'
  if (diffSec < 60) return locale.startsWith('fr') ? `il y a ${diffSec}s` : `${diffSec}s ago`
  if (diffMin < 60) return locale.startsWith('fr') ? `il y a ${diffMin}min` : `${diffMin}min ago`
  if (diffHr < 24) return locale.startsWith('fr') ? `il y a ${diffHr}h` : `${diffHr}h ago`
  if (diffDay < 7) return locale.startsWith('fr') ? `il y a ${diffDay}j` : `${diffDay}d ago`

  return formatDate(d, locale, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}
