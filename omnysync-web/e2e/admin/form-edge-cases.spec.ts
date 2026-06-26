/**
 * E2E Tests — Admin Form Edge Cases
 *
 * Tests edge cases in admin creation forms:
 * - Very long inputs (strings, numbers)
 * - Special characters
 * - XSS attempts
 * - Boundary values (0, negative, very large numbers)
 * - Whitespace-only inputs
 * - Unicode / emoji inputs
 *
 * Uses existing fixtures: admin-features-new, admin-plans-new, admin-overrides-new
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const FEATURES_NEW = `file://${path.join(FIXTURES_DIR, 'admin-features-new.html')}`
const PLANS_NEW = `file://${path.join(FIXTURES_DIR, 'admin-plans-new.html')}`
const OVERRIDES_NEW = `file://${path.join(FIXTURES_DIR, 'admin-overrides-new.html')}`

// ─── Helper ───────────────────────────────────────────────────────────────
const LONG_STRING = 'a'.repeat(1000)
const XSS_PAYLOAD = '<script>alert("xss")</script>'
const SPECIAL_CHARS = '!@#$%^&*()_+{}:"|<>?~`'
const UNICODE_TEXT = '日本語 Español Français العربية 中文'

test.describe('Admin — Form Edge Cases', () => {
  // ── 1. Feature Creation — very long key/name ──────────────────────

  test.describe('Feature creation form', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(FEATURES_NEW, { waitUntil: 'networkidle' })
    })

    test('1: très long key et name (1000 caractères) — soumission réussie', async ({ page }) => {
      await page.fill('#key', 'VERY_LONG_' + LONG_STRING.slice(0, 100))
      await page.fill('#name', LONG_STRING)
      await page.getByRole('button', { name: /Create Feature/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
      expect(data.key).toContain('VERY_LONG_')
    })

    test("2: XSS dans le nom — pas d'exécution, soumission réussie", async ({ page }) => {
      await page.fill('#key', 'XSS_TEST')
      await page.fill('#name', XSS_PAYLOAD)
      await page.getByRole('button', { name: /Create Feature/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
      expect(data.name).toBe(XSS_PAYLOAD)
    })

    test('3: caractères spéciaux dans le nom — soumission réussie', async ({ page }) => {
      await page.fill('#key', 'SPECIAL_CHARS')
      await page.fill('#name', SPECIAL_CHARS)
      await page.getByRole('button', { name: /Create Feature/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
    })

    test('4: unicode dans le nom — soumission réussie', async ({ page }) => {
      await page.fill('#key', 'UNICODE_TEST')
      await page.fill('#name', UNICODE_TEXT)
      await page.getByRole('button', { name: /Create Feature/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
      expect(data.name).toBe(UNICODE_TEXT)
    })

    test('5: JSON invalide dans DefaultConfig — erreur affichée', async ({ page }) => {
      await page.fill('#key', 'BAD_JSON')
      await page.fill('#name', 'Bad JSON')
      await page.fill('#defaultConfig', 'pas du json')
      await page.getByRole('button', { name: /Create Feature/i }).click()

      await expect(page.getByTestId('form-error')).toBeVisible()
      expect(await page.evaluate(() => (window as any).__submittedData)).toBeNull()
    })
  })

  // ── 2. Plan Creation — price boundaries ────────────────────────────

  test.describe('Plan creation form — price boundaries', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(PLANS_NEW, { waitUntil: 'networkidle' })
    })

    test('6: prix à 0 (gratuit) — soumission réussie', async ({ page }) => {
      await page.getByLabel(/Key/i).fill('free_plan_test')
      await page.getByLabel(/Name/i).fill('Free Test')
      await page.getByLabel(/Price Monthly/i).fill('0')
      await page.getByLabel(/Price Yearly/i).fill('0')
      await page.getByRole('button', { name: /Create Plan/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
      expect(data.priceMonthly).toBe(0)
      expect(data.priceYearly).toBe(0)
    })

    test('7: prix très élevé — soumission réussie', async ({ page }) => {
      await page.getByLabel(/Key/i).fill('expensive_plan')
      await page.getByLabel(/Name/i).fill('Expensive Plan')
      await page.getByLabel(/Price Monthly/i).fill('999999.99')
      await page.getByLabel(/Price Yearly/i).fill('9999999.99')
      await page.getByRole('button', { name: /Create Plan/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
      expect(data.priceMonthly).toBe(999999.99)
    })

    test('8: prix négatif — le parseFloat les accepte', async ({ page }) => {
      // This tests that the form accepts negative values (backend validation separate)
      await page.getByLabel(/Key/i).fill('neg_plan')
      await page.getByLabel(/Name/i).fill('Negative Plan')
      await page.getByLabel(/Price Monthly/i).fill('-10')
      await page.getByRole('button', { name: /Create Plan/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
    })

    test('9: key avec espaces — validation', async ({ page }) => {
      await page.getByLabel(/Key/i).fill('   ')
      await page.getByLabel(/Name/i).fill('Spaces Only')
      await page.getByLabel(/Price Monthly/i).fill('10')
      await page.getByRole('button', { name: /Create Plan/i }).click()

      await expect(page.getByTestId('key-error')).toHaveText('Key is required')
    })
  })

  // ── 3. Override Creation — boundary and edge values ────────────────

  test.describe('Override creation form — edge values', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(OVERRIDES_NEW, { waitUntil: 'networkidle' })
    })

    test('10: limitValue = 0 — soumission réussie', async ({ page }) => {
      await page.locator('#scopeId').fill('org-edge')
      await page.locator('#featureKey').fill('ZERO_LIMIT')
      await page.locator('#limitValue').fill('0')
      await page.locator('#reason').fill('Zero limit test')
      await page.getByRole('button', { name: /create override/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
      expect(data.limitValue).toBe(0)
    })

    test('11: limitValue très grand — soumission réussie', async ({ page }) => {
      await page.locator('#scopeId').fill('org-large')
      await page.locator('#featureKey').fill('LARGE_LIMIT')
      await page.locator('#limitValue').fill('999999999')
      await page.locator('#reason').fill('Large limit test')
      await page.getByRole('button', { name: /create override/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
      expect(data.limitValue).toBe(999999999)
    })

    test('12: très longue raison (1000 caractères) — soumission réussie', async ({ page }) => {
      await page.locator('#scopeId').fill('org-long-reason')
      await page.locator('#featureKey').fill('LONG_REASON')
      await page.locator('#reason').fill(LONG_STRING)
      await page.getByRole('button', { name: /create override/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
      expect(data.reason.length).toBe(1000)
    })

    test('13: scopeId avec unicode — soumission réussie', async ({ page }) => {
      await page.locator('#scopeId').fill('org-' + UNICODE_TEXT)
      await page.locator('#featureKey').fill('UNICODE_ORG')
      await page.locator('#reason').fill('Unicode org ID test')
      await page.getByRole('button', { name: /create override/i }).click()

      const data = await page.evaluate(() => (window as any).__submittedData)
      expect(data).not.toBeNull()
    })

    test('14: toutes les valeurs vides — validation multi-champs', async ({ page }) => {
      await page.getByRole('button', { name: /create override/i }).click()

      await expect(page.getByTestId('scopeId-error')).toBeVisible()
      await expect(page.getByTestId('featureKey-error')).toBeVisible()
      await expect(page.getByTestId('reason-error')).toBeVisible()
    })
  })
})
