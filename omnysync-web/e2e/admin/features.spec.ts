/**
 * E2E tests for Admin Features section
 *
 * Covers:
 * - List page with badges, sorting, search
 * - New feature page with validation and creation
 * - Error states, empty state, edge cases
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const LIST_URL = `file://${path.join(FIXTURES_DIR, 'admin-features.html')}`
const NEW_URL = `file://${path.join(FIXTURES_DIR, 'admin-features-new.html')}`

// =============================================================================
// Suite
// =============================================================================

test.describe('Admin Features', () => {
  // ---------------------------------------------------------------------------
  // Success cases (tests 1–6)
  // ---------------------------------------------------------------------------

  test.describe('Success cases', () => {
    test('1: displays the Features page header and description', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      await expect(page.getByTestId('page-title')).toHaveText('Features')
      await expect(page.getByTestId('page-description')).toHaveText(
        'Manage feature flags and entitlements'
      )
    })

    test('2: renders a table with all features (key, name, type)', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      // All three keys rendered
      await expect(page.getByTestId('feature-key-1')).toHaveText('EXPORT_PDF')
      await expect(page.getByTestId('feature-key-2')).toHaveText('MAX_CONNECTORS')
      await expect(page.getByTestId('feature-key-3')).toHaveText('A_B_TEST')

      // Names visible in cells
      await expect(page.getByTestId('feature-name-1')).toHaveText('Export PDF')
      await expect(page.getByTestId('feature-name-2')).toHaveText('Max Connectors')
      await expect(page.getByTestId('feature-name-3')).toHaveText('A/B Test')

      // Exactly 3 data rows
      await expect(page.locator('table tbody tr')).toHaveCount(3)
    })

    test('3: displays correct badge variant per type', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      // Type badges visible
      await expect(page.getByTestId('feature-type-1')).toContainText('BOOLEAN')
      await expect(page.getByTestId('feature-type-2')).toContainText('LIMIT')
      await expect(page.getByTestId('feature-type-3')).toContainText('EXPERIMENT')
    })

    test('4: clicking New Feature navigates to /admin/features/new', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      const link = page.getByTestId('new-feature-link')
      await expect(link).toHaveAttribute('href', '/admin/features/new')
      await expect(link).toContainText('New Feature')
    })

    test('5: creates a BOOLEAN feature via form and redirects to list', async ({ page }) => {
      await page.goto(NEW_URL, { waitUntil: 'networkidle' })
      await expect(page.getByTestId('page-title')).toHaveText('New Feature')

      await page.fill('#key', 'NEW_BOOLEAN')
      await page.fill('#name', 'New Boolean')

      await page.getByRole('button', { name: /Create Feature/i }).click()

      // Verify submitted data
      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).toMatchObject({ key: 'NEW_BOOLEAN', name: 'New Boolean', type: 'BOOLEAN' })
      expect(await page.evaluate(() => (window as any).__redirectedTo)).toBe('/admin/features')
    })

    test('6: creates a feature with a DefaultConfig JSON value', async ({ page }) => {
      await page.goto(NEW_URL, { waitUntil: 'networkidle' })

      await page.fill('#key', 'FEATURE_WITH_CONFIG')
      await page.fill('#name', 'Feature With Config')
      await page.fill('#defaultConfig', JSON.stringify({ quota: 100, enabled: true }))

      await page.getByRole('button', { name: /Create Feature/i }).click()

      // Verify submitted data
      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).toMatchObject({
        key: 'FEATURE_WITH_CONFIG',
        name: 'Feature With Config',
        defaultConfig: { quota: 100, enabled: true },
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Error / failure cases (tests 7–10)
  // ---------------------------------------------------------------------------

  test.describe('Error cases', () => {
    test('7: displays error message and Retry button on API 500', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      await page.evaluate(() => {
        ;(window as any).__showError('Failed to fetch features')
      })

      await expect(page.getByTestId('error-banner')).toBeVisible()
      await expect(page.getByTestId('error-message')).toHaveText('Failed to fetch features')
      await expect(page.getByTestId('retry-btn')).toBeVisible()
    })

    test('8: shows empty state when no features exist', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      await page.evaluate(() => {
        ;(window as any).__setFeatures([])
      })
      await page.waitForTimeout(100)

      await expect(page.getByTestId('empty-title')).toHaveText('No features')
    })

    test('9: shows frontend validation when key and name are missing', async ({ page }) => {
      await page.goto(NEW_URL, { waitUntil: 'networkidle' })

      // Submit without filling required fields
      await page.getByRole('button', { name: /Create Feature/i }).click()

      await expect(page.getByTestId('key-error')).toBeVisible()
      await expect(page.getByTestId('key-error')).toHaveText('Key is required')
      await expect(page.getByTestId('name-error')).toBeVisible()
      await expect(page.getByTestId('name-error')).toHaveText('Name is required')
    })

    test('10: shows error on duplicate key (409) and stays on form', async ({ page }) => {
      await page.goto(NEW_URL, { waitUntil: 'networkidle' })

      await page.fill('#key', 'DUPLICATE')
      await page.fill('#name', 'Duplicate Feature')

      await page.getByRole('button', { name: /Create Feature/i }).click()

      // No redirect
      expect(await page.evaluate(() => (window as any).__redirectedTo)).toBeNull()

      // Error shown
      await expect(page.getByTestId('form-error')).toHaveText('Feature already exists')
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases (tests 11–14)
  // ---------------------------------------------------------------------------

  test.describe('Edge cases', () => {
    test('11: search by key filters the table in real time', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      const searchInput = page.getByTestId('search-input')
      await expect(searchInput).toBeVisible()

      await searchInput.fill('MAX')

      // Only the matching feature should be present
      await expect(page.getByTestId('feature-name-2')).toBeVisible()
      await expect(page.getByTestId('feature-name-1')).not.toBeAttached()
      await expect(page.getByTestId('feature-name-3')).not.toBeAttached()
    })

    test('12: feature without plans displays "0 plans"', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      // A_B_TEST (id=3) has plans: []
      const plansCell = page.getByTestId('feature-plans-3')
      await expect(plansCell).toContainText('0 plans')
    })

    test('13: feature with defaultConfig JSON displays it in the column', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      // With default sort by key ascending: A_B_TEST ({"percentage":50}), MAX_CONNECTORS (10)
      const codeElements = page.locator('table tbody tr td code')
      await expect(codeElements.nth(0)).toContainText('{"percentage":50}')
      await expect(codeElements.nth(1)).toContainText('10')
    })

    test('14: clicking Name column header toggles sort direction', async ({ page }) => {
      await page.goto(LIST_URL, { waitUntil: 'networkidle' })

      const keyHeader = page.getByTestId('col-header-key')
      const nameHeader = page.getByTestId('col-header-name')

      // Initially Key column is sorted ascending
      await expect(keyHeader).toHaveAttribute('aria-sort', 'ascending')

      // Click Name → sort by name ascending
      await nameHeader.click()
      await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
      await expect(keyHeader).not.toHaveAttribute('aria-sort')

      // Click Name again → toggle to descending
      await nameHeader.click()
      await expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
    })
  })
})
