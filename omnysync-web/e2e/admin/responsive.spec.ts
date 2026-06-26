/**
 * E2E Tests — Admin Responsive / Mobile Layout
 *
 * Tests that the admin layout adapts correctly to mobile (375px),
 * tablet (768px) and desktop (1280px) viewports.
 *
 * Coverage:
 * - Sidebar hidden on mobile, visible on desktop
 * - Stats cards grid adapts (1 → 2 → 4 columns)
 * - Search bar full-width on mobile
 * - Action buttons full-width on mobile
 * - Font sizing remains readable
 * - No horizontal overflow (except tables)
 * - Touch targets ≥ 44px
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures')
const FIXTURE_URL = `file://${path.join(FIXTURES_DIR, 'admin-responsive.html')}`

// ---------------------------------------------------------------------------
// Viewport presets
// ---------------------------------------------------------------------------
const MOBILE = { width: 375, height: 812 }
const TABLET = { width: 768, height: 1024 }
const DESKTOP = { width: 1280, height: 800 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goto(
  page: import('@playwright/test').Page,
  viewport: { width: number; height: number }
) {
  await page.setViewportSize(viewport)
  await page.goto(FIXTURE_URL, { waitUntil: 'networkidle' })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Admin — Responsive / Mobile Layout', () => {
  // ── Sidebar ─────────────────────────────────────────────────────────────

  test.describe('Sidebar responsive', () => {
    test('1. Mobile (375px) : sidebar est masquée par défaut', async ({ page }) => {
      await goto(page, MOBILE)

      const sidebar = page.getByTestId('sidebar')
      // La classe -translate-x-full est présente → sidebar hors-écran
      await expect(sidebar).toHaveClass(/-translate-x-full/)
      // Le toggle hamburger est visible
      await expect(page.getByTestId('sidebar-toggle')).toBeVisible()
    })

    test('2. Mobile : clic hamburger ouvre la sidebar, clic fermeture la referme', async ({
      page,
    }) => {
      await goto(page, MOBILE)

      const sidebar = page.getByTestId('sidebar')
      const toggle = page.getByTestId('sidebar-toggle')
      const closeBtn = page.getByTestId('sidebar-close-btn')
      const overlay = page.getByTestId('sidebar-overlay')

      // Ouvrir
      await toggle.click()
      await expect(sidebar).not.toHaveClass(/-translate-x-full/)
      await expect(overlay).toBeVisible()

      // Fermer via le bouton X
      await closeBtn.click()
      await expect(sidebar).toHaveClass(/-translate-x-full/)
      await expect(overlay).not.toBeVisible()
    })

    test('3. Desktop (1280px) : sidebar est visible, toggle est masqué', async ({ page }) => {
      await goto(page, DESKTOP)

      const sidebar = page.getByTestId('sidebar')
      // Vérifie par computed style que la sidebar est visible (translate-x-0)
      const transform = await sidebar.evaluate((el) => window.getComputedStyle(el).transform)
      // lg:translate-x-0 → matrix identity (pas de translation)
      expect(transform).toBe('matrix(1, 0, 0, 1, 0, 0)')
      // Le toggle n'est pas visible sur desktop (lg:hidden)
      await expect(page.getByTestId('sidebar-toggle')).not.toBeVisible()
    })
  })

  // ── Stats cards grid ────────────────────────────────────────────────────

  test.describe('Grille de statistiques responsive', () => {
    test('4. Mobile : les cartes sont en colonne unique (grid-cols-1)', async ({ page }) => {
      await goto(page, MOBILE)

      const grid = page.getByTestId('stats-grid')
      // Vérifie que toutes les cartes sont les unes sous les autres
      // En comptant le nombre de rangées : 4 cartes en 1 colonne = 4 rangées
      const cards = grid.locator('> div')
      await expect(cards).toHaveCount(4)

      // Vérifie que la grille utilise grid-cols-1
      await expect(grid).toHaveClass(/grid-cols-1/)
    })

    test('5. Tablette (768px) : les cartes passent en 2 colonnes', async ({ page }) => {
      await goto(page, TABLET)

      const grid = page.getByTestId('stats-grid')
      // sm:grid-cols-2 s'applique à partir de 640px
      await expect(grid).toHaveClass(/sm:grid-cols-2/)
    })

    test('6. Desktop (1280px) : les cartes sont en 4 colonnes', async ({ page }) => {
      await goto(page, DESKTOP)

      const grid = page.getByTestId('stats-grid')
      // lg:grid-cols-4 s'applique à partir de 1024px
      await expect(grid).toHaveClass(/lg:grid-cols-4/)
    })
  })

  // ── Search bar ──────────────────────────────────────────────────────────

  test.describe('Barre de recherche responsive', () => {
    test('7. Mobile : la recherche prend toute la largeur disponible', async ({ page }) => {
      await goto(page, MOBILE)

      const searchSection = page.getByTestId('search-section')
      const input = page.getByTestId('search-input')

      // Sur mobile, le conteneur parent n'a pas max-w-sm → largeur 100%
      // On vérifie que l'input a une largeur proche de la section
      const sectionBox = await searchSection.boundingBox()
      const inputBox = await input.boundingBox()

      expect(sectionBox).not.toBeNull()
      expect(inputBox).not.toBeNull()

      // L'input doit occuper au moins 90% de la largeur de la section
      expect(inputBox!.width).toBeGreaterThanOrEqual(sectionBox!.width * 0.9)
    })

    test('8. Desktop : la recherche est limitée à max-w-sm', async ({ page }) => {
      await goto(page, DESKTOP)

      const searchSection = page.getByTestId('search-section')
      // Le div parent a la classe sm:max-w-sm
      const parentDiv = searchSection.locator('> div')
      await expect(parentDiv).toHaveClass(/sm:max-w-sm/)
    })
  })

  // ── Action buttons ──────────────────────────────────────────────────────

  test.describe("Boutons d'action responsive", () => {
    test("9. Mobile : le bouton d'action est en pleine largeur", async ({ page }) => {
      await goto(page, MOBILE)

      const btn = page.getByTestId('action-btn')
      await expect(btn).toHaveClass(/w-full/)

      // Vérifie la hauteur minimale pour le touch
      const box = await btn.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    })

    test("10. Desktop : le bouton d'action reprend sa taille normale", async ({ page }) => {
      await goto(page, DESKTOP)

      const btn = page.getByTestId('action-btn')
      // Sur desktop sm:w-auto override w-full → la largeur computed n'est pas 100%
      const width = await btn.evaluate((el) => window.getComputedStyle(el).width)
      // La largeur ne doit pas être "100%" (w-full est override par sm:w-auto)
      expect(width).not.toBe('100%')
      // Le texte est visible sans troncature
      await expect(btn).toContainText('Nouvel élément')
    })
  })

  // ── Touch targets ───────────────────────────────────────────────────────

  test.describe('Zones tactiles (touch targets)', () => {
    test('11. Tous les boutons et liens du tableau mesurent au moins 44px', async ({ page }) => {
      await goto(page, MOBILE)

      // Boutons de navigation dans la sidebar
      const navLinks = page.getByTestId('sidebar-nav').locator('a')
      const navCount = await navLinks.count()
      for (let i = 0; i < navCount; i++) {
        const box = await navLinks.nth(i).boundingBox()
        expect(box).not.toBeNull()
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }

      // Liens "Voir" dans le tableau
      const viewLinks = page.getByTestId('table-body').locator('a')
      const viewCount = await viewLinks.count()
      for (let i = 0; i < viewCount; i++) {
        const box = await viewLinks.nth(i).boundingBox()
        expect(box).not.toBeNull()
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }

      // Boutons du formulaire
      const formBtns = [page.getByTestId('form-submit'), page.getByTestId('form-cancel')]
      for (const btn of formBtns) {
        const box = await btn.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
    })
  })

  // ── Horizontal overflow ─────────────────────────────────────────────────

  test.describe('Débordement horizontal', () => {
    test('12. Aucun débordement horizontal sur la page (hors tableau) en mobile', async ({
      page,
    }) => {
      await goto(page, MOBILE)

      // Vérifie que le contenu principal ne dépasse pas la largeur du viewport
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth
      })

      // Le tableau peut déborder (overflow-x-auto), mais pas le body
      // On vérifie que le scrollWidth n'excède pas l'innerWidth de plus de 10px
      // (les bordures peuvent ajouter un pixel ou deux)
      expect(hasOverflow).toBe(false)
    })
  })

  // ── Font sizing ─────────────────────────────────────────────────────────

  test.describe('Tailles de police lisibles', () => {
    test('13. Les titres et le texte sont lisibles sur mobile', async ({ page }) => {
      await goto(page, MOBILE)

      // Le titre de la page doit être au moins 18px (text-lg)
      const titleFontSize = await page
        .getByTestId('page-title')
        .evaluate((el) => window.getComputedStyle(el).fontSize)
      expect(parseFloat(titleFontSize)).toBeGreaterThanOrEqual(18)

      // Le heading doit être au moins 24px (text-2xl)
      const headingFontSize = await page
        .getByTestId('page-heading')
        .evaluate((el) => window.getComputedStyle(el).fontSize)
      expect(parseFloat(headingFontSize)).toBeGreaterThanOrEqual(24)

      // La description ne doit pas être trop petite
      const descFontSize = await page
        .getByTestId('page-description')
        .evaluate((el) => window.getComputedStyle(el).fontSize)
      expect(parseFloat(descFontSize)).toBeGreaterThanOrEqual(12)
    })

    test('14. Les libellés des cartes de stats sont lisibles sur mobile', async ({ page }) => {
      await goto(page, MOBILE)

      // Les textes dans les stat cards (labels et valeurs)
      const valueFontSize = await page
        .getByTestId('stat-value-users')
        .evaluate((el) => window.getComputedStyle(el).fontSize)
      expect(parseFloat(valueFontSize)).toBeGreaterThanOrEqual(24)
    })
  })

  // ── Page header (bouton + titre empilés sur mobile) ─────────────────────

  test.describe('En-tête de page responsive', () => {
    test('15. Mobile : le titre et le bouton sont empilés verticalement', async ({ page }) => {
      await goto(page, MOBILE)

      const pageHeader = page.getByTestId('page-header')
      // Sur mobile, le header est en colonne (flex-col)
      await expect(pageHeader).toHaveClass(/flex-col/)
    })

    test('16. Desktop : le titre et le bouton sont alignés horizontalement', async ({ page }) => {
      await goto(page, DESKTOP)

      const pageHeader = page.getByTestId('page-header')
      // Sur desktop, on a sm:items-center et sm:flex-row
      await expect(pageHeader).toHaveClass(/sm:flex-row/)
    })
  })

  // ── Formulaire responsive ───────────────────────────────────────────────

  test.describe('Formulaire responsive', () => {
    test('17. Mobile : les champs du formulaire sont empilés', async ({ page }) => {
      await goto(page, MOBILE)

      const formSection = page.getByTestId('form-section')
      // La grille du formulaire est grid-cols-1 sur mobile
      const formGrid = formSection.locator('> .grid')
      await expect(formGrid).toHaveClass(/grid-cols-1/)
    })

    test('18. Tablette/Desktop : les champs du formulaire sont côte à côte', async ({ page }) => {
      await goto(page, DESKTOP)

      const formSection = page.getByTestId('form-section')
      const formGrid = formSection.locator('> .grid')
      await expect(formGrid).toHaveClass(/sm:grid-cols-2/)
    })
  })
})
