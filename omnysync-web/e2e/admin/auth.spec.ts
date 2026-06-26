/**
 * E2E Tests — Admin Auth & Session
 *
 * Tests that admin route protection works correctly:
 * - Session-based access control (admin vs user vs missing)
 * - Session expiry detection and redirect to login
 * - Non-admin access denial
 * - Reconnection flow after session expiry
 * - Conditional admin link visibility in sidebar
 * - Session persistence across page refresh
 * - Cross-tab session consistency
 * - Inactivity timeout → session expiry
 *
 * Uses static HTML fixture that simulates session states
 * via window.__setSession() / window.__checkSession().
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const AUTH_FIXTURE = 'admin-auth.html'

test.describe('Admin — Authentification et Session', () => {
  test.describe("Contrôle d'accès basé sur le rôle", () => {
    test('Admin authentifié — accès dashboard accordé', async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`, {
        waitUntil: 'networkidle',
      })

      // Simuler une session administrateur valide
      await page.evaluate(() => (window as any).__setSession('admin'))

      // Le tableau de bord doit être visible avec son titre
      await expect(page.getByTestId('page-title')).toBeVisible()
      await expect(page.getByTestId('page-title')).toContainText('Administration')
    })

    test('Non-admin — message accès refusé', async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`, {
        waitUntil: 'networkidle',
      })

      // Simuler un utilisateur avec rôle USER
      await page.evaluate(() => (window as any).__setSession('user'))
      // Simuler la navigation vers /admin (déclenche requireAdmin)
      await page.evaluate(() => (window as any).__attemptAdminAccess())

      // Un message d'erreur doit s'afficher
      await expect(page.getByTestId('error-message')).toBeVisible()
      await expect(page.getByTestId('error-message')).toContainText('Accès non autorisé')
    })

    test('Session manquante — redirection login', async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`, {
        waitUntil: 'networkidle',
      })

      // S'assurer que la session est absente
      await page.evaluate(() => (window as any).__setSession(null))

      // Le formulaire de connexion doit être affiché
      await expect(page.getByTestId('login-form')).toBeVisible()
    })
  })

  test.describe('Expiration de session', () => {
    test('Session expirée — redirection vers login', async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`, {
        waitUntil: 'networkidle',
      })

      // D'abord connecté en admin
      await page.evaluate(() => (window as any).__setSession('admin'))
      await expect(page.getByTestId('page-title')).toBeVisible()

      // La session expire
      await page.evaluate(() => (window as any).__setSession('expired'))

      // Le formulaire de connexion avec bannière d'expiration doit apparaître
      await expect(page.getByTestId('login-form')).toBeVisible()
      await expect(page.getByTestId('session-expired-banner')).toBeVisible()
    })

    test('Reconnexion après session expirée', async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`, {
        waitUntil: 'networkidle',
      })

      // Simuler une session expirée
      await page.evaluate(() => (window as any).__setSession('expired'))
      await expect(page.getByTestId('login-form')).toBeVisible()
      await expect(page.getByTestId('session-expired-banner')).toBeVisible()

      // Cliquer sur "Se reconnecter" → restaure la session admin
      await page.getByTestId('retry-login-btn').click()

      // Le tableau de bord doit être restauré
      await expect(page.getByTestId('page-title')).toBeVisible()
      await expect(page.getByTestId('page-title')).toContainText('Administration')
    })

    test('Timeout inactif — session expire', async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`, {
        waitUntil: 'networkidle',
      })

      // Connecté en admin
      await page.evaluate(() => (window as any).__setSession('admin'))
      await expect(page.getByTestId('page-title')).toBeVisible()

      // Simuler un délai d'inactivité → session expire
      await page.evaluate(() => (window as any).__simulateInactivityTimeout())

      // La bannière d'expiration et le formulaire de login doivent apparaître
      await expect(page.getByTestId('session-expired-banner')).toBeVisible()
      await expect(page.getByTestId('login-form')).toBeVisible()
    })
  })

  test.describe('Visibilité du lien Admin', () => {
    test('Lien Admin caché pour USER', async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`, {
        waitUntil: 'networkidle',
      })

      // Simuler un utilisateur USER
      await page.evaluate(() => (window as any).__setSession('user'))

      // Le lien Admin ne doit PAS apparaître dans la sidebar
      await expect(page.getByTestId('sidebar-admin-link')).not.toBeVisible()
    })

    test('Lien Admin visible pour ADMIN', async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`, {
        waitUntil: 'networkidle',
      })

      // Simuler un administrateur
      await page.evaluate(() => (window as any).__setSession('admin'))

      // Le lien Admin doit être visible dans la sidebar
      await expect(page.getByTestId('sidebar-admin-link')).toBeVisible()
    })
  })

  test.describe('Persistance et cohérence de session', () => {
    test('Session valide après refresh', async ({ page }) => {
      await page.goto(`file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`, {
        waitUntil: 'networkidle',
      })

      // Établir une session admin
      await page.evaluate(() => (window as any).__setSession('admin'))
      await expect(page.getByTestId('page-title')).toBeVisible()

      // Recharger la page (F5)
      await page.reload({ waitUntil: 'networkidle' })

      // La session doit être persistée → dashboard toujours visible
      await expect(page.getByTestId('page-title')).toBeVisible()
      await expect(page.getByTestId('page-title')).toContainText('Administration')
    })

    test('Multiple tabs — session cohérente', async ({ browser }) => {
      const context = await browser.newContext()
      const page1 = await context.newPage()
      const page2 = await context.newPage()

      const url = `file://${path.join(FIXTURES_DIR, AUTH_FIXTURE)}`

      // Charger la fixture dans les deux onglets
      await page1.goto(url, { waitUntil: 'networkidle' })
      await page2.goto(url, { waitUntil: 'networkidle' })

      // Onglet 1 : définir session admin
      await page1.evaluate(() => (window as any).__setSession('admin'))
      await expect(page1.getByTestId('page-title')).toBeVisible()

      // Onglet 2 : doit refléter le changement via localStorage
      await expect(page2.getByTestId('page-title')).toBeVisible({ timeout: 5000 })

      // Onglet 2 : faire expirer la session
      await page2.evaluate(() => (window as any).__setSession('expired'))
      await expect(page2.getByTestId('login-form')).toBeVisible()

      // Onglet 1 : doit refléter l'expiration
      await expect(page1.getByTestId('login-form')).toBeVisible({ timeout: 5000 })
      await expect(page1.getByTestId('session-expired-banner')).toBeVisible()

      await context.close()
    })
  })
})
