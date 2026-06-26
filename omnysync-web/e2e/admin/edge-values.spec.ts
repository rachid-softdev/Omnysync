/**
 * E2E Tests — Admin Valeurs limites (Edge Values)
 *
 * Tests the display of edge-case dates, prices, limits, and percentages
 * on admin pages. All data is served from a static HTML fixture with
 * embedded JavaScript — no server required.
 *
 * Dates are formatted in UTC for deterministic rendering across timezones.
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const EDGE_URL = `file://${path.join(FIXTURES_DIR, 'admin-edge-values.html')}`

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Admin — Valeurs limites (Edge Cases)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDGE_URL, { waitUntil: 'networkidle' })
  })

  // =========================================================================
  // 1 — Date epoch (1970-01-01) affichée en français
  // =========================================================================
  test('1 — date epoch 1970-01-01 affiche "1 janvier 1970"', async ({ page }) => {
    await expect(page.getByTestId('date-value-epoch')).toHaveText('1 janvier 1970')
  })

  // =========================================================================
  // 2 — Date Y2038 (2038-01-19) affichée correctement
  // =========================================================================
  test('2 — date Y2038 2038-01-19 affiche "19 janvier 2038"', async ({ page }) => {
    await expect(page.getByTestId('date-value-y2038')).toHaveText('19 janvier 2038')
  })

  // =========================================================================
  // 3 — Année bissextile : 2024-02-29 affiche "29 février 2024"
  // =========================================================================
  test('3 — année bissextile 2024-02-29 affiche "29 février 2024"', async ({ page }) => {
    await expect(page.getByTestId('date-value-leap')).toHaveText('29 février 2024')
  })

  // =========================================================================
  // 4 — Année non bissextile : 2025-02-28 affiche "28 février 2025"
  // =========================================================================
  test('4 — année non bissextile 2025-02-28 affiche "28 février 2025"', async ({ page }) => {
    await expect(page.getByTestId('date-value-non-leap')).toHaveText('28 février 2025')
  })

  // =========================================================================
  // 5 — Changement d'année : 2026-12-31 et 2027-01-01
  // =========================================================================
  test("5 — changement d'année : 31 décembre 2026 puis 1 janvier 2027", async ({ page }) => {
    await expect(page.getByTestId('date-value-year-end')).toHaveText('31 décembre 2026')
    await expect(page.getByTestId('date-value-year-start')).toHaveText('1 janvier 2027')
  })

  // =========================================================================
  // 6 — Date nulle affiche un tiret cadratin (—)
  // =========================================================================
  test('6 — date nulle affiche "\u2014"', async ({ page }) => {
    await expect(page.getByTestId('date-value-null')).toHaveText('\u2014')
  })

  // =========================================================================
  // 7 — Timezone UTC : date à 00:00:00 UTC ne change pas
  // =========================================================================
  test('7 — fuseau horaire UTC : 2026-06-15T00:00:00Z affiche "15 juin 2026"', async ({ page }) => {
    // The fixture formats dates with timeZone: 'UTC', so this date
    // always displays "15 juin 2026" regardless of the test runner TZ.
    await expect(page.getByTestId('date-value-tz-midnight')).toHaveText('15 juin 2026')
  })

  // =========================================================================
  // 8 — Prix à 0 $ affiche "$0.00" (pas de tiret)
  // =========================================================================
  test('8 — prix = 0 affiche "$0.00"', async ({ page }) => {
    await expect(page.getByTestId('price-value-zero')).toHaveText('$0.00')
  })

  // =========================================================================
  // 9 — Petit prix 0.01 $ affiche "$0.01"
  // =========================================================================
  test('9 — prix = 0.01 affiche "$0.01"', async ({ page }) => {
    await expect(page.getByTestId('price-value-small')).toHaveText('$0.01')
  })

  // =========================================================================
  // 10 — Grand prix 999999.99 $ formaté correctement
  // =========================================================================
  test('10 — prix = 999999.99 affiche "$999999.99"', async ({ page }) => {
    await expect(page.getByTestId('price-value-large')).toHaveText('$999999.99')
  })

  // =========================================================================
  // 11 — Prix null affiche un tiret cadratin (—)
  // =========================================================================
  test('11 — prix null affiche "\u2014"', async ({ page }) => {
    await expect(page.getByTestId('price-value-null')).toHaveText('\u2014')
  })

  // =========================================================================
  // 12 — limitValue = 0 affiche "0" (pas de tiret)
  // =========================================================================
  test('12 — limitValue = 0 affiche "0"', async ({ page }) => {
    await expect(page.getByTestId('limit-value-zero')).toHaveText('0')
  })

  // =========================================================================
  // 13 — limitValue = 999999999 affiché sans formatage scientifique
  // =========================================================================
  test('13 — limitValue = 999999999 affiche le nombre complet', async ({ page }) => {
    await expect(page.getByTestId('limit-value-large')).toHaveText('999999999')
  })

  // =========================================================================
  // 14 — limitValue négatif affiché avec le signe moins
  // =========================================================================
  test('14 — limitValue = -1 affiche "-1"', async ({ page }) => {
    await expect(page.getByTestId('limit-value-neg-one')).toHaveText('-1')
  })
})
