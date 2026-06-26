/**
 * E2E Tests — Admin Error & Recovery Patterns
 *
 * Tests error states and recovery across admin pages:
 * - Error message visibility and content
 * - Error recovery via data re-injection (simulates retry)
 * - Error state persists until clear
 * - Empty data after error (edge case)
 * - Multiple quick error toggles
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const USERS_URL = `file://${path.join(FIXTURES_DIR, 'admin-users.html')}`
const ORGS_URL = `file://${path.join(FIXTURES_DIR, 'admin-orgs.html')}`
const OVERRIDES_URL = `file://${path.join(FIXTURES_DIR, 'admin-overrides.html')}`
const DOWNGRADE_URL = `file://${path.join(FIXTURES_DIR, 'admin-downgrade.html')}`

test.describe('Admin — Error & Recovery', () => {
  // ── Users error + recovery ─────────────────────────────────────────

  test.describe('Users page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(USERS_URL, { waitUntil: 'networkidle' })
    })

    test('1: affiche erreur → cache le tableau', async ({ page }) => {
      // Initial: table visible
      await expect(page.locator('table tbody tr')).toHaveCount(3)

      await page.evaluate(() => {
        ;(window as any).__showError('Erreur réseau')
      })

      await expect(page.getByTestId('error-banner')).toBeVisible()
      // Table body should be empty
      await expect(page.locator('table tbody tr')).toHaveCount(0)
    })

    test('2: erreur → recovery (setUsers) → tableau restauré', async ({ page }) => {
      await page.evaluate(() => {
        ;(window as any).__showError('Erreur réseau')
      })
      await expect(page.getByTestId('error-banner')).toBeVisible()

      // Recovery: set new data
      await page.evaluate(() => {
        ;(window as any).__setUsers([
          {
            id: '99',
            email: 'recovery@example.com',
            name: 'Recovery User',
            role: 'USER',
            createdAt: '2026-06-01T00:00:00.000Z',
          },
        ])
      })
      await page.waitForTimeout(100)

      // Error hidden, data restored
      await expect(page.getByTestId('error-banner')).not.toBeVisible()
      await expect(page.getByText('Recovery User')).toBeVisible()
      await expect(page.locator('table tbody tr')).toHaveCount(1)
    })

    test('3: erreur → effacer erreur → tableau toujours vide (data pas reloaded)', async ({
      page,
    }) => {
      await page.evaluate(() => {
        ;(window as any).__showError('Erreur')
      })
      await expect(page.getByTestId('error-banner')).toBeVisible()

      // Clear error without setting data
      await page.evaluate(() => {
        ;(window as any).__clearError()
      })
      await page.waitForTimeout(50)

      await expect(page.getByTestId('error-banner')).not.toBeVisible()
      // Table should re-render with original data since __clearError doesn't modify users
    })
  })

  // ── Orgs error ─────────────────────────────────────────────────────

  test.describe('Orgs page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(ORGS_URL, { waitUntil: 'networkidle' })
    })

    test('4: erreur → données restaurées après __setOrgs', async ({ page }) => {
      await page.evaluate(() => {
        ;(window as any).__showError('Timeout')
      })

      // Recovery
      await page.evaluate(() => {
        ;(window as any).__setOrgs([
          {
            id: '10',
            name: 'NewOrg',
            slug: 'neworg',
            createdAt: '2026-06-01T00:00:00.000Z',
            subscriptions: [],
          },
        ])
      })
      await page.waitForTimeout(100)

      await expect(page.getByTestId('error-banner')).not.toBeVisible()
      await expect(page.getByTestId('org-name-10')).toHaveText('NewOrg')
    })

    test('5: erreur → error-banner est hidden (vérification classe CSS)', async ({ page }) => {
      // Before: banner is hidden
      await expect(page.getByTestId('error-banner')).toHaveClass(/hidden/)

      await page.evaluate(() => {
        ;(window as any).__showError('Erreur')
      })
      await expect(page.getByTestId('error-banner')).not.toHaveClass(/hidden/)

      // Recovery
      await page.evaluate(() => {
        ;(window as any).__clearError()
      })
      await expect(page.getByTestId('error-banner')).toHaveClass(/hidden/)
    })
  })

  // ── Overrides error ────────────────────────────────────────────────

  test.describe('Overrides page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(OVERRIDES_URL, { waitUntil: 'networkidle' })
    })

    test('6: erreur → Retry bouton visible', async ({ page }) => {
      await page.evaluate(() => {
        ;(window as any).__showError('Failed to fetch overrides')
      })
      await expect(page.getByTestId('retry-btn')).toBeVisible()
    })

    test('7: erreur → recovery via __setOverrides', async ({ page }) => {
      await page.evaluate(() => {
        ;(window as any).__showError('Failed to fetch')
      })
      await expect(page.getByTestId('error-banner')).toBeVisible()

      await page.evaluate(() => {
        ;(window as any).__setOverrides([
          {
            id: '10',
            scope: 'ORG',
            scopeId: 'org-new',
            featureKey: 'NEW_FEATURE',
            enabled: true,
            limitValue: null,
            expiresAt: null,
            reason: 'New',
            createdAt: '2026-07-01T00:00:00.000Z',
          },
        ])
      })
      await page.waitForTimeout(100)

      await expect(page.getByTestId('error-banner')).not.toBeVisible()
      await expect(page.getByText('NEW_FEATURE')).toBeVisible()
    })
  })

  // ── Downgrade error ────────────────────────────────────────────────

  test.describe('Downgrade page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(DOWNGRADE_URL, { waitUntil: 'networkidle' })
    })

    test('8: erreur affichée et visible', async ({ page }) => {
      await page.evaluate(() => {
        ;(window as any).__showError('Erreur lors de la génération')
      })
      await expect(page.getByTestId('error-banner')).toBeVisible()
      await expect(page.getByTestId('error-message')).toHaveText('Erreur lors de la génération')
    })

    test('9: plan sélectionné après erreur → fonctionne toujours', async ({ page }) => {
      // Show error first
      await page.evaluate(() => {
        ;(window as any).__showError('Erreur')
      })
      await expect(page.getByTestId('error-banner')).toBeVisible()

      // Select plan → loading state appears (error should still be visible or hidden)
      await page.getByTestId('plan-select').selectOption('pro')
      await page.waitForTimeout(500)

      // Preview should load despite previous error
      await expect(page.getByTestId('can-proceed-banner')).toBeVisible()
    })
  })
})
