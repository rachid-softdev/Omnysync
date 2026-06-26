/**
 * E2E Tests — Admin Accessibility & ARIA
 *
 * Tests basic accessibility patterns across admin pages:
 * - ARIA attributes on sortable headers
 * - ARIA labels on buttons and navigation
 * - Focus management (buttons are focusable)
 * - Disabled state on buttons
 * - Role attributes (switch, combobox)
 * - Alt/aria-label on icons
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const USERS_URL = `file://${path.join(FIXTURES_DIR, 'admin-users.html')}`
const ORGS_URL = `file://${path.join(FIXTURES_DIR, 'admin-orgs.html')}`
const FEATURES_URL = `file://${path.join(FIXTURES_DIR, 'admin-features.html')}`
const OVERRIDES_NEW = `file://${path.join(FIXTURES_DIR, 'admin-overrides-new.html')}`
const DOWNGRADE_URL = `file://${path.join(FIXTURES_DIR, 'admin-downgrade.html')}`

test.describe('Admin — Accessibility & ARIA', () => {
  // ── Sortable headers ───────────────────────────────────────────────

  test.describe('Features page — sortable headers', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(FEATURES_URL, { waitUntil: 'networkidle' })
    })

    test('1: key header a aria-sort="ascending" par défaut', async ({ page }) => {
      await expect(page.getByTestId('col-header-key')).toHaveAttribute('aria-sort', 'ascending')
    })

    test("2: name header n'a pas aria-sort initialement", async ({ page }) => {
      await expect(page.getByTestId('col-header-name')).not.toHaveAttribute('aria-sort')
    })

    test('3: clic Name → aria-sort="ascending", clic → "descending"', async ({ page }) => {
      const nameHeader = page.getByTestId('col-header-name')
      await nameHeader.click()
      await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
      await nameHeader.click()
      await expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
    })

    test("4: changer de colonne enlève aria-sort de l'ancienne", async ({ page }) => {
      const keyHeader = page.getByTestId('col-header-key')
      const nameHeader = page.getByTestId('col-header-name')

      await nameHeader.click()
      await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
      await expect(keyHeader).not.toHaveAttribute('aria-sort')
    })
  })

  // ── Buttons & ARIA labels ──────────────────────────────────────────

  test.describe('Buttons and labels', () => {
    test('5: pagination prev/next boutons ont aria-label', async ({ page }) => {
      await page.goto(USERS_URL, { waitUntil: 'networkidle' })

      // Inject 15 users to show pagination
      await page.evaluate(() => {
        const users = Array.from({ length: 15 }, (_, i) => ({
          id: String(i + 1),
          email: `u${i + 1}@test.com`,
          name: `User ${i + 1}`,
          role: 'USER' as const,
          createdAt: new Date().toISOString(),
        }))
        ;(window as any).__setUsers(users)
      })
      await page.waitForTimeout(100)

      await expect(page.getByTestId('prev-page')).toHaveAttribute('aria-label', 'Page précédente')
      await expect(page.getByTestId('next-page')).toHaveAttribute('aria-label', 'Page suivante')
    })

    test('6: override switch a role="switch" et aria-checked', async ({ page }) => {
      await page.goto(OVERRIDES_NEW, { waitUntil: 'networkidle' })

      const switchEl = page.getByTestId('enabled-switch')
      await expect(switchEl).toHaveAttribute('role', 'switch')
      await expect(switchEl).toHaveAttribute('aria-checked', 'true')

      // Toggle
      await switchEl.click()
      await expect(switchEl).toHaveAttribute('aria-checked', 'false')
    })

    test('7: formulaire création override a des labels associés aux inputs', async ({ page }) => {
      await page.goto(OVERRIDES_NEW, { waitUntil: 'networkidle' })

      // Labels should have "for" attribute
      await expect(page.locator('label[for="scopeId"]')).toHaveText('Scope ID')
      await expect(page.locator('label[for="featureKey"]')).toHaveText('Feature Key')
      await expect(page.locator('label[for="reason"]')).toHaveText('Reason')
    })
  })

  // ── Disabled states ────────────────────────────────────────────────

  test.describe('Disabled states', () => {
    test('8: pagination prev est disabled sur page 1', async ({ page }) => {
      await page.goto(USERS_URL, { waitUntil: 'networkidle' })
      await page.evaluate(() => {
        const users = Array.from({ length: 25 }, (_, i) => ({
          id: String(i + 1),
          email: `u${i + 1}@test.com`,
          name: `User ${i + 1}`,
          role: 'USER' as const,
          createdAt: new Date().toISOString(),
        }))
        ;(window as any).__setUsers(users)
      })
      await page.waitForTimeout(100)

      await expect(page.getByTestId('prev-page')).toBeDisabled()
      await expect(page.getByTestId('next-page')).toBeEnabled()
    })

    test('9: pagination next est disabled sur dernière page', async ({ page }) => {
      await page.goto(USERS_URL, { waitUntil: 'networkidle' })
      await page.evaluate(() => {
        const users = Array.from({ length: 25 }, (_, i) => ({
          id: String(i + 1),
          email: `u${i + 1}@test.com`,
          name: `User ${i + 1}`,
          role: 'USER' as const,
          createdAt: new Date().toISOString(),
        }))
        ;(window as any).__setUsers(users)
      })
      await page.waitForTimeout(100)

      // Go to last page
      await page.getByTestId('next-page').click()
      await page.getByTestId('next-page').click()
      await expect(page.getByTestId('next-page')).toBeDisabled()
    })
  })

  // ── Focus management ───────────────────────────────────────────────

  test.describe('Focus and keyboard', () => {
    test('10: les boutons sont focusables (tabindex implicite des boutons)', async ({ page }) => {
      await page.goto(USERS_URL, { waitUntil: 'networkidle' })

      // Buttons should be natively focusable (<button> elements)
      const buttons = page.locator('button')
      const count = await buttons.count()
      expect(count).toBeGreaterThan(0)

      // All buttons should not have tabindex="-1"
      for (let i = 0; i < count; i++) {
        const btn = buttons.nth(i)
        const tabIndex = await btn.getAttribute('tabindex')
        expect(tabIndex).not.toBe('-1')
      }
    })

    test('11: les liens de navigation sont clickables', async ({ page }) => {
      await page.goto(ORGS_URL, { waitUntil: 'networkidle' })

      // Org names are links
      const orgLink = page.getByTestId('org-name-1')
      await expect(orgLink).toHaveAttribute('href', '/admin/orgs/1')
    })

    test('12: select element is focusable and operable', async ({ page }) => {
      await page.goto(DOWNGRADE_URL, { waitUntil: 'networkidle' })

      // Select element should be focusable
      const select = page.getByTestId('plan-select')
      await expect(select).toBeVisible()
      await select.focus()

      // After focus, selection works
      await select.selectOption('pro')
      await page.waitForTimeout(500)
      await expect(page.getByTestId('can-proceed-banner')).toBeVisible()
    })
  })
})
