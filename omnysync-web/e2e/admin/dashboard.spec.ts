import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')

test.describe('Admin Dashboard', () => {
  test.describe('Stats cards', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, 'admin-dashboard.html')}`, {
        waitUntil: 'networkidle',
      })
    })

    test('affiche le titre "Administration"', async ({ page }) => {
      await expect(page.getByTestId('page-title')).toHaveText('Administration')
    })

    test('affiche la description', async ({ page }) => {
      await expect(page.getByTestId('page-description')).toHaveText(
        "Vue d'ensemble de la plateforme Omnysync"
      )
    })

    test('affiche les 4 cartes de statistiques avec leurs valeurs', async ({ page }) => {
      const cards = page.getByTestId('stats-grid').locator('> a')
      await expect(cards).toHaveCount(4)

      const stats = [
        { label: 'Utilisateurs', value: '142' },
        { label: 'Organisations', value: '23' },
        { label: 'Plans', value: '4' },
        { label: 'Features', value: '36' },
      ]

      for (const stat of stats) {
        const card = page.getByTestId(`stat-card-${stat.label.toLowerCase().replace(/\s/g, '')}`)
        await expect(card).toBeVisible()
        const valueEl = page.getByTestId(
          `stat-value-${stat.label.toLowerCase().replace(/\s/g, '')}`
        )
        await expect(valueEl).toHaveText(stat.value)
      }
    })

    test('chaque carte de stats est un lien valide', async ({ page }) => {
      const links = [
        { testId: 'stat-card-utilisateurs', href: '/admin/users' },
        { testId: 'stat-card-organisations', href: '/admin/orgs' },
        { testId: 'stat-card-plans', href: '/admin/plans' },
        { testId: 'stat-card-features', href: '/admin/features' },
      ]

      for (const { testId, href } of links) {
        const link = page.getByTestId(testId)
        await expect(link).toHaveAttribute('href', href)
      }
    })
  })

  test.describe('Recent users', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, 'admin-dashboard.html')}`, {
        waitUntil: 'networkidle',
      })
    })

    test('affiche 5 utilisateurs récents', async ({ page }) => {
      const list = page.getByTestId('recent-users-list')
      const items = list.locator('> a')
      await expect(items).toHaveCount(5)
    })

    test('chaque utilisateur a un nom, email, rôle, et date', async ({ page }) => {
      const user1 = page.getByTestId('recent-user-u1')
      await expect(user1).toContainText('Jean Dupont')
      await expect(user1).toContainText('jean@example.com')
      await expect(user1).toContainText('ADMIN')
    })

    test('le lien "Voir tout" pointe vers /admin/users', async ({ page }) => {
      const voirTout = page.getByTestId('recent-users-card').locator('a[href="/admin/users"]')
      await expect(voirTout).toBeVisible()
      await expect(voirTout).toHaveText('Voir tout')
    })
  })

  test.describe('Recent organizations', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, 'admin-dashboard.html')}`, {
        waitUntil: 'networkidle',
      })
    })

    test('affiche 5 organisations récentes', async ({ page }) => {
      const list = page.getByTestId('recent-orgs-list')
      const items = list.locator('> a')
      await expect(items).toHaveCount(5)
    })

    test('chaque org a un nom et un slug', async ({ page }) => {
      const org1 = page.getByTestId('recent-org-o1')
      await expect(org1).toContainText('Acme Inc')
      await expect(org1).toContainText('/acme')
    })

    test('le lien "Voir tout" pointe vers /admin/orgs', async ({ page }) => {
      const voirTout = page.getByTestId('recent-orgs-card').locator('a[href="/admin/orgs"]')
      await expect(voirTout).toBeVisible()
      await expect(voirTout).toHaveText('Voir tout')
    })
  })
})
