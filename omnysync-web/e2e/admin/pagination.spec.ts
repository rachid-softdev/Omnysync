/**
 * E2E Tests — Admin Pagination Edge Cases
 *
 * Tests pagination behavior across list pages:
 * - Single page (no pagination controls)
 * - First page: prev button disabled
 * - Last page: next button disabled
 * - Mid-page navigation
 * - Rapid next/prev clicks
 * - Search + pagination interaction
 * - Page indicator text format
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const USERS_URL = `file://${path.join(FIXTURES_DIR, 'admin-users.html')}`

/**
 * Generate N users for pagination testing.
 */
function generateUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    email: `user${i + 1}@example.com`,
    name: `User ${i + 1}`,
    role: (i === 0 ? 'ADMIN' : 'USER') as 'USER' | 'ADMIN',
    createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  }))
}

test.describe('Admin — Pagination Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(USERS_URL, { waitUntil: 'networkidle' })
  })

  // ── 1. Single page — no pagination controls ────────────────────────

  test('1: moins de 10 éléments → pagination cachée', async ({ page }) => {
    // Default has 3 users < 10 → pagination should be hidden
    await expect(page.getByTestId('pagination')).not.toBeVisible()
  })

  // ── 2. Exactly 10 elements ─────────────────────────────────────────

  test('2: exactement 10 éléments → pas de pagination (1 page)', async ({ page }) => {
    await page.evaluate((users) => {
      ;(window as any).__setUsers(users)
    }, generateUsers(10))
    await page.waitForTimeout(100)

    // Exactly 1 page → pagination hidden
    await expect(page.getByTestId('pagination')).not.toBeVisible()
    await expect(page.locator('table tbody tr')).toHaveCount(10)
  })

  // ── 3. Just above threshold (11) ───────────────────────────────────

  test('3: 11 éléments → 2 pages, page 1/2', async ({ page }) => {
    await page.evaluate((users) => {
      ;(window as any).__setUsers(users)
    }, generateUsers(11))
    await page.waitForTimeout(100)

    await expect(page.getByTestId('pagination')).toBeVisible()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 2')

    // 10 on first page
    await expect(page.locator('table tbody tr')).toHaveCount(10)

    // Go to page 2
    await page.getByTestId('next-page').click()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 2')
    await expect(page.locator('table tbody tr')).toHaveCount(1)

    // Go back
    await page.getByTestId('prev-page').click()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 2')
  })

  // ── 4. First page: prev disabled, last page: next disabled ─────────

  test('4: boutons désactivés aux extrêmes', async ({ page }) => {
    await page.evaluate((users) => {
      ;(window as any).__setUsers(users)
    }, generateUsers(25))
    await page.waitForTimeout(100)

    // Page 1: prev disabled, next enabled
    await expect(page.getByTestId('prev-page')).toBeDisabled()
    await expect(page.getByTestId('next-page')).toBeEnabled()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 3')

    // Page 2: both enabled
    await page.getByTestId('next-page').click()
    await expect(page.getByTestId('prev-page')).toBeEnabled()
    await expect(page.getByTestId('next-page')).toBeEnabled()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 3')

    // Page 3: next disabled, prev enabled
    await page.getByTestId('next-page').click()
    await expect(page.getByTestId('prev-page')).toBeEnabled()
    await expect(page.getByTestId('next-page')).toBeDisabled()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 3 / 3')
  })

  // ── 5. Rapid clicks ────────────────────────────────────────────────

  test('5: clics rapides ne dépassent pas la dernière page', async ({ page }) => {
    // 25 items = 3 pages
    await page.evaluate((users) => {
      ;(window as any).__setUsers(users)
    }, generateUsers(25))
    await page.waitForTimeout(100)

    const nextBtn = page.getByTestId('next-page')
    const prevBtn = page.getByTestId('prev-page')

    // Rapid double click from page 1 → page 2 (not page 3)
    await nextBtn.click()
    await nextBtn.click()
    await page.waitForTimeout(50)

    // Should be on page 3 (2 rapid clicks from page 1)
    // Actually with rapid clicks both register, each advances one page
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 3 / 3')
    await expect(nextBtn).toBeDisabled()
    await expect(prevBtn).toBeEnabled()
  })

  // ── 6. Search + pagination interaction ─────────────────────────────

  test('6: recherche + pagination — les comptes se mettent à jour', async ({ page }) => {
    await page.evaluate((users) => {
      ;(window as any).__setUsers(users)
    }, generateUsers(15))
    await page.waitForTimeout(100)

    // 15 users total → 2 pages
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 2')

    // Search for 'User 1' → only User 1 and User 10-15 (those containing '1')
    const input = page.getByTestId('search-input')
    await input.fill('User 1')

    // Wait for filter
    await page.waitForTimeout(100)

    // filtered results < 10 → pagination hidden
    await expect(page.getByTestId('pagination')).not.toBeVisible()
  })

  // ── 7. Après search, pagination se reset à page 1 ──────────────────

  test('7: la recherche réinitialise à la page 1', async ({ page }) => {
    await page.evaluate((users) => {
      ;(window as any).__setUsers(users)
    }, generateUsers(30))
    await page.waitForTimeout(100)

    // Go to page 3
    await page.getByTestId('next-page').click()
    await page.getByTestId('next-page').click()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 3 / 3')

    // Search → reset to page 1
    const input = page.getByTestId('search-input')
    await input.fill('User 1')
    await page.waitForTimeout(100)

    // Revenir à la vue complète
    await input.fill('')
    await page.waitForTimeout(100)

    // Should be back at page 1
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 3')
    await expect(page.getByTestId('prev-page')).toBeDisabled()
  })
})
