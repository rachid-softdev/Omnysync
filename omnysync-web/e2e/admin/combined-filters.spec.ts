/**
 * E2E Tests — Admin Filtres Combinés
 *
 * Tests les interactions COMBINÉES entre recherche, tri, pagination
 * et filtre par type sur la page Ressources.
 *
 * Vérifie que tous les filtres fonctionnent ensemble sans conflit :
 * - Recherche + tri
 * - Recherche + pagination
 * - Recherche + tri + pagination
 * - Changement de tri pendant la recherche
 * - Changement de recherche pendant le tri
 * - Changement de page pendant le tri
 * - Réduction de recherche avec pagination
 * - Effacement de recherche après état complexe
 * - Changements rapides
 * - Filtre par type + tri
 * - Réinitialisation complète
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const COMBINED_URL = `file://${path.join(FIXTURES_DIR, 'admin-combined.html')}`

/**
 * Génère N éléments pour les tests de pagination.
 * Les noms sont zéro-paddés pour garantir un tri lexicographique
 * cohérent avec l'ordre numérique.
 */
function generateItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    key: `ITEM_${String(i + 1).padStart(2, '0')}`,
    name: `Item ${String(i + 1).padStart(2, '0')}`,
    type: (['BOOLEAN', 'LIMIT', 'EXPERIMENT'] as const)[i % 3],
    email: `item${i + 1}@test.com`,
    role: (i === 0 ? 'ADMIN' : 'USER') as 'ADMIN' | 'USER',
    org: 'Test Corp',
  }))
}

test.describe('Admin — Filtres combinés', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(COMBINED_URL, { waitUntil: 'networkidle' })
  })

  // ── 1. Search + sort asc ──────────────────────────────────────────────

  test('1: recherche + tri ascendant', async ({ page }) => {
    // Rechercher "beta" → correspond aux items contenant "beta"
    // Item 2 (Beta Sync — nom, clé, email) et item 27 (backup@betainc.com, Beta Inc)
    await page.getByTestId('search-input').fill('beta')
    await page.waitForTimeout(100)

    // Trier par nom ascendant
    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)

    // Vérifier l'ordre : Backup Sync (27) avant Beta Sync (2)
    const nomCellules = page.locator('table tbody tr td:nth-child(2)')
    await expect(nomCellules).toHaveCount(2)
    await expect(nomCellules.nth(0)).toHaveText('Backup Sync')
    await expect(nomCellules.nth(1)).toHaveText('Beta Sync')
  })

  // ── 2. Search + sort desc ─────────────────────────────────────────────

  test('2: recherche + tri descendant', async ({ page }) => {
    // Rechercher "acme" → items 1 (alpha@acme.com, Acme Corp),
    // 3 (gamma@acme.com, Acme Corp), 28 (cache@acme.com, Acme Corp)
    await page.getByTestId('search-input').fill('acme')
    await page.waitForTimeout(100)

    // Trier par nom descendant (deux clics pour passer de asc à desc)
    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)
    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)

    // Ordre descendant : Gamma Connector, Cache Proxy, Alpha Project
    const nomCellules = page.locator('table tbody tr td:nth-child(2)')
    await expect(nomCellules).toHaveCount(3)
    await expect(nomCellules.nth(0)).toHaveText('Gamma Connector')
    await expect(nomCellules.nth(1)).toHaveText('Cache Proxy')
    await expect(nomCellules.nth(2)).toHaveText('Alpha Project')
  })

  // ── 3. Search + pagination ────────────────────────────────────────────

  test('3: recherche + pagination', async ({ page }) => {
    // Injecter 25 éléments qui correspondent à la recherche
    await page.evaluate((items) => {
      ;(window as any).__setData(items)
    }, generateItems(25))
    await page.waitForTimeout(100)

    // Rechercher "Item" → 25 correspondances → 3 pages
    await page.getByTestId('search-input').fill('Item')
    await page.waitForTimeout(100)

    await expect(page.getByTestId('pagination')).toBeVisible()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 3')
    await expect(page.locator('table tbody tr')).toHaveCount(10)

    // Page 2
    await page.getByTestId('next-page').click()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 3')
    await expect(page.locator('table tbody tr')).toHaveCount(10)

    // Page 3
    await page.getByTestId('next-page').click()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 3 / 3')
    await expect(page.locator('table tbody tr')).toHaveCount(5)
    await expect(page.getByTestId('next-page')).toBeDisabled()
    await expect(page.getByTestId('prev-page')).toBeEnabled()
  })

  // ── 4. Search + sort + pagination ─────────────────────────────────────

  test('4: recherche + tri + pagination', async ({ page }) => {
    // Injecter 25 éléments
    await page.evaluate((items) => {
      ;(window as any).__setData(items)
    }, generateItems(25))
    await page.waitForTimeout(100)

    // Rechercher "Item" → 25 correspondances
    await page.getByTestId('search-input').fill('Item')
    await page.waitForTimeout(100)
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 3')

    // Trier par nom ascendant
    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)

    // Aller à la page 2
    await page.getByTestId('next-page').click()
    await page.waitForTimeout(50)
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 3')

    // Vérifier que les éléments de la page 2 sont triés par nom asc
    // Avec les noms "Item 01" à "Item 25", tri asc :
    // Page 1 = Item 01-10, Page 2 = Item 11-20, Page 3 = Item 21-25
    const nomCellules = page.locator('table tbody tr td:nth-child(2)')
    await expect(nomCellules).toHaveCount(10)
    await expect(nomCellules.nth(0)).toHaveText('Item 11')
    await expect(nomCellules.nth(9)).toHaveText('Item 20')
  })

  // ── 5. Change sort while searching ────────────────────────────────────

  test('5: changer le tri pendant la recherche', async ({ page }) => {
    // Rechercher "pro" → items 1 (Alpha Project — nom), 9 (Integrate Pro — org),
    // 13 (Nu Proxy — nom), 17 (ProServe — org), 28 (Cache Proxy — nom),
    // 34 (Integrate Pro — org)
    await page.getByTestId('search-input').fill('pro')
    await page.waitForTimeout(100)

    // Trier par nom ascendant
    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)

    // Vérifier ordre asc : Alpha Project, Cache Proxy, Index Builder,
    // Iota Worker, Nu Proxy, Rho Adapter
    const nomCellules = page.locator('table tbody tr td:nth-child(2)')
    await expect(nomCellules).toHaveCount(6)
    await expect(nomCellules.nth(0)).toHaveText('Alpha Project')
    await expect(nomCellules.nth(1)).toHaveText('Cache Proxy')
    await expect(nomCellules.nth(2)).toHaveText('Index Builder')
    await expect(nomCellules.nth(3)).toHaveText('Iota Worker')
    await expect(nomCellules.nth(4)).toHaveText('Nu Proxy')
    await expect(nomCellules.nth(5)).toHaveText('Rho Adapter')

    // Changer pour un tri descendant
    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)

    // Vérifier ordre desc : Rho Adapter, Nu Proxy, Iota Worker,
    // Index Builder, Cache Proxy, Alpha Project
    await expect(nomCellules.nth(0)).toHaveText('Rho Adapter')
    await expect(nomCellules.nth(1)).toHaveText('Nu Proxy')
    await expect(nomCellules.nth(2)).toHaveText('Iota Worker')
    await expect(nomCellules.nth(3)).toHaveText('Index Builder')
    await expect(nomCellules.nth(4)).toHaveText('Cache Proxy')
    await expect(nomCellules.nth(5)).toHaveText('Alpha Project')
  })

  // ── 6. Change search while sorted ────────────────────────────────────

  test('6: changer la recherche pendant le tri', async ({ page }) => {
    // Trier par nom descendant d'abord
    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)
    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)

    // Puis rechercher "test" → items 22-26 (Test Lab, Test Corp, A/A Test, A/B Test v2)
    await page.getByTestId('search-input').fill('test')
    await page.waitForTimeout(100)

    // Les résultats doivent être triés par nom descendant
    // Ordre attendu : Psi Analyzer, Omega Scheduler, Chi Filter, A/B Test v2, A/A Test
    const nomCellules = page.locator('table tbody tr td:nth-child(2)')
    await expect(nomCellules).toHaveCount(5)
    await expect(nomCellules.nth(0)).toHaveText('Psi Analyzer')
    await expect(nomCellules.nth(1)).toHaveText('Omega Scheduler')
    await expect(nomCellules.nth(2)).toHaveText('Chi Filter')
    await expect(nomCellules.nth(3)).toHaveText('A/B Test v2')
    await expect(nomCellules.nth(4)).toHaveText('A/A Test')
  })

  // ── 7. Change page while sorted ──────────────────────────────────────

  test('7: changer de page pendant le tri', async ({ page }) => {
    // Trier par nom ascendant (par défaut les 35 items)
    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)

    // Aller à la page 2
    await page.getByTestId('next-page').click()
    await page.waitForTimeout(50)

    // 35 items, tri nom asc → page 2 = items 11-20
    // Item 11 = Epsilon Bridge, Item 20 = Kappa Store
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 4')

    const nomCellules = page.locator('table tbody tr td:nth-child(2)')
    await expect(nomCellules).toHaveCount(10)
    await expect(nomCellules.nth(0)).toHaveText('Epsilon Bridge')
    await expect(nomCellules.nth(9)).toHaveText('Kappa Store')
  })

  // ── 8. Narrow search + pagination ────────────────────────────────────

  test('8: rétrécir la recherche + pagination', async ({ page }) => {
    // Injecter 15 éléments
    await page.evaluate((items) => {
      ;(window as any).__setData(items)
    }, generateItems(15))
    await page.waitForTimeout(100)

    // Rechercher "Item" → 15 correspondances → 2 pages
    await page.getByTestId('search-input').fill('Item')
    await page.waitForTimeout(100)
    await expect(page.getByTestId('pagination')).toBeVisible()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 2')
    await expect(page.locator('table tbody tr')).toHaveCount(10)

    // Rétrécir la recherche à "Item 0" → items 01-09 = 9 résultats → 1 page
    await page.getByTestId('search-input').fill('Item 0')
    await page.waitForTimeout(100)

    // Pagination cachée (1 seule page avec 9 éléments)
    await expect(page.getByTestId('pagination')).not.toBeVisible()
    await expect(page.locator('table tbody tr')).toHaveCount(9)
  })

  // ── 9. Clear search after complex state ──────────────────────────────

  test('9: effacer la recherche après état complexe', async ({ page }) => {
    // Injecter 25 éléments
    await page.evaluate((items) => {
      ;(window as any).__setData(items)
    }, generateItems(25))
    await page.waitForTimeout(100)

    // État complexe : recherche + tri + page 2
    await page.getByTestId('search-input').fill('Item')
    await page.waitForTimeout(100)
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 3')

    await page.getByTestId('col-header-name').click() // tri nom asc
    await page.waitForTimeout(50)

    await page.getByTestId('next-page').click() // page 2
    await page.waitForTimeout(50)
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 3')

    // Effacer la recherche → page 1 (le tri reste, on le réinitialise ensuite)
    await page.getByTestId('search-input').fill('')
    await page.waitForTimeout(100)

    // Réinitialiser le tri à la valeur par défaut (key asc)
    await page.getByTestId('col-header-key').click()
    await page.waitForTimeout(50)

    // Vérifier : page 1, tri key asc, tous les éléments
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 3')
    await expect(page.getByTestId('prev-page')).toBeDisabled()
    await expect(page.getByTestId('col-header-key')).toHaveAttribute('aria-sort', 'ascending')

    // Les 10 premiers éléments (page 1) sont ITEM_01 à ITEM_10
    const cleCellules = page.locator('table tbody tr td:first-child span.font-mono')
    await expect(cleCellules.nth(0)).toHaveText('ITEM_01')
    await expect(cleCellules.nth(1)).toHaveText('ITEM_02')
    await expect(cleCellules.nth(2)).toHaveText('ITEM_03')
  })

  // ── 10. Rapid search changes + sort ──────────────────────────────────

  test('10: changements rapides de recherche et tri', async ({ page }) => {
    const input = page.getByTestId('search-input')
    const nameHeader = page.getByTestId('col-header-name')

    // Taper rapidement "a", "ab", "abc" en trisssant entre chaque
    await input.fill('a')
    await nameHeader.click()

    await input.fill('ab')
    await nameHeader.click()

    await input.fill('abc')
    await nameHeader.click()

    // Vérifier qu'il n'y a pas de crash — la table est toujours attachée
    await expect(page.getByTestId('table-body')).toBeAttached()

    // Pas de bannière d'erreur
    await expect(page.getByTestId('error-banner')).not.toBeVisible()

    // Au moins une ligne (résultats ou état vide) est présente
    await expect(page.locator('table tbody tr').first()).toBeAttached()
  })

  // ── 11. Search + filter type + sort ──────────────────────────────────

  test('11: recherche + filtre par type + tri', async ({ page }) => {
    // Rechercher "a" + filtrer LIMIT + trier par nom asc
    await page.getByTestId('search-input').fill('a')
    await page.waitForTimeout(50)

    await page.getByTestId('type-filter').selectOption('LIMIT')
    await page.waitForTimeout(50)

    await page.getByTestId('col-header-name').click()
    await page.waitForTimeout(50)

    // 11 éléments LIMIT contenant "a" → 2 pages
    await expect(page.getByTestId('pagination')).toBeVisible()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 2')

    // Vérifier l'ordre trié par nom ascendant (page 1 = 10 éléments)
    const nomCellules = page.locator('table tbody tr td:nth-child(2)')
    await expect(nomCellules).toHaveCount(10)
    await expect(nomCellules.nth(0)).toHaveText('A/B Test v2')
    await expect(nomCellules.nth(9)).toHaveText('Theta Gateway')

    // Vérifier que toutes les lignes sont bien de type LIMIT
    const typeCellules = page.locator('table tbody tr td:nth-child(3)')
    const count = await typeCellules.count()
    for (let i = 0; i < count; i++) {
      await expect(typeCellules.nth(i)).toContainText('LIMIT')
    }

    // Page 2 : 1 élément restant (Upsilon Parser)
    await page.getByTestId('next-page').click()
    await page.waitForTimeout(50)
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 2')
    await expect(page.locator('table tbody tr')).toHaveCount(1)
    await expect(page.getByTestId('cell-name-20')).toHaveText('Upsilon Parser')
  })

  // ── 12. Full reset — clear all ───────────────────────────────────────

  test('12: réinitialisation complète', async ({ page }) => {
    // Injecter 25 éléments pour avoir de la pagination
    await page.evaluate((items) => {
      ;(window as any).__setData(items)
    }, generateItems(25))
    await page.waitForTimeout(100)

    // Mettre en place un état complexe : recherche + tri + page 2
    await page.getByTestId('search-input').fill('Item')
    await page.waitForTimeout(100)

    await page.getByTestId('col-header-name').click() // tri nom asc
    await page.waitForTimeout(50)

    await page.getByTestId('next-page').click() // page 2
    await page.waitForTimeout(50)

    // Vérifier qu'on est bien dans un état non-initial
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 3')

    // Cliquer sur "Réinitialiser"
    await page.getByTestId('reset-btn').click()
    await page.waitForTimeout(100)

    // Vérifier le retour à l'état initial
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 3')
    await expect(page.getByTestId('prev-page')).toBeDisabled()
    await expect(page.getByTestId('col-header-key')).toHaveAttribute('aria-sort', 'ascending')

    // Recherche vidée
    await expect(page.getByTestId('search-input')).toHaveValue('')

    // Filtre type réinitialisé
    await expect(page.getByTestId('type-filter')).toHaveValue('ALL')

    // 10 éléments sur la première page (25 au total)
    await expect(page.locator('table tbody tr')).toHaveCount(10)
  })
})
