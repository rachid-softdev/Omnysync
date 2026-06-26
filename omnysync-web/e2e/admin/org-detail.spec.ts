/**
 * E2E Tests — Admin Organization Detail (/admin/orgs/[id])
 *
 * Covers:
 * - Organization header with name, slug, plan
 * - Stats grid (members, plan, created date)
 * - Details section (ID, slug, owner)
 * - Quick actions (members, overrides, downgrade)
 * - Navigation, error state
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const DETAIL_URL = `file://${path.join(FIXTURES_DIR, 'admin-org-detail.html')}`

test.describe('Admin — Organization Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DETAIL_URL, { waitUntil: 'networkidle' })
  })

  // ── 1. Org Header ──────────────────────────────────────────────────

  test("1: affiche l'en-tête avec nom, slug et lien changement de plan", async ({ page }) => {
    await expect(page.getByTestId('org-name')).toHaveText('Acme Inc')
    await expect(page.getByTestId('org-slug')).toHaveText('/acme')

    const downgradeLink = page.getByTestId('downgrade-link')
    await expect(downgradeLink).toHaveAttribute('href', '/admin/orgs/1/downgrade')
    await expect(downgradeLink).toContainText('Changer de plan')
  })

  // ── 2. Stats Grid ──────────────────────────────────────────────────

  test('2: affiche les statistiques (membres, plan, création)', async ({ page }) => {
    await expect(page.getByTestId('stat-members-value')).toHaveText('12')
    await expect(page.getByTestId('stat-plan-value')).toHaveText('Pro')
    await expect(page.getByTestId('stat-plan-status')).toContainText('Actif')
    await expect(page.getByTestId('stat-created-value')).toHaveText('10 janv. 2026')
  })

  // ── 3. Details Section ─────────────────────────────────────────────

  test('3: affiche les détails (ID, slug, propriétaire)', async ({ page }) => {
    await expect(page.getByTestId('detail-id')).toHaveText('org_1a2b3c')
    await expect(page.getByTestId('detail-slug')).toHaveText('acme')
    await expect(page.getByTestId('detail-owner')).toHaveText('Alice Dupont')
    await expect(page.getByTestId('detail-owner')).toHaveAttribute('href', '/admin/users/1')
  })

  // ── 4. Quick Actions ───────────────────────────────────────────────

  test('4: affiche les actions rapides avec les bons liens', async ({ page }) => {
    await expect(page.getByTestId('action-users')).toHaveAttribute('href', '/admin/users?orgId=1')
    await expect(page.getByTestId('action-overrides')).toHaveAttribute(
      'href',
      '/admin/overrides?orgId=1'
    )
    await expect(page.getByTestId('action-downgrade')).toHaveAttribute(
      'href',
      '/admin/orgs/1/downgrade'
    )
  })

  // ── 5. Back Link ───────────────────────────────────────────────────

  test('5: le lien retour pointe vers /admin/orgs', async ({ page }) => {
    const backLink = page.getByTestId('back-link')
    await expect(backLink).toHaveAttribute('href', '/admin/orgs')
    await expect(backLink).toContainText('Retour aux organisations')
  })

  // ── 6. Error State ─────────────────────────────────────────────────

  test("6: affiche un message d'erreur", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError("Erreur lors du chargement de l'organisation")
    })

    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText(
      "Erreur lors du chargement de l'organisation"
    )
  })
})
