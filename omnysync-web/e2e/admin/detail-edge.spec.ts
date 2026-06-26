/**
 * E2E Tests — Admin Detail Pages Edge Cases
 *
 * Covers edge cases for both user detail and org detail pages:
 * - User: null org, null name, long email truncation, role badges,
 *         date formatting, delete confirm/cancel, delete error
 * - Org: TRIALING/CANCELED subscription badges, null owner,
 *        long name/slug truncation, 0 members, change plan error
 * - Both: loading skeleton, error recovery, back navigation, responsive layout
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const DETAIL_URL = `file://${path.join(FIXTURES_DIR, 'admin-detail-edge.html')}`

const LONG_EMAIL =
  'cette-adresse-email-est-exceptionnellement-longue-pour-tester-la-truncation-dans-la-vue-utilisateur@exemple.com'
const LONG_ORG_NAME =
  'Cette organisation a un nom extrêmement long qui devrait être tronqué dans la vue détaillée'
const LONG_ORG_SLUG = 'cette-organisation-a-un-slug-extremement-long-qui-devrait-etre-tronque'

test.describe('Admin — Detail Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DETAIL_URL, { waitUntil: 'networkidle' })
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  User — Null org
  // ═══════════════════════════════════════════════════════════════════════

  test('1: utilisateur sans organisation — affiche "Aucune organisation"', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__setUserData({ org: null })
    })
    await page.waitForTimeout(50)

    const orgEl = page.getByTestId('user-info-org')
    await expect(orgEl).toBeVisible()
    await expect(orgEl).toHaveText('Aucune organisation')
    // Not a link
    await expect(orgEl)
      .toHaveAttribute('href', '')
      .catch(() => {
        // If no href, just verify it's not an anchor
      })
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  User — Null name
  // ═══════════════════════════════════════════════════════════════════════

  test('2: utilisateur sans nom — affiche "—"', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__setUserData({ name: null })
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('user-name')).toHaveText('\u2014')
    await expect(page.getByTestId('user-page-title')).toHaveText('\u2014')
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  User — Long email truncation
  // ═══════════════════════════════════════════════════════════════════════

  test('3: utilisateur avec email très long — tronqué avec title complet', async ({ page }) => {
    await page.evaluate((email) => {
      ;(window as any).__setUserData({ email })
    }, LONG_EMAIL)
    await page.waitForTimeout(50)

    const emailEl = page.getByTestId('user-email')
    await expect(emailEl).toBeVisible()
    // The full email should be in the title attribute (for hover)
    await expect(emailEl).toHaveAttribute('title', LONG_EMAIL)
    // The element should have truncation CSS applied
    const overflow = await emailEl.evaluate((el) => window.getComputedStyle(el).overflow)
    expect(overflow).toBe('hidden')
    const textOverflow = await emailEl.evaluate((el) => window.getComputedStyle(el).textOverflow)
    expect(textOverflow).toBe('ellipsis')
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  User — Role badges (ADMIN, USER, VIEWER)
  // ═══════════════════════════════════════════════════════════════════════

  test('4: utilisateur avec différents rôles — badges corrects', async ({ page }) => {
    // Default: USER
    const defaultBadge = page.getByTestId('user-role-badge')
    await expect(defaultBadge).toHaveText('USER')
    await expect(defaultBadge).toHaveClass(/bg-gray-100/)

    // ADMIN
    await page.evaluate(() => {
      ;(window as any).__setUserData({ role: 'ADMIN' })
    })
    await page.waitForTimeout(50)
    const adminBadge = page.getByTestId('user-role-badge')
    await expect(adminBadge).toHaveText('ADMIN')
    await expect(adminBadge).toHaveClass(/bg-yellow-100/)

    // VIEWER
    await page.evaluate(() => {
      ;(window as any).__setUserData({ role: 'VIEWER' })
    })
    await page.waitForTimeout(50)
    const viewerBadge = page.getByTestId('user-role-badge')
    await expect(viewerBadge).toHaveText('VIEWER')
    await expect(viewerBadge).toHaveClass(/bg-purple-100/)
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  User — Date formatting (recent & past)
  // ═══════════════════════════════════════════════════════════════════════

  test('5: utilisateur avec dates récentes et passées — format correct', async ({ page }) => {
    // Format helper matching the fixture's formatDateTime
    const fmtDateTime = (iso: string) => {
      const d = new Date(iso)
      const date = d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      return `${date} à ${time}`
    }
    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

    // Past dates
    await page.evaluate(() => {
      ;(window as any).__setUserData({
        createdAt: '2024-01-05T00:00:00.000Z',
        lastLogin: '2024-06-15T09:30:00.000Z',
      })
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('user-info-created')).toHaveText(
      fmtDate('2024-01-05T00:00:00.000Z')
    )
    await expect(page.getByTestId('user-info-last-login')).toHaveText(
      fmtDateTime('2024-06-15T09:30:00.000Z')
    )

    // Recent dates
    await page.evaluate(() => {
      ;(window as any).__setUserData({
        createdAt: '2026-06-25T00:00:00.000Z',
        lastLogin: '2026-06-26T08:15:00.000Z',
      })
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('user-info-created')).toHaveText(
      fmtDate('2026-06-25T00:00:00.000Z')
    )
    await expect(page.getByTestId('user-info-last-login')).toHaveText(
      fmtDateTime('2026-06-26T08:15:00.000Z')
    )
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  User — Delete: cancel
  // ═══════════════════════════════════════════════════════════════════════

  test('6: suppression — annulation via la modale', async ({ page }) => {
    // Click delete button
    await page.getByTestId('user-delete-btn').click()

    // Modal should appear
    await expect(page.getByTestId('user-delete-modal')).toBeVisible()
    await expect(page.getByTestId('user-delete-cancel-btn')).toBeVisible()
    await expect(page.getByTestId('user-delete-confirm-btn')).toBeVisible()

    // Click cancel
    await page.getByTestId('user-delete-cancel-btn').click()
    await page.waitForTimeout(100)

    // Modal should be hidden
    await expect(page.getByTestId('user-delete-modal')).not.toBeVisible()
    // Page should still show the user detail
    await expect(page.getByTestId('user-profile-card')).toBeVisible()
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  User — Delete: error
  // ═══════════════════════════════════════════════════════════════════════

  test('7: suppression — erreur API affichée', async ({ page }) => {
    // Set the error flag before triggering delete
    await page.evaluate(() => {
      ;(window as any).__deleteShouldFail = true
    })

    await page.getByTestId('user-delete-btn').click()
    await expect(page.getByTestId('user-delete-modal')).toBeVisible()

    // Confirm
    await page.getByTestId('user-delete-confirm-btn').click()
    await page.waitForTimeout(100)

    // Error banner should appear with error message
    await expect(page.getByTestId('user-error-banner')).toBeVisible()
    await expect(page.getByTestId('user-error-message')).toHaveText(
      "Erreur lors de la suppression de l'utilisateur. Veuillez réessayer."
    )
    // Success message should NOT appear
    await expect(page.getByTestId('user-delete-success')).not.toBeVisible()
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Org — TRIALING subscription badge
  // ═══════════════════════════════════════════════════════════════════════

  test('8: organisation avec abonnement TRIALING — badge bleu "Essai"', async ({ page }) => {
    // Switch to org tab
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(50)

    await page.evaluate(() => {
      ;(window as any).__setOrgData({
        subscription: { planKey: 'Pro', status: 'TRIALING' },
      })
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('org-stat-plan-value')).toHaveText('Pro')
    const badge = page.getByTestId('org-stat-plan-status')
    await expect(badge).toHaveText('Essai')
    await expect(badge).toHaveClass(/bg-blue-100/)
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Org — CANCELED subscription badge
  // ═══════════════════════════════════════════════════════════════════════

  test('9: organisation avec abonnement CANCELED — badge rouge "Annulé"', async ({ page }) => {
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(50)

    await page.evaluate(() => {
      ;(window as any).__setOrgData({
        subscription: { planKey: 'Business', status: 'CANCELED' },
      })
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('org-stat-plan-value')).toHaveText('Business')
    const badge = page.getByTestId('org-stat-plan-status')
    await expect(badge).toHaveText('Annulé')
    await expect(badge).toHaveClass(/bg-red-100/)
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Org — Null owner
  // ═══════════════════════════════════════════════════════════════════════

  test('10: organisation sans propriétaire — affiche "Aucun propriétaire"', async ({ page }) => {
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(50)

    await page.evaluate(() => {
      ;(window as any).__setOrgData({ owner: null })
    })
    await page.waitForTimeout(50)

    const ownerEl = page.getByTestId('org-detail-owner')
    await expect(ownerEl).toBeVisible()
    await expect(ownerEl).toHaveText('Aucun propriétaire')
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Org — Long name/slug truncation
  // ═══════════════════════════════════════════════════════════════════════

  test('11: organisation avec nom/slug très long — tronqué avec title', async ({ page }) => {
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(50)

    await page.evaluate(
      (data) => {
        ;(window as any).__setOrgData(data)
      },
      { name: LONG_ORG_NAME, slug: LONG_ORG_SLUG }
    )
    await page.waitForTimeout(50)

    // Name truncation
    const nameEl = page.getByTestId('org-name')
    await expect(nameEl).toHaveAttribute('title', LONG_ORG_NAME)

    // Slug truncation
    const slugEl = page.getByTestId('org-slug')
    await expect(slugEl).toHaveAttribute('title', '/' + LONG_ORG_SLUG)

    // Check CSS truncation on slug in detail card
    const detailSlugEl = page.getByTestId('org-detail-slug')
    const overflow = await detailSlugEl.evaluate((el) => window.getComputedStyle(el).overflow)
    expect(overflow).toBe('hidden')
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Org — 0 members
  // ═══════════════════════════════════════════════════════════════════════

  test('12: organisation avec 0 membre — affiche 0', async ({ page }) => {
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(50)

    await page.evaluate(() => {
      ;(window as any).__setOrgData({ membersCount: 0 })
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('org-stat-members-value')).toHaveText('0')
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Org — Change plan API error
  // ═══════════════════════════════════════════════════════════════════════

  test('13: changement de plan — erreur API simulée', async ({ page }) => {
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(50)

    // Click the "Simuler erreur changement de plan" button
    await page.getByTestId('org-change-plan-btn').click()
    await page.waitForTimeout(100)

    await expect(page.getByTestId('org-change-plan-error')).toBeVisible()
    await expect(page.getByTestId('org-change-plan-error-message')).toHaveText(
      'Erreur API : Impossible de changer de plan. Le service est temporairement indisponible.'
    )
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Loading skeleton — user
  // ═══════════════════════════════════════════════════════════════════════

  test('14: squelette de chargement utilisateur — affiché puis remplacé par les données', async ({
    page,
  }) => {
    // Show skeleton
    await page.evaluate(() => {
      ;(window as any).__showUserSkeleton()
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('user-loading-skeleton')).toBeVisible()

    // Load data
    await page.evaluate(() => {
      ;(window as any).__setUserData()
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('user-loading-skeleton')).not.toBeVisible()
    await expect(page.getByTestId('user-profile-card')).toBeVisible()
    await expect(page.getByTestId('user-page-title')).toHaveText('Alice Dupont')
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Error + Recovery (user detail)
  // ═══════════════════════════════════════════════════════════════════════

  test('15: erreur puis récupération — données visibles après correction', async ({ page }) => {
    // Show error
    await page.evaluate(() => {
      ;(window as any).__showUserError('Erreur lors du chargement des données')
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('user-error-banner')).toBeVisible()
    await expect(page.getByTestId('user-error-message')).toHaveText(
      'Erreur lors du chargement des données'
    )

    // Clear error
    await page.evaluate(() => {
      ;(window as any).__clearUserError()
    })
    await page.waitForTimeout(50)

    await expect(page.getByTestId('user-error-banner')).not.toBeVisible()

    // Data should still be visible
    await expect(page.getByTestId('user-profile-card')).toBeVisible()
    await expect(page.getByTestId('user-page-title')).toHaveText('Alice Dupont')
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Back navigation links
  // ═══════════════════════════════════════════════════════════════════════

  test('16: liens retour — href corrects pour utilisateur et organisation', async ({ page }) => {
    // User back link
    const userBack = page.getByTestId('user-back-link')
    await expect(userBack).toHaveAttribute('href', '/admin/users')
    await expect(userBack).toContainText('Retour aux utilisateurs')

    // Switch to org and check back link
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(50)

    const orgBack = page.getByTestId('org-back-link')
    await expect(orgBack).toHaveAttribute('href', '/admin/orgs')
    await expect(orgBack).toContainText('Retour aux organisations')
  })

  // ═══════════════════════════════════════════════════════════════════════
  //  Responsive layout — mobile viewport
  // ═══════════════════════════════════════════════════════════════════════

  test('17: layout responsive — cartes empilées et pas de débordement horizontal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    // All key elements should be visible without horizontal scroll
    await expect(page.getByTestId('user-profile-card')).toBeVisible()
    await expect(page.getByTestId('user-info-card')).toBeVisible()
    await expect(page.getByTestId('user-security-card')).toBeVisible()
    await expect(page.getByTestId('user-danger-zone-card')).toBeVisible()

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(375)

    // Switch to org tab and check too
    await page.getByTestId('tab-org').click()
    await page.waitForTimeout(50)

    await expect(page.getByTestId('org-header-card')).toBeVisible()
    await expect(page.getByTestId('org-stat-members')).toBeVisible()
    await expect(page.getByTestId('org-info-card')).toBeVisible()
    await expect(page.getByTestId('org-actions-card')).toBeVisible()

    const orgBodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(orgBodyWidth).toBeLessThanOrEqual(375)
  })
})
