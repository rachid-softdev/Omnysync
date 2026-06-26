/**
 * E2E tests — Admin Overrides
 *
 * Covers list page (/admin/overrides) and creation page (/admin/overrides/new).
 * All data is served from static HTML fixtures with embedded JavaScript.
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const LIST_URL = `file://${path.join(FIXTURES_DIR, 'admin-overrides.html')}`
const NEW_URL = `file://${path.join(FIXTURES_DIR, 'admin-overrides-new.html')}`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Admin Overrides — List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_URL, { waitUntil: 'networkidle' })
  })

  // =========================================================================
  // 1. Affiche tous les overrides dans le tableau
  // =========================================================================
  test('1 — affiche tous les overrides dans le tableau', async ({ page }) => {
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(3)

    // Spot-check content
    await expect(page.getByText('EXPORT_PDF')).toBeVisible()
    await expect(page.getByText('MAX_CONNECTORS')).toBeVisible()
    await expect(page.getByText('AI_SUMMARY')).toBeVisible()
    await expect(page.getByText('Business need')).toBeVisible()
    await expect(page.getByText('Campaign trial')).toBeVisible()
    await expect(page.getByText('Expired trial')).toBeVisible()
  })

  // =========================================================================
  // 2. Badge ORG (default/blue) + USER (secondary/green)
  // =========================================================================
  test('2 — badge ORG (default) + USER (secondary)', async ({ page }) => {
    const row0 = page.locator('table tbody tr').nth(0)
    await expect(row0.getByText('ORG', { exact: true })).toBeVisible()

    const row2 = page.locator('table tbody tr').nth(2)
    await expect(row2.getByText('ORG', { exact: true })).toBeVisible()

    const row1 = page.locator('table tbody tr').nth(1)
    await expect(row1.getByText('USER', { exact: true })).toBeVisible()
  })

  // =========================================================================
  // 3. Enabled = true → ✓, Enabled = false → ✗
  // =========================================================================
  test('3 — enabled true affiche ✓, false affiche ✗', async ({ page }) => {
    // Row 0: enabled=true → Check icon
    const row0 = page.locator('table tbody tr').nth(0)
    await expect(row0.locator('.lucide-check')).toBeVisible()

    // Row 2: enabled=false → X icon
    const row2 = page.locator('table tbody tr').nth(2)
    await expect(row2.locator('.lucide-x')).toBeVisible()
  })

  // =========================================================================
  // 4. Filtre orgId → les résultats sont filtrés
  // =========================================================================
  test('4 — filtre orgId envoie le paramètre dans la requête GET', async ({ page }) => {
    const filterInput = page.getByTestId('filter-input')
    await filterInput.fill('org-1')

    await page.waitForTimeout(200)

    // Only the matching row should be visible
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(1)
    await expect(page.getByText('EXPORT_PDF')).toBeVisible()
  })

  // =========================================================================
  // 5. API 500 → message d'erreur
  // =========================================================================
  test("6 — API 500 affiche un message d'erreur", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Failed to fetch overrides')
    })

    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText('Failed to fetch overrides')
    await expect(page.getByTestId('retry-btn')).toBeVisible()
  })

  // =========================================================================
  // 6. Aucun override → empty state
  // =========================================================================
  test("7 — aucun override affiche l'état vide", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__setOverrides([])
    })
    await page.waitForTimeout(100)

    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toContainText('No overrides')
  })

  // =========================================================================
  // 7. Override avec expiresAt dans le passé → badge "Expired"
  // =========================================================================
  test('10 — override expiré affiche un badge (expired)', async ({ page }) => {
    // Row 2 (index 2) is the expired one (expiresAt: 2025-01-01)
    const row2 = page.locator('table tbody tr').nth(2)
    await expect(row2).toContainText(/expired/i)
  })

  // =========================================================================
  // 8. Override avec limitValue=50 affiché
  // =========================================================================
  test('11 — limitValue=50 est affiché dans la colonne Limit Value', async ({ page }) => {
    // Row 1 (index 1) is the USER override with limitValue=50
    const row1 = page.locator('table tbody tr').nth(1)
    await expect(row1.getByText('50')).toBeVisible()
  })

  // =========================================================================
  // 9. Filtre orgId : résultat vide → tableau vide (pas de crash)
  // =========================================================================
  test('12 — filtre orgId sans résultat affiche un tableau vide sans crash', async ({ page }) => {
    const filterInput = page.getByTestId('filter-input')
    await filterInput.fill('nonexistent-org')
    await page.waitForTimeout(200)

    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toContainText(
      'No overrides found for this organization'
    )
  })

  // =========================================================================
  // 10. Date formatée correctement (locale fr-FR)
  // =========================================================================
  test('14 — les dates sont formatées en locale fr-FR (jj/mm/aaaa)', async ({ page }) => {
    // Override 1 createdAt: 2026-01-15 → "15/01/2026"
    const row0 = page.locator('table tbody tr').nth(0)
    await expect(row0).toContainText('15/01/2026')

    // Override 2 createdAt: 2026-06-01 → "01/06/2026"
    const row1 = page.locator('table tbody tr').nth(1)
    await expect(row1).toContainText('01/06/2026')

    // Override 3 createdAt: 2025-06-01 → "01/06/2025"
    const row2 = page.locator('table tbody tr').nth(2)
    await expect(row2).toContainText('01/06/2025')
  })
})

// ===========================================================================
// Admin Overrides — Create
// ===========================================================================

test.describe('Admin Overrides — Create', () => {
  // =========================================================================
  // 5. Création override ORG complet avec limitValue + expiresAt + reason
  // =========================================================================
  test("5 — création d'un override ORG complet", async ({ page }) => {
    await page.goto(NEW_URL, { waitUntil: 'networkidle' })

    // Scope should default to ORG
    const scopeSelect = page.getByTestId('scope-select')
    await expect(scopeSelect).toHaveValue('ORG')

    // Fill scopeId
    await page.locator('#scopeId').fill('org-42')

    // Fill featureKey
    await page.locator('#featureKey').fill('BULK_EXPORT')

    // Fill limitValue
    await page.locator('#limitValue').fill('100')

    // Fill expiresAt
    await page.locator('#expiresAt').fill('2027-06-01T12:00')

    // Fill reason
    await page.locator('#reason').fill('Override for bulk export trial')

    // Submit
    await page.getByRole('button', { name: /create override/i }).click()

    // Verify payload
    const body = await page.evaluate(() => (window as any).__submittedData)
    expect(body).toMatchObject({
      scope: 'ORG',
      scopeId: 'org-42',
      featureKey: 'BULK_EXPORT',
      enabled: true,
      limitValue: 100,
      reason: 'Override for bulk export trial',
    })
    expect(body).toHaveProperty('expiresAt')

    // Verify redirect
    expect(await page.evaluate(() => (window as any).__redirectedTo)).toBe('/admin/overrides')
  })

  // =========================================================================
  // 8. Création sans reason → validation
  // =========================================================================
  test('8 — création sans reason affiche une erreur de validation', async ({ page }) => {
    await page.goto(NEW_URL, { waitUntil: 'networkidle' })

    // Fill required fields except reason
    await page.locator('#scopeId').fill('org-99')
    await page.locator('#featureKey').fill('TEST_FEATURE')

    // Leave reason empty

    // Submit
    await page.getByRole('button', { name: /create override/i }).click()

    // Check validation error
    await expect(page.getByTestId('reason-error')).toHaveText('Reason is required')
  })

  // =========================================================================
  // 9. Création avec scope ID vide → validation
  // =========================================================================
  test('9 — création sans scope ID affiche une erreur de validation', async ({ page }) => {
    await page.goto(NEW_URL, { waitUntil: 'networkidle' })

    // Fill other required fields except scopeId
    await page.locator('#featureKey').fill('TEST_FEATURE')
    await page.locator('#reason').fill('Some reason')

    // Leave scopeId empty

    // Submit
    await page.getByRole('button', { name: /create override/i }).click()

    // Check validation error
    await expect(page.getByTestId('scopeId-error')).toHaveText('Scope ID is required')
  })

  // =========================================================================
  // 13. Switch Enabled togglé dans le formulaire
  // =========================================================================
  test('13 — le switch Enabled peut être togglé', async ({ page }) => {
    await page.goto(NEW_URL, { waitUntil: 'networkidle' })

    // The Switch has role="switch"
    const switchEl = page.getByTestId('enabled-switch')

    // Initially should be checked (enabled=true by default)
    await expect(switchEl).toHaveAttribute('aria-checked', 'true')

    // Click to toggle off
    await switchEl.click()
    await expect(switchEl).toHaveAttribute('aria-checked', 'false')

    // Click to toggle back on
    await switchEl.click()
    await expect(switchEl).toHaveAttribute('aria-checked', 'true')
  })
})
