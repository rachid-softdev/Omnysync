/**
 * Tests E2E — Admin Error Boundary
 *
 * Teste le composant global error.tsx de la section admin :
 * - Affichage du titre et du message d'erreur
 * - Bouton Réessayer visible et fonctionnel
 * - Messages d'erreur variés (API 500, 401, 403, réseau)
 * - Accessibilité (role="alert", aria-live, navigation clavier)
 * - Erreurs multiples (deuxième erreur après un premier échec)
 * - Affichage du code statut HTTP
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const ERROR_URL = `file://${path.join(FIXTURES_DIR, 'admin-error.html')}`

test.describe('Admin — Error Boundary', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ERROR_URL, { waitUntil: 'networkidle' })
  })

  test("1: affiche le titre et le message d'erreur", async ({ page }) => {
    // État initial : l'erreur est cachée
    await expect(page.getByTestId('error-boundary')).toBeHidden()
    await expect(page.getByTestId('content-card')).toBeVisible()

    // Déclencher une erreur
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur de chargement des données')
    })

    // L'erreur doit être visible avec le titre et le message
    await expect(page.getByTestId('error-boundary')).toBeVisible()
    await expect(page.getByTestId('error-title')).toBeVisible()
    await expect(page.getByTestId('error-title')).toHaveText('Une erreur est survenue')
    await expect(page.getByTestId('error-message')).toHaveText('Erreur de chargement des données')
    // Le contenu normal doit être caché
    await expect(page.getByTestId('content-card')).toBeHidden()
  })

  test('2: bouton Réessayer est visible', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur réseau')
    })

    const retryBtn = page.getByTestId('retry-btn')
    await expect(retryBtn).toBeVisible()
    await expect(retryBtn).toHaveText('Réessayer')
  })

  test("3: cliquer sur Réessayer efface l'erreur", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur temporaire')
    })
    await expect(page.getByTestId('error-boundary')).toBeVisible()

    // Cliquer sur Réessayer
    await page.getByTestId('retry-btn').click()
    await page.waitForTimeout(50)

    // L'erreur doit disparaître et le contenu normal réapparaître
    await expect(page.getByTestId('error-boundary')).toBeHidden()
    await expect(page.getByTestId('content-card')).toBeVisible()
  })

  test("4: affiche différents messages d'erreur", async ({ page }) => {
    const errorCases = [
      { message: 'Erreur interne du serveur (500)', type: 'API 500' },
      { message: 'Non authentifié (401)', type: 'API 401' },
      { message: 'Accès interdit (403)', type: 'API 403' },
      { message: 'Échec de la connexion réseau', type: 'Réseau' },
    ]

    for (const { message, type } of errorCases) {
      await page.evaluate((msg) => {
        ;(window as any).__showError(msg)
      }, message)
      await expect(page.getByTestId('error-message')).toHaveText(message)
      await expect(page.getByTestId('error-boundary')).toBeVisible()

      // Nettoyer avant le prochain cas
      await page.evaluate(() => {
        ;(window as any).__clearError()
      })
      await page.waitForTimeout(50)
    }
  })

  test("5: l'erreur a l'attribut role=\"alert\" pour l'accessibilité", async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur critique')
    })

    const errorBoundary = page.getByTestId('error-boundary')
    await expect(errorBoundary).toBeVisible()
    await expect(errorBoundary).toHaveAttribute('role', 'alert')
    await expect(errorBoundary).toHaveAttribute('aria-live', 'assertive')
  })

  test('6: affiche une deuxième erreur après un premier échec', async ({ page }) => {
    // Première erreur
    await page.evaluate(() => {
      ;(window as any).__showError('Première erreur')
    })
    await expect(page.getByTestId('error-message')).toHaveText('Première erreur')
    await expect(page.getByTestId('error-boundary')).toBeVisible()

    // Réessayer → l'erreur disparaît
    await page.getByTestId('retry-btn').click()
    await page.waitForTimeout(50)
    await expect(page.getByTestId('error-boundary')).toBeHidden()

    // Deuxième erreur (nouvel échec après retry)
    await page.evaluate(() => {
      ;(window as any).__showError('Deuxième erreur')
    })
    await expect(page.getByTestId('error-message')).toHaveText('Deuxième erreur')
    await expect(page.getByTestId('error-boundary')).toBeVisible()

    // Le nouveau message a bien remplacé l'ancien
    await expect(page.getByTestId('error-message')).not.toHaveText('Première erreur')
  })

  test('7: affiche le code statut HTTP dans un badge', async ({ page }) => {
    // Erreur 500 avec code statut
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur serveur', 500)
    })
    await expect(page.getByTestId('error-status-badge')).toBeVisible()
    await expect(page.getByTestId('error-status-badge')).toHaveText('500')
    await expect(page.getByTestId('error-message')).toHaveText('Erreur serveur')

    // Nettoyer
    await page.evaluate(() => {
      ;(window as any).__clearError()
    })
    await page.waitForTimeout(50)

    // Erreur 401 avec code statut
    await page.evaluate(() => {
      ;(window as any).__showError('Non autorisé', 401)
    })
    await expect(page.getByTestId('error-status-badge')).toBeVisible()
    await expect(page.getByTestId('error-status-badge')).toHaveText('401')

    // Nettoyer
    await page.evaluate(() => {
      ;(window as any).__clearError()
    })
    await page.waitForTimeout(50)

    // Erreur 403 avec code statut
    await page.evaluate(() => {
      ;(window as any).__showError('Accès refusé', 403)
    })
    await expect(page.getByTestId('error-status-badge')).toBeVisible()
    await expect(page.getByTestId('error-status-badge')).toHaveText('403')
  })

  test('8: le bouton Réessayer est accessible au clavier (Tab)', async ({ page }) => {
    await page.evaluate(() => {
      ;(window as any).__showError('Erreur')
    })

    const retryBtn = page.getByTestId('retry-btn')
    await expect(retryBtn).toBeVisible()

    // Tab jusqu'au bouton Réessayer
    await page.keyboard.press('Tab')

    // Le bouton doit avoir le focus
    await expect(retryBtn).toBeFocused()

    // Appuyer sur Entrée pour déclencher le retry
    await page.keyboard.press('Enter')
    await page.waitForTimeout(50)

    // L'erreur doit être effacée
    await expect(page.getByTestId('error-boundary')).toBeHidden()
    await expect(page.getByTestId('content-card')).toBeVisible()
  })
})
