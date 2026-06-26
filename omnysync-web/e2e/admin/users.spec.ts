import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const LIST_URL = `file://${path.join(FIXTURES_DIR, 'admin-users.html')}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    email: `user${i + 1}@example.com`,
    name: `User ${i + 1}`,
    role: (i === 0 ? 'ADMIN' : 'USER') as 'USER' | 'ADMIN',
    createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
  }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Admin Users — page liste', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_URL, { waitUntil: 'networkidle' })
  })

  // ── Succès ──────────────────────────────────────────────────────────────

  test('1. Affiche le titre "Utilisateurs"', async ({ page }) => {
    await expect(page.getByTestId('page-title')).toHaveText('Utilisateurs')
  })

  test('2. Affiche tous les utilisateurs dans le tableau', async ({ page }) => {
    // Noms
    await expect(page.getByText('Alice Dupont')).toBeVisible()
    await expect(page.getByText('Bob Martin')).toBeVisible()

    // Emails
    await expect(page.getByText('alice@example.com')).toBeVisible()
    await expect(page.getByText('bob@example.com')).toBeVisible()
    await expect(page.getByText('charlie@example.com')).toBeVisible()

    // Vérifie le nombre de lignes dans le tableau
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(3)
  })

  test('3. Affiche le badge ADMIN pour Bob, USER pour Alice', async ({ page }) => {
    const adminBadge = page
      .locator('table tbody tr')
      .filter({ hasText: 'Bob Martin' })
      .locator('td')
      .nth(2)
    await expect(adminBadge).toContainText('ADMIN')

    const userBadge = page
      .locator('table tbody tr')
      .filter({ hasText: 'Alice Dupont' })
      .locator('td')
      .nth(2)
    await expect(userBadge).toContainText('USER')
  })

  test('4. Pagination — affiche les boutons avec plus de 10 utilisateurs', async ({ page }) => {
    const manyUsers = generateUsers(12)
    await page.evaluate((users) => {
      ;(window as any).__setUsers(users)
    }, manyUsers)
    await page.waitForTimeout(100)

    // Description : "12 utilisateurs sur la plateforme"
    await expect(page.getByTestId('page-description')).toHaveText(
      '12 utilisateurs sur la plateforme'
    )

    // Pagination : page 1/2
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 1 / 2')
    await expect(page.getByTestId('prev-page')).toBeDisabled()
    await expect(page.getByTestId('next-page')).toBeEnabled()

    // Navigation vers page 2
    await page.getByTestId('next-page').click()
    await expect(page.getByTestId('page-indicator')).toHaveText('Page 2 / 2')
    await expect(page.getByTestId('prev-page')).toBeEnabled()
    await expect(page.getByTestId('next-page')).toBeDisabled()
  })

  test('5. Recherche par email filtre les résultats', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('alice')

    await expect(page.getByText('Alice Dupont')).toBeVisible()
    await expect(page.getByText('Bob Martin')).not.toBeVisible()
    await expect(page.getByText('charlie@example.com')).not.toBeVisible()
  })

  test('6. Recherche par nom filtre les résultats', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('Martin')

    await expect(page.getByText('Bob Martin')).toBeVisible()
    await expect(page.getByText('Alice Dupont')).not.toBeVisible()
  })

  test('7. Clic "Voir" → lien vers /admin/users/1', async ({ page }) => {
    const voirLink = page.locator('a').filter({ hasText: 'Voir' }).first()
    await expect(voirLink).toHaveAttribute('href', '/admin/users/1')
  })

  // ── Cas d'erreur ────────────────────────────────────────────────────────

  test("8. API retourne 500 → affiche le message d'erreur", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur lors du chargement des utilisateurs')
    })

    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText(
      'Erreur lors du chargement des utilisateurs'
    )
  })

  test("9. API retourne 401 → message d'erreur", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Non autorisé')
    })

    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText('Non autorisé')
  })

  test('10. Aucun utilisateur → état vide', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__setUsers([])
    })
    await page.waitForTimeout(100)

    await expect(page.getByTestId('empty-state')).toBeVisible()
  })

  // ── Edge cases ──────────────────────────────────────────────────────────

  test('11. Recherche sans résultat → tableau vide, pas de crash', async ({ page }) => {
    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('zzz')

    // Plus aucun utilisateur visible
    await expect(page.getByText('Alice Dupont')).not.toBeVisible()
    await expect(page.getByText('Bob Martin')).not.toBeVisible()

    // L'état vide est affiché
    await expect(page.getByTestId('empty-state')).toBeVisible()
  })

  test('12. Utilisateur sans nom (name=null) → affiche "—"', async ({ page }) => {
    // Charlie a name=null → la colonne Nom doit afficher "—"
    const charlieRow = page.locator('table tbody tr').filter({ hasText: 'charlie@example.com' })
    await expect(charlieRow.locator('td').nth(0)).toHaveText('\u2014')
  })

  test('13. Nombre d\'utilisateurs = 1 → "1 utilisateur" (singulier)', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__setUsers([
        {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ])
    })
    await page.waitForTimeout(100)

    await expect(page.getByTestId('page-description')).toHaveText('1 utilisateur sur la plateforme')
  })
})
