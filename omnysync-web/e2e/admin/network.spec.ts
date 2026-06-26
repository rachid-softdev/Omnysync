/**
 * E2E Tests — Admin Network Conditions
 *
 * Tests behavior under varying network conditions:
 * - Normal / fast network
 * - Slow network (3G throttling simulated via delay)
 * - Complete offline (__setOnline(false))
 * - Reconnection after failure
 * - Long timeout
 * - Parallel requests
 * - Retry flow
 * - Rapid online/offline toggles
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const URL = `file://${path.join(FIXTURES_DIR, 'admin-network.html')}`

test.describe('Admin — Conditions Réseau', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(URL, { waitUntil: 'networkidle' })
  })

  // ── 1. Normal network ────────────────────────────────────────────────

  test('1: Réseau normal — données chargées rapidement', async ({ page }) => {
    // Default delay is 0ms, so data should be visible immediately
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('loading-spinner')).not.toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()
    await expect(page.getByTestId('delay-indicator')).toHaveText('Délai : 0 ms')
  })

  // ── 2. Slow network (3G) ────────────────────────────────────────────

  test('2: Réseau lent (3G) — loading visible puis données', async ({ page }) => {
    // After initial load (delay 0), set slow network delay
    await page.evaluate(() => {
      ;(window as any).__setDelay(3000)
    })
    await page.evaluate(() => {
      ;(window as any).__triggerLoad()
    })

    // Loading spinner should be visible immediately
    await expect(page.getByTestId('loading-spinner')).toBeVisible()
    await expect(page.getByTestId('data-table')).not.toBeVisible()

    // Wait for the delay to elapse
    await page.waitForTimeout(3500)

    // Data should now be visible, loading hidden
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('loading-spinner')).not.toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()
  })

  // ── 3. Offline — error message ──────────────────────────────────────

  test("3: Hors ligne — message d'erreur", async ({ page }) => {
    // Initial load succeeded (online)
    await expect(page.getByTestId('data-table')).toBeVisible()

    // Go offline and trigger a new load
    await page.evaluate(() => {
      ;(window as any).__setOnline(false)
    })
    await page.evaluate(() => {
      ;(window as any).__triggerLoad()
    })
    await page.waitForTimeout(100)

    // Error banner should be visible, data hidden
    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText('Échec de la connexion réseau')
    await expect(page.getByTestId('data-table')).not.toBeVisible()
    await expect(page.getByTestId('loading-spinner')).not.toBeVisible()
  })

  // ── 4. Offline banner visibility ────────────────────────────────────

  test('4: Bannière hors ligne visible', async ({ page }) => {
    // Initially hidden (online by default)
    await expect(page.getByTestId('offline-banner')).not.toBeVisible()

    // Go offline → banner appears
    await page.evaluate(() => {
      ;(window as any).__setOnline(false)
    })
    await expect(page.getByTestId('offline-banner')).toBeVisible()
    await expect(page.getByTestId('offline-banner')).toContainText('hors ligne')

    // Go back online → banner disappears
    await page.evaluate(() => {
      ;(window as any).__setOnline(true)
    })
    await expect(page.getByTestId('offline-banner')).not.toBeVisible()
  })

  // ── 5. Reconnection — retry restores data ───────────────────────────

  test('5: Reconnexion — retry restaure les données', async ({ page }) => {
    // Initial: data visible
    await expect(page.getByTestId('data-table')).toBeVisible()

    // Go offline and trigger load → error
    await page.evaluate(() => {
      ;(window as any).__setOnline(false)
    })
    await page.evaluate(() => {
      ;(window as any).__triggerLoad()
    })
    await page.waitForTimeout(100)
    await expect(page.getByTestId('error-banner')).toBeVisible()

    // Go back online
    await page.evaluate(() => {
      ;(window as any).__setOnline(true)
    })

    // Click retry
    await page.getByTestId('retry-btn').click()
    await page.waitForTimeout(100)

    // Data should be restored, error gone
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()
    await expect(page.getByTestId('loading-spinner')).not.toBeVisible()
  })

  // ── 6. Round-trip offline/online ───────────────────────────────────

  test('6: Aller-retour hors ligne/en ligne', async ({ page }) => {
    // 1. Online → data visible
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('offline-banner')).not.toBeVisible()

    // 2. Go offline → banner visible
    await page.evaluate(() => {
      ;(window as any).__setOnline(false)
    })
    await expect(page.getByTestId('offline-banner')).toBeVisible()

    // 3. Go back online → banner hidden
    await page.evaluate(() => {
      ;(window as any).__setOnline(true)
    })
    await expect(page.getByTestId('offline-banner')).not.toBeVisible()

    // 4. Load with moderate delay → loading visible then data
    await page.evaluate(() => {
      ;(window as any).__setDelay(800)
    })
    await page.evaluate(() => {
      ;(window as any).__triggerLoad()
    })
    await expect(page.getByTestId('loading-spinner')).toBeVisible()
    await expect(page.getByTestId('data-table')).not.toBeVisible()

    await page.waitForTimeout(1200)

    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('loading-spinner')).not.toBeVisible()
    await expect(page.getByTestId('offline-banner')).not.toBeVisible()
  })

  // ── 7. Long timeout (10s) ──────────────────────────────────────────

  test('7: Timeout longue durée (10s) — chargement persiste', async ({ page }) => {
    // Set a very long delay
    await page.evaluate(() => {
      ;(window as any).__setDelay(10000)
    })
    await page.evaluate(() => {
      ;(window as any).__triggerLoad()
    })

    // Loading should be visible
    await expect(page.getByTestId('loading-spinner')).toBeVisible()
    await expect(page.getByTestId('data-table')).not.toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()

    // After 2 seconds, still loading (not timed out, not crashed)
    await page.waitForTimeout(2000)
    await expect(page.getByTestId('loading-spinner')).toBeVisible()
    await expect(page.getByTestId('data-table')).not.toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()

    // Verify the delay indicator shows the expected value
    await expect(page.getByTestId('delay-indicator')).toHaveText('Délai : 10000 ms')
  })

  // ── 8. Multiple simultaneous requests ──────────────────────────────

  test('8: Multiples requêtes simultanées — 3 sections en parallèle', async ({ page }) => {
    // All three sections should have loaded on page init (delay 0)
    await expect(page.getByTestId('data-table-a')).toBeVisible()
    await expect(page.getByTestId('data-table-b')).toBeVisible()
    await expect(page.getByTestId('data-table-c')).toBeVisible()

    // Now set a delay and reload all sections in parallel
    await page.evaluate(() => {
      ;(window as any).__setDelay(2000)
    })
    await page.evaluate(() => {
      ;(window as any).__triggerLoad()
    })

    // All three loading spinners should be visible simultaneously
    await expect(page.getByTestId('loading-spinner-a')).toBeVisible()
    await expect(page.getByTestId('loading-spinner-b')).toBeVisible()
    await expect(page.getByTestId('loading-spinner-c')).toBeVisible()

    // Data tables should still be hidden (or gone)
    await expect(page.getByTestId('data-table-a')).not.toBeVisible()
    await expect(page.getByTestId('data-table-b')).not.toBeVisible()
    await expect(page.getByTestId('data-table-c')).not.toBeVisible()

    // Wait for delay to pass
    await page.waitForTimeout(2500)

    // All three data tables should appear together
    await expect(page.getByTestId('data-table-a')).toBeVisible()
    await expect(page.getByTestId('data-table-b')).toBeVisible()
    await expect(page.getByTestId('data-table-c')).toBeVisible()

    // All loading spinners gone
    await expect(page.getByTestId('loading-spinner-a')).not.toBeVisible()
    await expect(page.getByTestId('loading-spinner-b')).not.toBeVisible()
    await expect(page.getByTestId('loading-spinner-c')).not.toBeVisible()
  })

  // ── 9. Failure then success ────────────────────────────────────────

  test('9: Échec puis succès — le retry après échec affiche les données', async ({ page }) => {
    // Go offline and trigger a load → failure
    await page.evaluate(() => {
      ;(window as any).__setOnline(false)
    })
    await page.evaluate(() => {
      ;(window as any).__triggerLoad()
    })
    await page.waitForTimeout(100)
    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText('Échec de la connexion réseau')

    // Set delay so we can observe the loading state during retry
    await page.evaluate(() => {
      ;(window as any).__setDelay(600)
    })
    // Go back online
    await page.evaluate(() => {
      ;(window as any).__setOnline(true)
    })

    // Click retry → loading appears
    await page.getByTestId('retry-btn').click()
    await page.waitForTimeout(100)
    await expect(page.getByTestId('loading-spinner')).toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()
    await expect(page.getByTestId('data-table')).not.toBeVisible()

    // Wait for data to load
    await page.waitForTimeout(800)

    // Success: data visible, error gone
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('loading-spinner')).not.toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()

    // Verify data items rendered
    await expect(page.getByTestId('data-item-1')).toBeVisible()
    await expect(page.getByTestId('data-item-3')).toBeVisible()
  })

  // ── 10. Intermittent network — rapid toggles ──────────────────────

  test('10: Réseau intermittent — clignotement hors ligne géré', async ({ page }) => {
    // Initial: online, data visible
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('offline-banner')).not.toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()

    // Rapid online/offline toggles (simulate flaky connection)
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        ;(window as any).__setOnline(false)
      })
      await page.evaluate(() => {
        ;(window as any).__setOnline(true)
      })
    }

    // After all toggles: should be online, no offline banner
    await expect(page.getByTestId('offline-banner')).not.toBeVisible()

    // Status badge should show "En ligne"
    await expect(page.getByTestId('status-badge')).toHaveText('En ligne')

    // Data should still be loadable / visible
    await page.evaluate(() => {
      ;(window as any).__triggerLoad()
    })
    await page.waitForTimeout(100)
    await expect(page.getByTestId('data-table')).toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toBeVisible()
    await expect(page.getByTestId('offline-banner')).not.toBeVisible()

    // Finally, set offline one more time
    await page.evaluate(() => {
      ;(window as any).__setOnline(false)
    })
    await expect(page.getByTestId('offline-banner')).toBeVisible()
    await page.evaluate(() => {
      ;(window as any).__setOnline(true)
    })
    await page.evaluate(() => {
      ;(window as any).__triggerLoad()
    })
    await page.waitForTimeout(100)
    await expect(page.getByTestId('data-table')).toBeVisible()
  })
})
