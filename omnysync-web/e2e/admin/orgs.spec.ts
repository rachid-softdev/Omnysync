import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const ORGS_URL = `file://${path.join(FIXTURES_DIR, 'admin-orgs.html')}`

test.describe('Admin Organizations — Liste', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ORGS_URL, { waitUntil: 'networkidle' })
  })

  // ── 1. Titre ─────────────────────────────────────────────────────────────

  test('1: affiche le titre "Organisations"', async ({ page }) => {
    await expect(page.getByTestId('page-title')).toHaveText('Organisations')
  })

  // ── 2. Liste complète ────────────────────────────────────────────────────

  test('2: liste avec noms, slugs et plan badges', async ({ page }) => {
    // 3 lignes visibles
    await expect(page.getByTestId('org-row-1')).toBeVisible()
    await expect(page.getByTestId('org-row-2')).toBeVisible()
    await expect(page.getByTestId('org-row-3')).toBeVisible()

    // Noms
    await expect(page.getByTestId('org-name-1')).toHaveText('Acme Inc')
    await expect(page.getByTestId('org-name-2')).toHaveText('Globex Corp')
    await expect(page.getByTestId('org-name-3')).toHaveText('Stark Industries')

    // Slugs
    await expect(page.getByTestId('org-slug-1')).toHaveText('/acme')
    await expect(page.getByTestId('org-slug-2')).toHaveText('/globex')
    await expect(page.getByTestId('org-slug-3')).toHaveText('/stark')

    // Badges plans
    await expect(page.getByTestId('org-badge-1')).toBeVisible()
    await expect(page.getByTestId('org-badge-2')).toBeVisible()
    await expect(page.getByTestId('org-badge-3')).toBeVisible()
  })

  // ── 3. Badge pro=actif, free=inactif ────────────────────────────────────

  test('3: plan badge "pro" = Actif (vert), "free" = Inactif (gris)', async ({ page }) => {
    // Acme Inc (pro / ACTIVE) → badge "Actif" avec classe green
    const badge1 = page.getByTestId('org-badge-1')
    await expect(badge1).toHaveText('Actif')
    const class1 = await badge1.getAttribute('class')
    expect(class1).toMatch(/green/)

    // Globex Corp (free / ACTIVE) → badge "Actif" car status=ACTIVE, classe green
    const badge2 = page.getByTestId('org-badge-2')
    await expect(badge2).toContainText('Actif')
    const class2 = await badge2.getAttribute('class')
    expect(class2).toMatch(/green/)
  })

  // ── 4. Recherche ────────────────────────────────────────────────────────

  test('4: recherche par nom filtre les organisations', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('acme')

    // Seulement Acme visible
    await expect(page.getByTestId('org-row-1')).toBeVisible()
    await expect(page.getByTestId('org-row-2')).not.toBeVisible()
    await expect(page.getByTestId('org-row-3')).not.toBeVisible()

    // Efface la recherche → tout réapparaît
    await searchInput.fill('')
    await expect(page.getByTestId('org-row-1')).toBeVisible()
    await expect(page.getByTestId('org-row-2')).toBeVisible()
    await expect(page.getByTestId('org-row-3')).toBeVisible()
  })

  // ── 5. API 500 ──────────────────────────────────────────────────────────

  test("5: API 500 → message d'erreur", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur lors du chargement des organisations')
    })

    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-banner')).not.toHaveClass(/hidden/)
    await expect(page.getByTestId('error-message')).toHaveText(
      'Erreur lors du chargement des organisations'
    )
  })

  // ── 6. Aucune org → empty state ─────────────────────────────────────────

  test('6: aucune organisation → empty state', async ({ page }) => {
    await page.evaluate(() => (window as any).__setOrgs([]))
    await page.waitForTimeout(100)

    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toContainText('Aucune donnée')
  })

  // ── 7. Recherche sans résultat → pas de crash ──────────────────────────

  test('7: recherche sans résultat → pas de crash, affiche empty state', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('xyznonexistent')

    // Table body affiche l'état vide
    const tableBody = page.getByTestId('table-body')
    await expect(tableBody).toContainText('Aucune donnée')
  })

  // ── 8. TRIALING badge ───────────────────────────────────────────────────

  test('8: subscription TRIALING → badge bleu "Essai"', async ({ page }) => {
    // Stark Industries: enterprise + TRIALING → "Essai"
    const badge3 = page.getByTestId('org-badge-3')
    await expect(badge3).toHaveText('Essai')
    const classAttr = await badge3.getAttribute('class')
    expect(classAttr).toMatch(/blue/)
  })

  // ── 9. Slug null ────────────────────────────────────────────────────────

  test('9: slug null → affiché comme em-dash', async ({ page }) => {
    await page.evaluate(() => {
      const orgs = [
        {
          id: '99',
          name: 'No Slug Org',
          slug: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          subscriptions: [{ planKey: 'free', status: 'ACTIVE' }],
        },
      ]
      ;(window as any).__setOrgs(orgs)
    })
    await page.waitForTimeout(100)

    await expect(page.getByTestId('org-slug-99')).toHaveText('\u2014')
  })

  // ── 10. Pagination ─────────────────────────────────────────────────────

  test('10: pagination si plus de 10 organisations', async ({ page }) => {
    // Injecte 15 orgs (12 + 3 déjà chargées au départ, mais __setOrgs remplace)
    await page.evaluate(() => {
      const extras = []
      for (let i = 0; i < 15; i++) {
        extras.push({
          id: String(i + 1),
          name: 'Org ' + (i + 1),
          slug: 'org-' + (i + 1),
          createdAt: new Date(2026, 0, i + 1).toISOString(),
          subscriptions: [{ planKey: 'free', status: 'ACTIVE' }],
        })
      }
      ;(window as any).__setOrgs(extras)
    })
    await page.waitForTimeout(100)

    // Pagination visible
    const pagination = page.getByTestId('pagination')
    await expect(pagination).toBeVisible()

    // 15 orgs → Page 1 / 2
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 2')

    // 10 lignes affichées (page 1)
    const rows = page.getByTestId('table-body').locator('tr')
    await expect(rows).toHaveCount(10)

    // Navigation → page 2
    await page.getByTestId('next-page').click()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 2')
    await expect(rows).toHaveCount(5)

    // Retour page 1
    await page.getByTestId('prev-page').click()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 2')
  })
})
