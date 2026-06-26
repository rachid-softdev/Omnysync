/**
 * E2E Tests — Admin Navigation
 *
 * Tests that all admin pages can be navigated to and display
 * the correct page titles. Uses static HTML fixtures to verify
 * that every admin page renders correctly.
 *
 * Covers: Dashboard, Users, Orgs, Features, Plans, Overrides,
 * User Detail, Org Detail, Downgrade Preview
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')

interface PageEntry {
  name: string
  path: string
  fixture: string
  title: string
}

const PAGES: PageEntry[] = [
  { name: 'Dashboard', path: '/admin', fixture: 'admin-dashboard.html', title: 'Administration' },
  { name: 'Users', path: '/admin/users', fixture: 'admin-users.html', title: 'Utilisateurs' },
  {
    name: 'Organizations',
    path: '/admin/orgs',
    fixture: 'admin-orgs.html',
    title: 'Organisations',
  },
  { name: 'Features', path: '/admin/features', fixture: 'admin-features.html', title: 'Features' },
  { name: 'Plans', path: '/admin/plans', fixture: 'admin-plans.html', title: 'Plans' },
  {
    name: 'Overrides',
    path: '/admin/overrides',
    fixture: 'admin-overrides.html',
    title: 'Overrides',
  },
  {
    name: 'User Detail',
    path: '/admin/users/1',
    fixture: 'admin-user-detail.html',
    title: 'Alice Dupont',
  },
  {
    name: 'Org Detail',
    path: '/admin/orgs/1',
    fixture: 'admin-org-detail.html',
    title: 'Acme Inc',
  },
  {
    name: 'Downgrade',
    path: '/admin/orgs/1/downgrade',
    fixture: 'admin-downgrade.html',
    title: 'Downgrade Preview',
  },
  {
    name: 'New Feature',
    path: '/admin/features/new',
    fixture: 'admin-features-new.html',
    title: 'New Feature',
  },
  {
    name: 'New Plan',
    path: '/admin/plans/new',
    fixture: 'admin-plans-new.html',
    title: 'New Plan',
  },
  {
    name: 'New Override',
    path: '/admin/overrides/new',
    fixture: 'admin-overrides-new.html',
    title: 'New Override',
  },
]

test.describe('Admin — Page Navigation', () => {
  for (const pageEntry of PAGES) {
    test(`${pageEntry.name}: accessible et titre correct`, async ({ page }) => {
      const url = `file://${path.join(FIXTURES_DIR, pageEntry.fixture)}`
      await page.goto(url, { waitUntil: 'networkidle' })

      await expect(page.getByTestId('page-title')).toBeVisible()

      // Check that the title contains the expected text
      const titleEl = page.getByTestId('page-title')
      await expect(titleEl).toContainText(pageEntry.title)
    })
  }

  // Specific cross-page navigation tests
  test.describe('Cross-page links', () => {
    test('Dashboard: liens stats pointent vers les bonnes pages', async ({ page }) => {
      const url = `file://${path.join(FIXTURES_DIR, 'admin-dashboard.html')}`
      await page.goto(url, { waitUntil: 'networkidle' })

      const expectedLinks = [
        { testId: 'stat-card-utilisateurs', href: '/admin/users' },
        { testId: 'stat-card-organisations', href: '/admin/orgs' },
        { testId: 'stat-card-plans', href: '/admin/plans' },
        { testId: 'stat-card-features', href: '/admin/features' },
      ]

      for (const { testId, href } of expectedLinks) {
        await expect(page.getByTestId(testId)).toHaveAttribute('href', href)
      }
    })

    test('Dashboard: Voir tout → liens corrects', async ({ page }) => {
      const url = `file://${path.join(FIXTURES_DIR, 'admin-dashboard.html')}`
      await page.goto(url, { waitUntil: 'networkidle' })

      await expect(
        page.getByTestId('recent-users-card').locator('a[href="/admin/users"]')
      ).toBeVisible()
      await expect(
        page.getByTestId('recent-orgs-card').locator('a[href="/admin/orgs"]')
      ).toBeVisible()
    })

    test('User Detail: lien org pointe vers /admin/orgs/1', async ({ page }) => {
      const url = `file://${path.join(FIXTURES_DIR, 'admin-user-detail.html')}`
      await page.goto(url, { waitUntil: 'networkidle' })

      await expect(page.getByTestId('info-org')).toHaveAttribute('href', '/admin/orgs/1')
    })

    test('Org Detail: actions rapides ont les bons href', async ({ page }) => {
      const url = `file://${path.join(FIXTURES_DIR, 'admin-org-detail.html')}`
      await page.goto(url, { waitUntil: 'networkidle' })

      await expect(page.getByTestId('action-users')).toHaveAttribute('href', '/admin/users?orgId=1')
      await expect(page.getByTestId('action-overrides')).toHaveAttribute(
        'href',
        '/admin/overrides?orgId=1'
      )
      await expect(page.getByTestId('action-downgrade')).toHaveAttribute(
        'href',
        '/admin/orgs/1/downgrade'
      )
    })
  })
})
