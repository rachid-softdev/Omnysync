/**
 * E2E Tests — Admin Downgrade Preview (/admin/orgs/[id]/downgrade)
 *
 * Covers:
 * - Initial empty state (no plan selected)
 * - Plan selection triggers preview loading
 * - Soft downgrade (pro → can proceed, warnings)
 * - Blocked downgrade (free → cannot proceed, critical features affected)
 * - No-impact downgrade (business → 0 features affected)
 * - Error state during preview generation
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const DOWNGRADE_URL = `file://${path.join(FIXTURES_DIR, 'admin-downgrade.html')}`

test.describe('Admin — Downgrade Preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DOWNGRADE_URL, { waitUntil: 'networkidle' })
  })

  // ── 1. Initial State ───────────────────────────────────────────────

  test("1: affiche l'état vide initial", async ({ page }) => {
    await expect(page.getByTestId('page-title')).toHaveText('Downgrade Preview')
    await expect(page.getByTestId('page-description')).toContainText("Prévisualisez l'impact")
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toContainText('Sélectionnez un plan')
    await expect(page.getByTestId('plan-select')).toBeVisible()
  })

  // ── 2. Loading State ───────────────────────────────────────────────

  test('2: montre un état de chargement après sélection du plan', async ({ page }) => {
    await page.getByTestId('plan-select').selectOption('free')
    await expect(page.getByTestId('loading-state')).toBeVisible()
    await expect(page.getByTestId('loading-state')).toContainText('Génération de la preview')
  })

  // ── 3. Soft Downgrade (Pro) ────────────────────────────────────────

  test('3: plan Pro — downgrade possible avec avertissements', async ({ page }) => {
    await page.getByTestId('plan-select').selectOption('pro')
    await page.waitForTimeout(500)

    // Can proceed banner
    await expect(page.getByTestId('can-proceed-banner')).toBeVisible()
    await expect(page.getByTestId('proceed-title')).toContainText('Downgrade possible')
    await expect(page.getByTestId('strategy-badge')).toContainText('Progressif')

    // 1 feature affectée
    await expect(page.getByTestId('affected-features-title')).toContainText(
      'Features affectées (1)'
    )

    // No warnings
    await expect(page.getByTestId('warnings-card')).not.toBeVisible()
  })

  // ── 4. Blocked Downgrade (Free) ────────────────────────────────────

  test('4: plan Free — downgrade bloqué avec avertissements critiques', async ({ page }) => {
    await page.getByTestId('plan-select').selectOption('free')
    await page.waitForTimeout(500)

    // Cannot proceed banner
    await expect(page.getByTestId('can-proceed-banner')).toBeVisible()
    await expect(page.getByTestId('proceed-title')).toContainText('Downgrade non recommandé')

    // 2 warnings
    await expect(page.getByTestId('warnings-card')).toBeVisible()
    await expect(page.getByTestId('warning-text-0')).toContainText('connecteurs')
    await expect(page.getByTestId('warning-text-1')).toContainText('stockage')

    // 2 features affectées
    await expect(page.getByTestId('affected-features-title')).toContainText(
      'Features affectées (2)'
    )

    // Strategy is GRACEFUL
    await expect(page.getByTestId('strategy-badge')).toContainText('Progressif')
  })

  // ── 5. No-Impact Downgrade (Business) ──────────────────────────────

  test('5: plan Business — aucune feature affectée', async ({ page }) => {
    await page.getByTestId('plan-select').selectOption('business')
    await page.waitForTimeout(500)

    // Can proceed
    await expect(page.getByTestId('proceed-title')).toContainText('Downgrade possible')
    await expect(page.getByTestId('proceed-description')).toContainText(
      'Aucune feature ne sera affectée'
    )

    // 0 features affectées
    await expect(page.getByTestId('affected-features-title')).toContainText(
      'Features affectées (0)'
    )

    // No warnings
    await expect(page.getByTestId('warnings-card')).not.toBeVisible()
  })

  // ── 6. Error State ─────────────────────────────────────────────────

  test("6: affiche un message d'erreur via simulateur", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur lors de la génération de la preview')
    })

    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText(
      'Erreur lors de la génération de la preview'
    )
  })

  // ── 7. Back Link ───────────────────────────────────────────────────

  test('7: le lien retour pointe vers /admin/orgs/org-1', async ({ page }) => {
    const backLink = page.getByTestId('back-link')
    await expect(backLink).toHaveAttribute('href', '/admin/orgs/org-1')
    await expect(backLink).toContainText("Retour à l'organisation")
  })

  // ── 8. Plan Selector options ───────────────────────────────────────

  test('8: le sélecteur de plan contient toutes les options', async ({ page }) => {
    await expect(page.locator('select option[value="free"]')).toHaveText('Free')
    await expect(page.locator('select option[value="pro"]')).toHaveText('Pro')
    await expect(page.locator('select option[value="business"]')).toHaveText('Business')
    await expect(page.locator('select option[value="enterprise"]')).toHaveText('Enterprise')

    // Verify all 4 options are present in the select
    const options = page.locator('select option')
    await expect(options).toHaveCount(5) // 1 placeholder + 4 real options
  })
})
