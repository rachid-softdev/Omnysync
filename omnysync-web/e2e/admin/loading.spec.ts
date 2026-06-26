/**
 * E2E Tests — Admin Loading States
 *
 * Tests that every admin section displays its correct loading skeleton
 * (shimmer placeholders) before data arrives, that accessibility attributes
 * are present, and that loading is properly replaced by content or error.
 *
 * Sections tested: Dashboard, Features, Plans, Users, Orgs, Overrides
 */

import { test, expect, type Page } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const URL = `file://${path.join(FIXTURES_DIR, 'admin-loading.html')}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Switch to a given admin section tab and return the section locator */
async function switchToSection(page: Page, section: string) {
  await page.getByTestId(`tab-${section}`).click()
  await page.waitForTimeout(50)
  return page.getByTestId(`section-${section}`)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Admin — États de chargement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' })
  })

  // ── Dashboard ──────────────────────────────────────────────────────────

  test('1: Tableau de bord — squelette de chargement visible', async ({ page }) => {
    const section = page.getByTestId('section-dashboard')

    // Loading container is visible
    await expect(section.getByTestId('loading-container')).toBeVisible()

    // 4 stat skeleton cards are visible (unique test IDs across all sections)
    const statCards = page.locator('[data-testid^="loading-stat-card-"]')
    await expect(statCards).toHaveCount(4)

    // Recent-users skeleton card is visible
    await expect(page.getByTestId('loading-recent-users')).toBeVisible()

    // Recent-orgs skeleton card is visible
    await expect(page.getByTestId('loading-recent-orgs')).toBeVisible()
  })

  // ── Features ───────────────────────────────────────────────────────────

  test('2: Features — squelette de chargement visible', async ({ page }) => {
    const section = await switchToSection(page, 'features')

    // Loading container is visible within the features section
    await expect(section.getByTestId('loading-container')).toBeVisible()

    // Table skeleton is visible
    await expect(section.getByTestId('loading-table')).toBeVisible()

    // 5 shimmer rows are in the table
    const rows = section.getByTestId('loading-row')
    await expect(rows).toHaveCount(5)
  })

  // ── Plans ──────────────────────────────────────────────────────────────

  test('3: Plans — squelette de chargement visible', async ({ page }) => {
    const section = await switchToSection(page, 'plans')

    // Loading container is visible
    await expect(section.getByTestId('loading-container')).toBeVisible()

    // Table skeleton is visible
    await expect(section.getByTestId('loading-table')).toBeVisible()

    // 5 shimmer rows are visible
    const rows = section.getByTestId('loading-row')
    await expect(rows).toHaveCount(5)
  })

  // ── Users ──────────────────────────────────────────────────────────────

  test('4: Utilisateurs — squelette de chargement visible', async ({ page }) => {
    const section = await switchToSection(page, 'users')

    // Loading container is visible
    await expect(section.getByTestId('loading-container')).toBeVisible()

    // Table skeleton (card-style) is visible
    await expect(section.getByTestId('loading-table')).toBeVisible()

    // 5 shimmer rows are visible
    const rows = section.getByTestId('loading-row')
    await expect(rows).toHaveCount(5)
  })

  // ── Orgs ───────────────────────────────────────────────────────────────

  test('5: Organisations — squelette de chargement visible', async ({ page }) => {
    const section = await switchToSection(page, 'orgs')

    // Loading container is visible
    await expect(section.getByTestId('loading-container')).toBeVisible()

    // Table skeleton is visible
    await expect(section.getByTestId('loading-table')).toBeVisible()

    // 5 shimmer rows are visible
    const rows = section.getByTestId('loading-row')
    await expect(rows).toHaveCount(5)
  })

  // ── Overrides ──────────────────────────────────────────────────────────

  test('6: Overrides — squelette de chargement visible', async ({ page }) => {
    const section = await switchToSection(page, 'overrides')

    // Loading container is visible
    await expect(section.getByTestId('loading-container')).toBeVisible()

    // Table skeleton is visible
    await expect(section.getByTestId('loading-table')).toBeVisible()

    // 5 shimmer rows are visible
    const rows = section.getByTestId('loading-row')
    await expect(rows).toHaveCount(5)
  })

  // ── Accessibility ──────────────────────────────────────────────────────

  test('7: Le chargement possède un rôle "status" pour l\'accessibilité', async ({ page }) => {
    const section = page.getByTestId('section-dashboard')
    const loadingContainer = section.getByTestId('loading-container')

    // Must have role="status" for screen readers
    await expect(loadingContainer).toHaveAttribute('role', 'status')

    // Must have an aria-label describing what is being loaded
    await expect(loadingContainer).toHaveAttribute('aria-label')

    // A screen-reader-only text (sr-only) is present inside
    await expect(loadingContainer.locator('.sr-only')).toBeVisible()
  })

  // ── Loading → Content transition ───────────────────────────────────────

  test('8: Le chargement est remplacé par le contenu après __setData()', async ({ page }) => {
    const section = page.getByTestId('section-dashboard')

    // Initially loading is visible, content is hidden
    await expect(section.getByTestId('loading-container')).toBeVisible()
    await expect(section.getByTestId('content-container')).not.toBeVisible()

    // Simulate successful data load via the global helper
    await page.evaluate(() => {
      ;(window as any).__setData({ message: 'Données chargées' })
    })
    await page.waitForTimeout(50)

    // Loading is hidden
    await expect(section.getByTestId('loading-container')).not.toBeVisible()

    // Content is now displayed
    await expect(section.getByTestId('content-container')).toBeVisible()
    await expect(section.getByTestId('content-text')).toHaveText(
      'Tableau de bord chargé avec succès.'
    )

    // Switch to a different section — it should still show its loading skeleton
    const featuresSection = await switchToSection(page, 'features')
    await expect(featuresSection.getByTestId('loading-container')).toBeVisible()
  })

  // ── Multiple loading elements coexist ──────────────────────────────────

  test('9: Plusieurs éléments de chargement coexistent', async ({ page }) => {
    // On the dashboard, both stats grid AND recent-items loading are visible
    // These test IDs are unique to the dashboard section
    await expect(page.getByTestId('loading-stats-grid')).toBeVisible()
    await expect(page.getByTestId('loading-recent-users')).toBeVisible()
    await expect(page.getByTestId('loading-recent-orgs')).toBeVisible()

    // The stats grid has 4 skeleton cards
    const statCards = page.locator('[data-testid^="loading-stat-card-"]')
    await expect(statCards).toHaveCount(4)

    // Both recent-item cards are visible simultaneously
    await expect(page.getByTestId('loading-recent-users')).toBeVisible()
    await expect(page.getByTestId('loading-recent-orgs')).toBeVisible()
  })

  // ── Error clears loading state ─────────────────────────────────────────

  test("10: L'état de chargement est supprimé après une erreur et le rétablissement", async ({
    page,
  }) => {
    const section = page.getByTestId('section-dashboard')

    // Initially loading is visible, error is hidden
    await expect(section.getByTestId('loading-container')).toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()

    // Simulate an API error
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur lors du chargement')
    })
    await page.waitForTimeout(50)

    // Loading is hidden
    await expect(section.getByTestId('loading-container')).not.toBeVisible()

    // Error banner is now visible
    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText('Erreur lors du chargement')

    // Click "Réessayer" to retry
    await page.getByTestId('retry-btn').click()
    await page.waitForTimeout(50)

    // Error banner is cleared
    await expect(page.getByTestId('error-banner')).not.toBeVisible()

    // Loading skeleton is shown again (simulating a retry)
    await expect(section.getByTestId('loading-container')).toBeVisible()
  })
})
