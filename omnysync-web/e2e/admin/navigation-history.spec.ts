/**
 * E2E Tests — Admin Navigation History
 *
 * Tests browser navigation behavior (back/forward) with state
 * persistence across a hash-routed SPA admin interface.
 *
 * Covers: simple nav, back, forward, deep multi-page traversal,
 * search persistence, sort persistence, pagination persistence,
 * page refresh, direct URL access, form data preservation,
 * rapid back/back, and sessionStorage state verification.
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const FIXTURE_URL = `file://${path.join(FIXTURES_DIR, 'admin-navigation-history.html')}`

test.describe('Admin — Navigation History', () => {
  // ──────────────────────────────────────────────
  // Test 1 : Navigation simple
  // ──────────────────────────────────────────────
  test('1 — Navigation simple : clic lien → page cible', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    // La page par défaut est le Dashboard
    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()
    await expect(page.getByTestId('page-title-dashboard')).toContainText('Dashboard')

    // Clic sur le lien Utilisateurs
    await page.getByTestId('nav-link-users').click()

    // La page Utilisateurs doit être affichée
    await expect(page.getByTestId('page-content-users')).toBeVisible()
    await expect(page.getByTestId('page-title-users')).toContainText('Utilisateurs')
    expect(page.url()).toContain('#users')
  })

  // ──────────────────────────────────────────────
  // Test 2 : Retour arrière
  // ──────────────────────────────────────────────
  test('2 — Retour arrière (browser back)', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()

    // Navigation vers Utilisateurs
    await page.getByTestId('nav-link-users').click()
    await expect(page.getByTestId('page-content-users')).toBeVisible()
    expect(page.url()).toContain('#users')

    // Retour arrière
    await page.goBack()

    // On doit revenir au Dashboard
    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()
    expect(page.url()).not.toContain('#users')
  })

  // ──────────────────────────────────────────────
  // Test 3 : Retour avant
  // ──────────────────────────────────────────────
  test('3 — Retour avant (browser forward)', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()

    // Navigation vers Utilisateurs
    await page.getByTestId('nav-link-users').click()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    // Retour arrière
    await page.goBack()
    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()

    // Retour avant → on doit retrouver Utilisateurs
    await page.goForward()
    await expect(page.getByTestId('page-content-users')).toBeVisible()
    expect(page.url()).toContain('#users')
  })

  // ──────────────────────────────────────────────
  // Test 4 : Multiples allers-retours
  // ──────────────────────────────────────────────
  test('4 — Multiples allers-retours', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()

    // Navigation à travers 4 pages : Users → Features → Orgs → Plans
    await page.getByTestId('nav-link-users').click()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    await page.getByTestId('nav-link-features').click()
    await expect(page.getByTestId('page-content-features')).toBeVisible()

    await page.getByTestId('nav-link-orgs').click()
    await expect(page.getByTestId('page-content-orgs')).toBeVisible()

    await page.getByTestId('nav-link-plans').click()
    await expect(page.getByTestId('page-content-plans')).toBeVisible()
    expect(page.url()).toContain('#plans')

    // Reculer de 2 : Plans → Orgs → Features
    await page.goBack()
    await expect(page.getByTestId('page-content-orgs')).toBeVisible()
    expect(page.url()).toContain('#orgs')

    await page.goBack()
    await expect(page.getByTestId('page-content-features')).toBeVisible()
    expect(page.url()).toContain('#features')

    // Avancer de 1 : Features → Orgs
    await page.goForward()
    await expect(page.getByTestId('page-content-orgs')).toBeVisible()
    expect(page.url()).toContain('#orgs')
  })

  // ──────────────────────────────────────────────
  // Test 5 : Recherche persistante
  // ──────────────────────────────────────────────
  test('5 — Recherche persistante après navigation', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    // Aller sur Utilisateurs
    await page.getByTestId('nav-link-users').click()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    const usersSection = page.getByTestId('page-content-users')

    // Saisir une recherche
    await usersSection.getByTestId('search-input').fill('alice')
    await expect(usersSection.getByTestId('search-input')).toHaveValue('alice')
    await expect(usersSection.getByTestId('search-state')).toContainText('alice')

    // Naviguer vers le Dashboard
    await page.getByTestId('nav-link-dashboard').click()
    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()

    // Revenir sur Utilisateurs
    await page.goBack()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    // La recherche doit être préservée
    await expect(usersSection.getByTestId('search-input')).toHaveValue('alice')
    await expect(usersSection.getByTestId('search-state')).toContainText('alice')
  })

  // ──────────────────────────────────────────────
  // Test 6 : Tri persistant
  // ──────────────────────────────────────────────
  test('6 — Tri persistant après navigation', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    // Aller sur Utilisateurs
    await page.getByTestId('nav-link-users').click()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    const usersSection = page.getByTestId('page-content-users')

    // Trier par Email
    await usersSection.getByTestId('col-header-email').click()

    // Vérifier le tri
    await expect(usersSection.getByTestId('sort-state')).toContainText('email')
    await expect(usersSection.getByTestId('sort-state')).toContainText('asc')

    // Naviguer vers le Dashboard
    await page.getByTestId('nav-link-dashboard').click()
    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()

    // Revenir sur Utilisateurs
    await page.goBack()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    // Le tri doit être préservé
    await expect(usersSection.getByTestId('sort-state')).toContainText('email')
    await expect(usersSection.getByTestId('sort-state')).toContainText('asc')
  })

  // ──────────────────────────────────────────────
  // Test 7 : Pagination persistante
  // ──────────────────────────────────────────────
  test('7 — Pagination persistante après navigation', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    // Aller sur Utilisateurs
    await page.getByTestId('nav-link-users').click()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    const usersSection = page.getByTestId('page-content-users')

    // Aller à la page 3
    // Il y a 25 utilisateurs → 3 pages (10/page)
    await usersSection.getByTestId('next-page').click()
    await usersSection.getByTestId('next-page').click()
    await expect(usersSection.getByTestId('pagination-state')).toContainText('page-3')

    // Naviguer vers le Dashboard
    await page.getByTestId('nav-link-dashboard').click()
    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()

    // Revenir sur Utilisateurs
    await page.goBack()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    // La pagination doit être préservée (page 3)
    await expect(usersSection.getByTestId('pagination-state')).toContainText('page-3')
  })

  // ──────────────────────────────────────────────
  // Test 8 : Refresh (F5)
  // ──────────────────────────────────────────────
  test('8 — Refresh (F5) : état préservé', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    // Aller sur Utilisateurs
    await page.getByTestId('nav-link-users').click()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    const usersSection = page.getByTestId('page-content-users')

    // Appliquer recherche, tri et pagination
    await usersSection.getByTestId('search-input').fill('e')
    await usersSection.getByTestId('col-header-role').click()
    await usersSection.getByTestId('next-page').click() // page 2

    // Vérifier l'état
    await expect(usersSection.getByTestId('search-input')).toHaveValue('e')
    await expect(usersSection.getByTestId('sort-state')).toContainText('role')
    await expect(usersSection.getByTestId('pagination-state')).toContainText('page-2')

    // Recharger la page (F5)
    await page.reload({ waitUntil: 'networkidle' })

    // L'URL doit toujours contenir #users
    expect(page.url()).toContain('#users')

    // L'état doit être préservé après le rechargement
    await expect(page.getByTestId('page-content-users')).toBeVisible()
    const usersSectionAfter = page.getByTestId('page-content-users')
    await expect(usersSectionAfter.getByTestId('search-input')).toHaveValue('e')
    await expect(usersSectionAfter.getByTestId('sort-state')).toContainText('role')
    await expect(usersSectionAfter.getByTestId('pagination-state')).toContainText('page-2')
  })

  // ──────────────────────────────────────────────
  // Test 9 : Lien direct
  // ──────────────────────────────────────────────
  test('9 — Lien direct : accès à la page par hash', async ({ page }) => {
    // Accès direct à #users
    await page.goto(`${FIXTURE_URL}#users`, { waitUntil: 'networkidle' })

    // La page Utilisateurs doit être affichée directement
    await expect(page.getByTestId('page-content-users')).toBeVisible()
    await expect(page.getByTestId('page-title-users')).toContainText('Utilisateurs')
    expect(page.url()).toContain('#users')

    // Vérifier que la page est dans un état propre par défaut
    const usersSection = page.getByTestId('page-content-users')
    await expect(usersSection.getByTestId('search-state')).toContainText('(aucune)')
    await expect(usersSection.getByTestId('pagination-state')).toContainText('page-1')
  })

  // ──────────────────────────────────────────────
  // Test 10 : Formulaire — données non sauvegardées
  // ──────────────────────────────────────────────
  test('10 — Formulaire : données non sauvegardées préservées', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    // Aller sur Plans
    await page.getByTestId('nav-link-plans').click()
    await expect(page.getByTestId('page-content-plans')).toBeVisible()

    // Remplir le formulaire
    await page.getByTestId('form-field-name').fill('Premium Plus')
    await page.getByTestId('form-field-email').fill('premium@example.com')

    // Vérifier que les champs sont remplis
    await expect(page.getByTestId('form-field-name')).toHaveValue('Premium Plus')
    await expect(page.getByTestId('form-field-email')).toHaveValue('premium@example.com')

    // Naviguer vers le Dashboard (données non sauvegardées formellement)
    await page.getByTestId('nav-link-dashboard').click()
    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()

    // Revenir sur Plans via le bouton retour
    await page.goBack()
    await expect(page.getByTestId('page-content-plans')).toBeVisible()

    // Les données du formulaire doivent être préservées
    // (automatiquement sauvegardées dans sessionStorage via les écouteurs input)
    await expect(page.getByTestId('form-field-name')).toHaveValue('Premium Plus')
    await expect(page.getByTestId('form-field-email')).toHaveValue('premium@example.com')
  })

  // ──────────────────────────────────────────────
  // Test 11 : Double retour rapide
  // ──────────────────────────────────────────────
  test('11 — Double retour rapide : pas de crash', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    // Navigation profonde : Dashboard → Users → Features → Orgs → Plans
    await page.getByTestId('nav-link-users').click()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    await page.getByTestId('nav-link-features').click()
    await expect(page.getByTestId('page-content-features')).toBeVisible()

    await page.getByTestId('nav-link-orgs').click()
    await expect(page.getByTestId('page-content-orgs')).toBeVisible()

    await page.getByTestId('nav-link-plans').click()
    await expect(page.getByTestId('page-content-plans')).toBeVisible()

    // Double retour rapide : Plans → Orgs → Features
    await page.goBack()
    await expect(page.getByTestId('page-content-orgs')).toBeVisible()

    await page.goBack()
    await expect(page.getByTestId('page-content-features')).toBeVisible()

    // Vérifier que l'application est toujours stable (pas de crash)
    // On peut encore naviguer
    await page.getByTestId('nav-link-dashboard').click()
    await expect(page.getByTestId('page-content-dashboard')).toBeVisible()
  })

  // ──────────────────────────────────────────────
  // Test 12 : SessionStorage vs état navigation
  // ──────────────────────────────────────────────
  test('12 — SessionStorage : état stocké correctement', async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })

    // Aller sur Utilisateurs et appliquer un état
    await page.getByTestId('nav-link-users').click()
    await expect(page.getByTestId('page-content-users')).toBeVisible()

    const usersSection = page.getByTestId('page-content-users')

    // Appliquer recherche et tri (sans pagination — la recherche 'e' correspond à 10 utilisateurs)
    await usersSection.getByTestId('search-input').fill('e')
    await usersSection.getByTestId('col-header-email').click()

    // Attendre que le state soit enregistré
    await page.waitForTimeout(200)

    // Vérifier l'état dans sessionStorage
    const stateStr = await page.evaluate(() => {
      return sessionStorage.getItem('nav_state_users')
    })
    expect(stateStr).toBeTruthy()

    const state = JSON.parse(stateStr || '{}')
    expect(state.search).toBe('e')
    expect(state.sortColumn).toBe('email')
    expect(state.sortDir).toBe('asc')

    // Naviguer vers les Features
    await page.getByTestId('nav-link-features').click()
    await expect(page.getByTestId('page-content-features')).toBeVisible()

    // Vérifier que le state Users est toujours dans sessionStorage
    const stateStrAfterNav = await page.evaluate(() => {
      return sessionStorage.getItem('nav_state_users')
    })
    expect(stateStrAfterNav).toBeTruthy()
    const stateAfterNav = JSON.parse(stateStrAfterNav || '{}')
    expect(stateAfterNav.search).toBe('e')

    // Naviguer vers les Plans et remplir le formulaire
    await page.getByTestId('nav-link-plans').click()
    await expect(page.getByTestId('page-content-plans')).toBeVisible()
    await page.getByTestId('form-field-name').fill('Test Plan')
    await page.getByTestId('form-field-email').fill('test@example.com')
    await page.waitForTimeout(200)

    // Vérifier le form data dans sessionStorage Plans
    const plansStateStr = await page.evaluate(() => {
      return sessionStorage.getItem('nav_state_plans')
    })
    expect(plansStateStr).toBeTruthy()
    const plansState = JSON.parse(plansStateStr || '{}')
    expect(plansState.formName).toBe('Test Plan')
    expect(plansState.formEmail).toBe('test@example.com')

    // Vérifier que chaque section a son propre état isolé
    const featuresStateStr = await page.evaluate(() => {
      return sessionStorage.getItem('nav_state_features')
    })
    expect(featuresStateStr).toBeTruthy()
    const featuresState = JSON.parse(featuresStateStr || '{}')
    // Features a une recherche vide (pas modifiée)
    expect(featuresState.search).toBe('')
  })
})
