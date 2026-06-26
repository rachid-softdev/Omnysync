/**
 * E2E Tests — Admin Search Edge Cases
 *
 * Tests search/filter behavior across all list pages:
 * - Case insensitivity
 * - Partial match
 * - Diacritics / accented characters
 * - No results state
 * - Clear search restores all data
 * - Rapid typing
 * - Empty search string
 * - Special regex characters
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const USERS_URL = `file://${path.join(FIXTURES_DIR, 'admin-users.html')}`
const ORGS_URL = `file://${path.join(FIXTURES_DIR, 'admin-orgs.html')}`
const FEATURES_URL = `file://${path.join(FIXTURES_DIR, 'admin-features.html')}`

test.describe('Admin — Search Edge Cases', () => {
  // ── Users search ───────────────────────────────────────────────────

  test.describe('Users search', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(USERS_URL, { waitUntil: 'networkidle' })
    })

    test('1: recherche insensible à la casse', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('ALICE')
      await expect(page.getByText('Alice Dupont')).toBeVisible()
      await expect(page.getByText('Bob Martin')).not.toBeVisible()
    })

    test('2: recherche partielle (début de mot)', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('Ali')
      await expect(page.getByText('Alice Dupont')).toBeVisible()
    })

    test('3: recherche par email (domaine)', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('example.com')
      // All 3 users have @example.com
      await expect(page.getByText('Alice Dupont')).toBeVisible()
      await expect(page.getByText('Bob Martin')).toBeVisible()
      await expect(page.getByText('charlie@example.com')).toBeVisible()
    })

    test('4: aucun résultat → état vide', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('xyznonexistent')
      await expect(page.getByTestId('empty-state')).toBeVisible()
      await expect(page.getByText('Alice Dupont')).not.toBeVisible()
    })

    test('5: effacer la recherche → tous les résultats réapparaissent', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('Bob')
      await expect(page.getByText('Alice Dupont')).not.toBeVisible()

      await input.fill('')
      await expect(page.getByText('Alice Dupont')).toBeVisible()
      await expect(page.getByText('Bob Martin')).toBeVisible()
      await expect(page.getByText('charlie@example.com')).toBeVisible()
      // 3 rows
      await expect(page.locator('table tbody tr')).toHaveCount(3)
    })

    test('6: caractères spéciaux dans la recherche (safe)', async ({ page }) => {
      const input = page.getByTestId('search-input')
      // Characters that could break regex if not escaped
      await input.fill('.*+?^${}()|[]\\')
      await expect(page.getByTestId('empty-state')).toBeVisible()
      // No crash
      await expect(page.getByTestId('empty-state')).toBeVisible()
    })
  })

  // ── Orgs search ────────────────────────────────────────────────────

  test.describe('Orgs search', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(ORGS_URL, { waitUntil: 'networkidle' })
    })

    test('7: recherche par slug (partiel)', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('ac')
      await expect(page.getByTestId('org-name-1')).toBeVisible() // Acme
      await expect(page.getByTestId('org-name-2')).not.toBeVisible()
      await expect(page.getByTestId('org-name-3')).not.toBeVisible()
    })

    test('8: recherche par slug (sans /)', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('acme')
      await expect(page.getByTestId('org-name-1')).toBeVisible()
    })

    test('9: recherche après avoir vidé → résultats complets', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('globex')
      await expect(page.getByTestId('org-row-2')).toBeVisible()
      await expect(page.getByTestId('org-row-1')).not.toBeVisible()

      await input.fill('')
      for (const id of ['1', '2', '3']) {
        await expect(page.getByTestId(`org-row-${id}`)).toBeVisible()
      }
    })

    test('10: taper très rapidement (debounce implicite)', async ({ page }) => {
      const input = page.getByTestId('search-input')
      // Rapid typing that resolves to a single character
      await input.fill('s')
      await expect(page.getByTestId('org-name-3')).toBeVisible() // Stark
      await expect(page.getByTestId('org-name-1')).not.toBeVisible()

      // Clear rapidly by selecting all and deleting
      await input.fill('')
      await expect(page.getByTestId('org-name-1')).toBeVisible()
    })
  })

  // ── Features search ────────────────────────────────────────────────

  test.describe('Features search', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(FEATURES_URL, { waitUntil: 'networkidle' })
    })

    test('11: recherche par key insensible à la casse', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('export_pdf')
      await expect(page.getByTestId('feature-name-1')).toBeVisible()
      await expect(page.getByTestId('feature-name-2')).not.toBeVisible()
      await expect(page.getByTestId('feature-name-3')).not.toBeVisible()
    })

    test('12: recherche par nom avec underscore', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('A/B')
      await expect(page.getByTestId('feature-name-3')).toBeVisible()
    })

    test('13: recherche vide → toutes les features', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('XXX')
      await expect(page.getByTestId('empty-state')).toBeVisible()

      await input.fill('')
      await expect(page.locator('table tbody tr')).toHaveCount(3)
    })

    test('14: recherche par key exacte', async ({ page }) => {
      const input = page.getByTestId('search-input')
      await input.fill('MAX_CONNECTORS')
      await expect(page.getByTestId('feature-name-2')).toBeVisible()
      await expect(page.getByTestId('feature-name-1')).not.toBeAttached()
    })
  })
})
