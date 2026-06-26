/**
 * E2E Tests — Deep Form Validation
 *
 * Tests advanced validation and UX scenarios for the three admin creation forms
 * (Feature, Plan, Override) using a combined fixture that supports tab switching.
 *
 * Covers:
 * - Double submit prevention
 * - Comprehensive field validation per form
 * - Uppercase / case enforcement
 * - Numeric boundary validation (negative prices)
 * - Character limit enforcement (reason max 500)
 * - Loading state display
 * - Form reset behavior
 * - Tab switching state preservation
 * - Long key boundaries (100 chars)
 * - Key format validation (spaces rejected)
 * - Cancel navigation
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const DEEP_URL = `file://${path.join(FIXTURES_DIR, 'admin-form-deep.html')}`

const LONG_KEY_100 = 'K' + 'E'.repeat(99) // 100 chars, all uppercase
const REASON_501 = 'R'.repeat(501)

test.describe('Admin — Validation approfondie des formulaires', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEEP_URL, { waitUntil: 'networkidle' })
  })

  // ── 1. Double submit prevention ──────────────────────────────────────

  test('1: double soumission — un seul enregistrement est compté', async ({ page }) => {
    // Fill valid data on the feature form
    await page.getByTestId('feature-key').fill('DOUBLE_SUBMIT')
    await page.getByTestId('feature-name').fill('Double Submit Test')

    const btn = page.getByTestId('feature-submit')

    // Click normally (first click triggers handler, button becomes disabled)
    await btn.click()

    // Dispatch a second click event directly (bypasses disabled check)
    // The handler should reject it via the __submitting flag
    await btn.dispatchEvent('click')

    // Wait for success message
    await expect(page.getByTestId('success-message')).toBeVisible()

    // Verify only one submission was recorded
    const count = await page.evaluate(() => (window as any).__submitCount)
    expect(count).toBe(1)

    // Verify submitted data
    const data = await page.evaluate(() => (window as any).__submittedData)
    expect(data).toMatchObject({ key: 'DOUBLE_SUBMIT', name: 'Double Submit Test' })
  })

  // ── 2. All fields empty for each form ────────────────────────────────

  test('2: tous les champs vides — erreurs de validation pour chaque formulaire', async ({
    page,
  }) => {
    // ── Feature form ──
    await page.getByTestId('feature-submit').click()
    await expect(page.getByTestId('feature-key-error')).toBeVisible()
    await expect(page.getByTestId('feature-key-error')).toHaveText('La clé est requise')
    await expect(page.getByTestId('feature-name-error')).toBeVisible()
    await expect(page.getByTestId('feature-name-error')).toHaveText('Le nom est requis')

    // ── Plan form ──
    await page.getByTestId('tab-plan').click()
    await page.getByTestId('plan-submit').click()
    await expect(page.getByTestId('plan-key-error')).toBeVisible()
    await expect(page.getByTestId('plan-key-error')).toHaveText('La clé est requise')
    await expect(page.getByTestId('plan-name-error')).toBeVisible()
    await expect(page.getByTestId('plan-name-error')).toHaveText('Le nom est requis')
    await expect(page.getByTestId('plan-price-error')).toBeVisible()
    await expect(page.getByTestId('plan-price-error')).toHaveText(
      'Le prix mensuel doit être supérieur ou égal à 0'
    )

    // ── Override form ──
    await page.getByTestId('tab-override').click()
    await page.getByTestId('override-submit').click()
    await expect(page.getByTestId('override-scope-id-error')).toBeVisible()
    await expect(page.getByTestId('override-scope-id-error')).toHaveText(
      "L'ID de portée est requis"
    )
    await expect(page.getByTestId('override-feature-key-error')).toBeVisible()
    await expect(page.getByTestId('override-feature-key-error')).toHaveText(
      'La clé de fonctionnalité est requise'
    )
    await expect(page.getByTestId('override-reason-error')).toBeVisible()
    await expect(page.getByTestId('override-reason-error')).toHaveText('La raison est requise')
  })

  // ── 3. Key field must be uppercase (feature form) ────────────────────

  test('3: clé en minuscules sur le formulaire feature — erreur de validation', async ({
    page,
  }) => {
    await page.getByTestId('feature-key').fill('ma_feature')
    await page.getByTestId('feature-name').fill('Ma Feature')
    await page.getByTestId('feature-submit').click()

    await expect(page.getByTestId('feature-key-error')).toBeVisible()
    await expect(page.getByTestId('feature-key-error')).toHaveText(
      'La clé doit être en MAJUSCULES sans espaces'
    )
  })

  // ── 4. Price negative validation ─────────────────────────────────────

  test('4: prix mensuel négatif — erreur de validation', async ({ page }) => {
    await page.getByTestId('tab-plan').click()
    await page.getByTestId('plan-key').fill('neg_plan')
    await page.getByTestId('plan-name').fill('Negative Plan')
    await page.getByTestId('plan-price-monthly').fill('-10')
    await page.getByTestId('plan-submit').click()

    await expect(page.getByTestId('plan-price-error')).toBeVisible()
    await expect(page.getByTestId('plan-price-error')).toHaveText(
      'Le prix mensuel doit être supérieur ou égal à 0'
    )
  })

  // ── 5. reason field max 500 chars ────────────────────────────────────

  test('5: raison de plus de 500 caractères — erreur de validation', async ({ page }) => {
    await page.getByTestId('tab-override').click()
    await page.getByTestId('override-scope-id').fill('org-42')
    await page.getByTestId('override-feature-key').fill('TEST_FEATURE')
    await page.getByTestId('override-reason').fill(REASON_501)
    await page.getByTestId('override-submit').click()

    await expect(page.getByTestId('override-reason-error')).toBeVisible()
    await expect(page.getByTestId('override-reason-error')).toHaveText(
      'La raison ne doit pas dépasser 500 caractères'
    )
  })

  // ── 6. scopeId + featureKey + reason empty simultaneously ────────────

  test('6: scopeId, featureKey et raison vides — toutes les erreurs affichées simultanément', async ({
    page,
  }) => {
    await page.getByTestId('tab-override').click()
    await page.getByTestId('override-submit').click()

    await expect(page.getByTestId('override-scope-id-error')).toBeVisible()
    await expect(page.getByTestId('override-scope-id-error')).toHaveText(
      "L'ID de portée est requis"
    )
    await expect(page.getByTestId('override-feature-key-error')).toBeVisible()
    await expect(page.getByTestId('override-feature-key-error')).toHaveText(
      'La clé de fonctionnalité est requise'
    )
    await expect(page.getByTestId('override-reason-error')).toBeVisible()
    await expect(page.getByTestId('override-reason-error')).toHaveText('La raison est requise')
  })

  // ── 7. Loading state on submit ───────────────────────────────────────

  test('7: état de chargement — le bouton affiche "Création en cours..."', async ({ page }) => {
    await page.getByTestId('feature-key').fill('LOADING_TEST')
    await page.getByTestId('feature-name').fill('Loading Test')

    // Click submit — handler synchronously changes button text before
    // scheduling body replacement (300 ms delay)
    await page.getByTestId('feature-submit').click()

    // Read button text synchronously before the setTimeout fires
    const btnText = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('[data-testid="feature-submit"]')
      return btn ? btn.textContent : null
    })
    expect(btnText).toBe('Création en cours...')

    // Also verify button was disabled
    const isDisabled = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('[data-testid="feature-submit"]')
      return btn ? btn.disabled : null
    })
    expect(isDisabled).toBe(true)

    // Wait for success message
    await expect(page.getByTestId('success-message')).toBeVisible()
  })

  // ── 8. Form reset ────────────────────────────────────────────────────

  test('8: réinitialisation du formulaire — tous les champs sont vidés', async ({ page }) => {
    // Fill feature form
    await page.getByTestId('feature-key').fill('RESET_TEST')
    await page.getByTestId('feature-name').fill('Reset Test')

    // Click reset
    await page.getByTestId('feature-reset').click()

    // All fields should be cleared
    await expect(page.getByTestId('feature-key')).toHaveValue('')
    await expect(page.getByTestId('feature-name')).toHaveValue('')

    // Repeat for plan form
    await page.getByTestId('tab-plan').click()
    await page.getByTestId('plan-key').fill('reset_plan')
    await page.getByTestId('plan-name').fill('Reset Plan')
    await page.getByTestId('plan-price-monthly').fill('42')
    await page.getByTestId('plan-reset').click()

    await expect(page.getByTestId('plan-key')).toHaveValue('')
    await expect(page.getByTestId('plan-name')).toHaveValue('')
    await expect(page.getByTestId('plan-price-monthly')).toHaveValue('')

    // Repeat for override form
    await page.getByTestId('tab-override').click()
    await page.getByTestId('override-scope-id').fill('org-99')
    await page.getByTestId('override-feature-key').fill('RESET_FEATURE')
    await page.getByTestId('override-reason').fill('Reset reason')
    await page.getByTestId('override-reset').click()

    await expect(page.getByTestId('override-scope-id')).toHaveValue('')
    await expect(page.getByTestId('override-feature-key')).toHaveValue('')
    await expect(page.getByTestId('override-reason')).toHaveValue('')
  })

  // ── 9. Switch between forms preserves state ──────────────────────────

  test("9: changement d'onglet — les données saisies sont conservées", async ({ page }) => {
    // Fill feature form
    await page.getByTestId('feature-key').fill('MY_PRESERVED_KEY')
    await page.getByTestId('feature-name').fill('Preserved Name')

    // Switch to plan tab
    await page.getByTestId('tab-plan').click()
    await expect(page.getByTestId('plan-form-section')).toBeVisible()

    // Switch back to feature tab
    await page.getByTestId('tab-feature').click()
    await expect(page.getByTestId('feature-form-section')).toBeVisible()

    // Verify fields are still filled
    await expect(page.getByTestId('feature-key')).toHaveValue('MY_PRESERVED_KEY')
    await expect(page.getByTestId('feature-name')).toHaveValue('Preserved Name')

    // Fill plan form and repeat
    await page.getByTestId('tab-plan').click()
    await page.getByTestId('plan-key').fill('preserved_plan')
    await page.getByTestId('plan-name').fill('Preserved Plan')
    await page.getByTestId('plan-price-monthly').fill('99')

    // Switch to override and back
    await page.getByTestId('tab-override').click()
    await page.getByTestId('tab-plan').click()

    // Verify plan fields preserved
    await expect(page.getByTestId('plan-key')).toHaveValue('preserved_plan')
    await expect(page.getByTestId('plan-name')).toHaveValue('Preserved Plan')
    await expect(page.getByTestId('plan-price-monthly')).toHaveValue('99')
  })

  // ── 10. Very long key (100 chars) ────────────────────────────────────

  test('10: clé de 100 caractères — soumission réussie', async ({ page }) => {
    await page.getByTestId('feature-key').fill(LONG_KEY_100)
    await page.getByTestId('feature-name').fill('Long Key Feature')
    await page.getByTestId('feature-submit').click()

    // Should succeed since all uppercase
    await expect(page.getByTestId('success-message')).toBeVisible()

    const data = await page.evaluate(() => (window as any).__submittedData)
    expect(data).not.toBeNull()
    expect(data.key).toBe(LONG_KEY_100)
    expect(data.name).toBe('Long Key Feature')
  })

  // ── 11. Key with spaces ──────────────────────────────────────────────

  test('11: clé avec espaces — erreur de validation', async ({ page }) => {
    await page.getByTestId('feature-key').fill('MY KEY WITH SPACES')
    await page.getByTestId('feature-name').fill('Spaces Feature')
    await page.getByTestId('feature-submit').click()

    await expect(page.getByTestId('feature-key-error')).toBeVisible()
    await expect(page.getByTestId('feature-key-error')).toHaveText(
      'La clé doit être en MAJUSCULES sans espaces'
    )

    // Verify no data was submitted
    const data = await page.evaluate(() => (window as any).__submittedData)
    expect(data).toBeNull()
  })

  // ── 12. Cancel button returns to list ────────────────────────────────

  test('12: bouton Annuler — redirige vers la liste correspondante', async ({ page }) => {
    // Feature cancel
    await page.getByTestId('feature-cancel').click()
    let redirect = await page.evaluate(() => (window as any).__redirectedTo)
    expect(redirect).toBe('/admin/features')

    // Reload page
    await page.goto(DEEP_URL, { waitUntil: 'networkidle' })

    // Plan cancel
    await page.getByTestId('tab-plan').click()
    await page.getByTestId('plan-cancel').click()
    redirect = await page.evaluate(() => (window as any).__redirectedTo)
    expect(redirect).toBe('/admin/plans')

    // Reload page
    await page.goto(DEEP_URL, { waitUntil: 'networkidle' })

    // Override cancel
    await page.getByTestId('tab-override').click()
    await page.getByTestId('override-cancel').click()
    redirect = await page.evaluate(() => (window as any).__redirectedTo)
    expect(redirect).toBe('/admin/overrides')
  })
})
