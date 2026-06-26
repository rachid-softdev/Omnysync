/**
 * E2E Tests — Admin User Detail (/admin/users/[id])
 *
 * Covers the individual user detail view:
 * - Profile card with name, email, role, status
 * - Info section with ID, dates, org
 * - Security section with 2FA, email verification
 * - Danger zone with delete action
 * - Error state, navigation
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const DETAIL_URL = `file://${path.join(FIXTURES_DIR, 'admin-user-detail.html')}`

test.describe('Admin — User Detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DETAIL_URL, { waitUntil: 'networkidle' })
  })

  // ── 1. Profile Card ─────────────────────────────────────────────────

  test('1: affiche la carte de profil avec nom, email, avatar', async ({ page }) => {
    await expect(page.getByTestId('user-name')).toBeVisible()
    await expect(page.getByTestId('page-title')).toHaveText('Alice Dupont')
    await expect(page.getByTestId('user-email')).toHaveText('alice@example.com')
    await expect(page.getByTestId('user-avatar')).toHaveText('AD')
    await expect(page.getByTestId('user-role-badge')).toContainText('USER')
    await expect(page.getByTestId('user-status-badge')).toContainText('Actif')
  })

  // ── 2. Info Section ─────────────────────────────────────────────────

  test('2: affiche les informations utilisateur (ID, dates, org)', async ({ page }) => {
    await expect(page.getByTestId('info-id')).toHaveText('usr_1a2b3c')
    await expect(page.getByTestId('info-created')).toHaveText('1 juin 2026')
    await expect(page.getByTestId('info-last-login')).toHaveText('15 juin 2026 à 14:32')
    await expect(page.getByTestId('info-org')).toHaveText('Acme Inc')
    await expect(page.getByTestId('info-org')).toHaveAttribute('href', '/admin/orgs/1')
  })

  // ── 3. Security Section ─────────────────────────────────────────────

  test('3: affiche les informations de sécurité', async ({ page }) => {
    await expect(page.getByTestId('security-2fa')).toContainText('Activé')
    await expect(page.getByTestId('security-email')).toContainText('Oui')
    await expect(page.getByTestId('security-role')).toHaveText('Utilisateur')
  })

  // ── 4. Danger Zone ─────────────────────────────────────────────────

  test('4: affiche la zone de danger avec bouton de suppression', async ({ page }) => {
    const dangerZone = page.getByTestId('danger-zone-card')
    await expect(dangerZone).toBeVisible()
    await expect(dangerZone).toContainText('Supprimer cet utilisateur')
    await expect(dangerZone).toContainText('Cette action est irréversible')

    const deleteBtn = page.getByTestId('delete-user-btn')
    await expect(deleteBtn).toBeVisible()
    await expect(deleteBtn).toContainText('Supprimer')
  })

  // ── 5. Delete Action ───────────────────────────────────────────────

  test('5: cliquer sur Supprimer déclenche la suppression', async ({ page }) => {
    await page.getByTestId('delete-user-btn').click()
    await expect(page.getByTestId('delete-success')).toBeVisible()
  })

  // ── 6. Navigation Back ─────────────────────────────────────────────

  test('6: le lien retour pointe vers /admin/users', async ({ page }) => {
    const backLink = page.getByTestId('back-link')
    await expect(backLink).toHaveAttribute('href', '/admin/users')
    await expect(backLink).toContainText('Retour aux utilisateurs')
  })

  // ── 7. Error State ─────────────────────────────────────────────────

  test("7: affiche un message d'erreur", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError("Erreur lors du chargement de l'utilisateur")
    })

    await expect(page.getByTestId('error-banner')).toBeVisible()
    await expect(page.getByTestId('error-message')).toHaveText(
      "Erreur lors du chargement de l'utilisateur"
    )
  })
})
