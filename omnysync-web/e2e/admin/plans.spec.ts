/**
 * E2E Tests — Admin Plans
 *
 * Tests for the plan listing page (/admin/plans) and the
 * plan creation page (/admin/plans/new).
 *
 * Strategy: static HTML fixtures with embedded JavaScript —
 * no server required.
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const LIST_URL = `file://${path.join(FIXTURES_DIR, 'admin-plans.html')}`
const NEW_URL = `file://${path.join(FIXTURES_DIR, 'admin-plans-new.html')}`

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Admin Plans — List page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_URL, { waitUntil: 'networkidle' })
  })

  // ─── Success cases ─────────────────────────────────────────────────

  test('1: displays all plans with correct names and prices', async ({ page }) => {
    // All four plan names
    await expect(page.getByTestId('plan-name-1')).toHaveText('Free')
    await expect(page.getByTestId('plan-name-2')).toHaveText('Pro')
    await expect(page.getByTestId('plan-name-3')).toHaveText('Enterprise')
    await expect(page.getByTestId('plan-name-4')).toHaveText('Legacy Plan')

    // Prices
    await expect(page.getByTestId('plan-monthly-1')).toContainText('$0.00')
    await expect(page.getByTestId('plan-monthly-2')).toContainText('$29.00')
    await expect(page.getByTestId('plan-monthly-3')).toContainText('$99.00')

    // Em-dash for null prices
    await expect(page.getByTestId('plan-monthly-4')).toContainText('\u2014')
  })

  test('2: shows Actif / Inactif badges based on isActive', async ({ page }) => {
    // Three active plans → 3 "Actif" badges (only in the Status column, 5th column)
    const activeBadges = page.locator(
      'table tbody tr td:nth-child(5) span:has-text("Actif"):not(:has-text("Inactif"))'
    )
    await expect(activeBadges).toHaveCount(3)
    // One inactive plan → 1 "Inactif" badge
    const inactiveBadges = page.locator('table tbody tr td:nth-child(5) span:has-text("Inactif")')
    await expect(inactiveBadges).toHaveCount(1)
  })

  test('3: displays correct feature counts per plan', async ({ page }) => {
    const body = page.locator('tbody')
    await expect(body.getByText('0 features')).toHaveCount(2) // Free, Legacy
    await expect(body.getByText('1 feature')).toBeVisible() // Pro
    await expect(body.getByText('2 features')).toBeVisible() // Enterprise
  })

  test('4: clicks New Plan button and navigates to creation page', async ({ page }) => {
    const link = page.getByTestId('new-plan-link')
    await expect(link).toHaveAttribute('href', '/admin/plans/new')
    await expect(link).toContainText('New Plan')
  })

  // ─── Error / Edge cases ────────────────────────────────────────────

  test('6: shows error message when API returns 500', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Failed to fetch plans')
    })

    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText('Failed to fetch plans')
  })

  test('7: shows empty state when no plans exist', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__setPlans([])
    })
    await page.waitForTimeout(100)

    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toContainText('No plans')
  })

  test('10: plan with priceMonthly=0 displays $0.00 not em-dash', async ({ page }) => {
    // Free plan already has priceMonthly: 0
    await expect(page.getByTestId('plan-monthly-1')).toContainText('$0.00')
  })

  test('11: plan with priceMonthly=null displays em-dash', async ({ page }) => {
    // Legacy Plan has priceMonthly: null
    await expect(page.getByTestId('plan-monthly-4')).toContainText('\u2014')
  })

  test('12: inactive plan badge has gray styling', async ({ page }) => {
    const inactiveBadge = page.locator('span').filter({ hasText: 'Inactif' })
    await expect(inactiveBadge).toHaveCount(1)

    const classAttr = await inactiveBadge.getAttribute('class')
    expect(classAttr).toContain('bg-gray-100')
  })
})

// ---------------------------------------------------------------------------
// Creation page
// ---------------------------------------------------------------------------

test.describe('Admin Plans — Creation page', () => {
  test('5: creates a plan successfully and redirects to list', async ({ page }) => {
    await page.goto(NEW_URL, { waitUntil: 'networkidle' })

    // Fill the form
    await page.getByLabel(/Key/i).fill('test-plan')
    await page.getByLabel(/Name/i).fill('Test Plan')
    await page.getByLabel(/Price Monthly/i).fill('19.99')
    await page.getByLabel(/Price Yearly/i).fill('199.99')

    // Submit
    await page.getByRole('button', { name: /Create Plan/i }).click()

    // Verify submitted data
    const data = await page.evaluate(() => (window as any).__submittedData)
    expect(data).toMatchObject({
      key: 'test-plan',
      name: 'Test Plan',
      priceMonthly: 19.99,
      priceYearly: 199.99,
    })
    expect(await page.evaluate(() => (window as any).__redirectedTo)).toBe('/admin/plans')
  })

  test('8: shows validation error when key is missing', async ({ page }) => {
    await page.goto(NEW_URL, { waitUntil: 'networkidle' })

    // Fill everything except key
    await page.getByLabel(/Name/i).fill('My Plan')
    await page.getByLabel(/Price Monthly/i).fill('10')

    // Submit without key
    await page.getByRole('button', { name: /Create Plan/i }).click()

    // Client-side validation error should appear
    await expect(page.getByTestId('key-error')).toHaveText('Key is required')
  })

  test('9: shows error when submitting a duplicate plan key', async ({ page }) => {
    await page.goto(NEW_URL, { waitUntil: 'networkidle' })

    // Fill the form with an existing key
    await page.getByLabel(/Key/i).fill('pro')
    await page.getByLabel(/Name/i).fill('Pro Duplicate')
    await page.getByLabel(/Price Monthly/i).fill('29')

    // Submit
    await page.getByRole('button', { name: /Create Plan/i }).click()

    // The page shows the error
    await expect(page.getByTestId('form-error')).toHaveText("Plan 'pro' already exists")
  })
})
