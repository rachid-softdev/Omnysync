/**
 * generate-demo-video.ts — real-product demo capture for the Omnysync landing page.
 *
 * Records the actual Omnysync UI (dashboard, connectors, documents, sync wizard,
 * analytics) with seeded demo data, a fake cursor and burned-in captions, then
 * renders a 1280x720 H.264 MP4 + a WebP poster. English and French variants are
 * produced by changing DEMO_LANG.
 *
 * Usage (from omnysync-web/, dev server running on :3000):
 *   pnpm demo:video                 # EN  -> public/demo.mp4 + demo-poster-en.webp
 *   $env:DEMO_LANG="fr"; pnpm demo:video   # FR -> public/demo-fr.mp4 + demo-poster-fr.webp
 *
 * Env:
 *   DEMO_LANG        en | fr                       (default en)
 *   DEMO_BASE_URL    override target URL           (default http://localhost:3000)
 *   DEMO_OUT_DIR     render directory              (default ./demo-render)
 *   DEMO_SPEED       1 = real time, >1 speeds pauses up
 *   DEMO_SKIP_SEED  1 = keep the existing demo data
 *   DEMO_SKIP_RENDER 1 = keep the raw webm, skip ffmpeg
 *   DEMO_SKIP_WEB   1 = reuse an existing raw webm (debug)
 *
 * Only the isolated org with slug "omnysync-demo" is touched in the local DB.
 */

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { config as loadEnv } from 'dotenv'
import { hash } from 'bcrypt'

// ─── Configuration ──────────────────────────────────────────────────────────

loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true })
loadEnv({ path: resolve(process.cwd(), '.env') })

const LANG: 'en' | 'fr' = (process.env.DEMO_LANG ?? 'en').toLowerCase().startsWith('fr')
  ? 'fr'
  : 'en'
const BASE_URL = (process.env.DEMO_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const OUT_DIR = resolve(process.cwd(), process.env.DEMO_OUT_DIR ?? 'demo-render')
const RAW_DIR = join(OUT_DIR, 'raw')
const FRAMES_DIR = join(OUT_DIR, 'frames')
const PUBLIC_DIR = resolve(process.cwd(), 'public')
const SKIP_SEED = process.env.DEMO_SKIP_SEED === '1'
const SKIP_RENDER = process.env.DEMO_SKIP_RENDER === '1'
const SKIP_WEB = process.env.DEMO_SKIP_WEB === '1'
const SPEED = Math.max(1, Number(process.env.DEMO_SPEED ?? '1') || 1)
const VIEWPORT = { width: 1600, height: 900 }
const LOCALE = LANG === 'fr' ? 'fr-FR' : 'en-US'
const ACCEPT_LANGUAGE = LANG === 'fr' ? 'fr-FR,fr;q=0.9' : 'en-US,en;q=0.9'
const DEMO_EMAIL = 'demo@omnysync.app'
const DEMO_PASSWORD = 'demo-password-123'

const t0 = Date.now()
const log = (msg: string): void => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`)
const hold = (page: Page, ms: number): Promise<void> => page.waitForTimeout(Math.round(ms / SPEED))

// ─── Localized copy ─────────────────────────────────────────────────────────

const DICT = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/lib/i18n', `${LANG}.json`), 'utf8')
) as Record<string, string>
const tr = (key: string): string => DICT[key] ?? key

const COPY = {
  en: {
    userName: 'Alex Morgan',
    titles: [
      'The 2026 Content Operations Playbook',
      'How We Cut Publishing Time by 80%',
      'Product Update: Two-Way Sync',
      'SEO Checklist for Multi-Site Teams',
      'Customer Story: Northwind Studio',
      'The Complete Guide to Headless CMS',
      'Weekly Editorial Digest',
      'Why Content Consistency Wins',
    ],
    captions: {
      dashboard: 'All your content, in sync.',
      connectors: 'Connect the tools you already use.',
      documents: 'One draft, every platform, live status.',
      wizardPick: 'Pick a source, a destination and AI enrichment.',
      wizardRun: 'Omnysync does the rest.',
      analytics: 'Track every sync and connector.',
    },
    wizardLogs: [
      { status: 'INFO', message: 'Content fetched from Google Docs' },
      { status: 'SUCCESS', message: 'SEO title and meta description generated' },
      { status: 'SUCCESS', message: '3 images optimized' },
      { status: 'SUCCESS', message: 'Published to WordPress' },
      { status: 'SUCCESS', message: 'Synced to Ghost · tags mapped' },
      { status: 'SUCCESS', message: 'Webflow CMS fields mapped' },
    ],
    historyMessages: [
      'Published to WordPress · 3 images optimized',
      'Synced to Ghost · tags mapped',
      'Webflow CMS fields mapped',
      'Shopify product updated',
      'Retry scheduled after timeout',
      'SEO metadata generated',
    ],
    endTagline: 'Your content, everywhere.',
  },
  fr: {
    userName: 'Camille Laurent',
    titles: [
      'Le playbook des opérations de contenu 2026',
      'Comment réduire le temps de publication de 80 %',
      'Nouveauté produit : synchronisation bidirectionnelle',
      'Checklist SEO pour les équipes multi-sites',
      'Témoignage client : Northwind Studio',
      'Le guide complet du CMS headless',
      'Récapitulatif éditorial hebdomadaire',
      'Pourquoi la cohérence de contenu gagne',
    ],
    captions: {
      dashboard: 'Tout votre contenu, synchronisé.',
      connectors: 'Connectez les outils que vous utilisez déjà.',
      documents: 'Un brouillon, toutes les plateformes, statut en direct.',
      wizardPick: 'Choisissez une source, une destination et l’enrichissement IA.',
      wizardRun: 'Omnysync s’occupe du reste.',
      analytics: 'Suivez chaque synchronisation et chaque connecteur.',
    },
    wizardLogs: [
      { status: 'INFO', message: 'Contenu récupéré depuis Google Docs' },
      { status: 'SUCCESS', message: 'Titre et méta-description SEO générés' },
      { status: 'SUCCESS', message: '3 images optimisées' },
      { status: 'SUCCESS', message: 'Publié sur WordPress' },
      { status: 'SUCCESS', message: 'Synchronisé sur Ghost · tags mappés' },
      { status: 'SUCCESS', message: 'Champs CMS Webflow mappés' },
    ],
    historyMessages: [
      'Publié sur WordPress · 3 images optimisées',
      'Synchronisé sur Ghost · tags mappés',
      'Champs CMS Webflow mappés',
      'Produit Shopify mis à jour',
      'Nouvel essai planifié après timeout',
      'Métadonnées SEO générées',
    ],
    endTagline: 'Votre contenu, partout.',
  },
} as const

const C = COPY[LANG]

// ─── Seed ───────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  if (SKIP_SEED) {
    log('seed skipped (DEMO_SKIP_SEED=1)')
    return
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data in production.')
  }
  const dbUrl = process.env.DATABASE_URL ?? ''
  if (!/localhost|127\.0\.0\.1/.test(dbUrl)) {
    throw new Error(`Refusing to seed a non-local database: ${dbUrl}`)
  }

  // The web tsconfig maps `@prisma/client` to the generated client's type
  // definitions (Next resolves it at build time), which tsx cannot execute.
  // Build the client explicitly: the generated client from this package plus
  // the pg driver adapter resolved through @omnysync/core's dependencies.
  const webRequire = createRequire(join(process.cwd(), 'package.json'))
  const coreRequire = createRequire(webRequire.resolve('@omnysync/core'))
  const { PrismaPg } = coreRequire('@prisma/adapter-pg') as {
    PrismaPg: new (pool: unknown) => unknown
  }
  const pg = coreRequire('pg') as {
    Pool: new (options: { connectionString: string }) => { end: () => Promise<void> }
  }
  const { PrismaClient } = webRequire(join(process.cwd(), 'prisma', 'generated', 'client')) as {
    PrismaClient: new (options: { adapter: unknown }) => Record<string, any> & {
      $disconnect: () => Promise<void>
    }
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? '' })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    log('seeding demo data…')
    await prisma.organization.deleteMany({ where: { slug: 'omnysync-demo' } })

    const password = await hash(DEMO_PASSWORD, 12)
    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: { name: C.userName, password, role: 'USER', disabledAt: null, deletedAt: null },
      create: { email: DEMO_EMAIL, name: C.userName, password, role: 'USER' },
    })

    const org = await prisma.organization.create({
      data: { name: 'Northwind Studio', slug: 'omnysync-demo', lastSyncAt: new Date() },
    })
    await prisma.userOrganization.create({
      data: { userId: user.id, organizationId: org.id, role: 'OWNER' },
    })

    const connectorDefs = [
      { type: 'GOOGLE_DOCS', name: 'Google Docs' },
      { type: 'NOTION', name: 'Notion' },
      { type: 'WORDPRESS', name: 'WordPress' },
      { type: 'GHOST', name: 'Ghost' },
      { type: 'WEBFLOW', name: 'Webflow' },
      { type: 'SHOPIFY', name: 'Shopify' },
    ] as const
    const connectors: Record<string, string> = {}
    for (const def of connectorDefs) {
      const created = await prisma.connector.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          type: def.type,
          name: def.name,
          status: 'ACTIVE',
        },
      })
      connectors[def.type] = created.id
    }

    const destTypes = ['WORDPRESS', 'GHOST', 'WEBFLOW', 'SHOPIFY'] as const
    const syncStatuses = [
      'SYNCED',
      'SYNCED',
      'SYNCED',
      'SYNCED',
      'SYNCED',
      'SYNCED',
      'SYNCING',
      'FAILED',
    ] as const
    const now = Date.now()
    const docIds: string[] = []
    for (let i = 0; i < C.titles.length; i++) {
      const title = C.titles[i]
      const syncStatus = syncStatuses[i] ?? 'SYNCED'
      const lastSyncedAt = syncStatus === 'SYNCED' ? new Date(now - i * 0.7 * 86_400_000) : null
      const doc = await prisma.document.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          sourceConnectorId: connectors.GOOGLE_DOCS,
          destConnectorId: connectors[destTypes[i % destTypes.length]],
          title,
          slug: title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 60),
          content: `${title}\n\nA practical guide for content teams publishing across multiple platforms.`,
          excerpt: `A practical guide for content teams publishing across multiple platforms.`,
          status: 'PUBLISHED',
          syncStatus,
          lastSyncedAt,
          publishedAt: lastSyncedAt,
          lastSyncError:
            syncStatus === 'FAILED' ? 'WordPress returned 503 (Service Unavailable)' : null,
          seoTitle: title,
          seoDescription: `How content teams ship faster with Omnysync: ${title}.`,
          seoKeywords: [],
          tags: ['content', 'sync', 'seo'],
          categories: ['Marketing'],
          author: C.userName,
          version: 1,
          autoSyncEnabled: false,
          syncFrequency: 'MANUAL',
        },
      })
      docIds.push(doc.id)
    }

    const logStatuses = [
      'SUCCESS',
      'SUCCESS',
      'SUCCESS',
      'SUCCESS',
      'SUCCESS',
      'INFO',
      'WARNING',
      'ERROR',
    ] as const
    for (let i = 0; i < 35; i++) {
      const status = logStatuses[i % logStatuses.length]
      await prisma.syncLog.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          documentId: docIds[i % docIds.length],
          action: status === 'ERROR' ? 'sync.failed' : 'sync.completed',
          status,
          message: C.historyMessages[i % C.historyMessages.length],
          createdAt: new Date(now - (i % 7) * 86_400_000 - (i % 24) * 3_600_000),
        },
      })
    }

    log(`seed done: ${C.titles.length} documents, 6 connectors, 35 sync logs`)
  } finally {
    await prisma.$disconnect().catch(() => {})
    await pool.end().catch(() => {})
  }
}

// ─── Overlays (cursor + captions) ───────────────────────────────────────────

const OVERLAY_SCRIPT = String.raw`
(() => {
  if (window.__omnyDemo) return;
  const CSS = [
    '#omny-cursor { position: fixed; top: 0; left: 0; z-index: 2147483646; width: 22px; height: 22px; pointer-events: none; will-change: transform; filter: drop-shadow(0 1px 2px rgba(0,0,0,.3)); }',
    '#omny-cursor svg { display: block; }',
    '#omny-cursor .ring { position: absolute; left: -9px; top: -9px; width: 40px; height: 40px; border-radius: 999px; border: 2px solid rgba(0,100,224,.9); opacity: 0; transform: scale(.35); }',
    '#omny-cursor.clicking .ring { animation: omny-ring .5s ease-out; }',
    '@keyframes omny-ring { 0% { opacity: .9; transform: scale(.35); } 100% { opacity: 0; transform: scale(1.15); } }',
    '#omny-caption { position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%) translateY(10px); opacity: 0; transition: opacity .28s ease, transform .28s ease; background: rgba(10,15,20,.9); color: #fff; font: 500 21px/1.35 Inter, system-ui, -apple-system, sans-serif; padding: 12px 22px; border-radius: 999px; max-width: 80%; text-align: center; z-index: 2147483647; pointer-events: none; box-shadow: 0 8px 24px rgba(0,0,0,.18); }',
    '#omny-caption.visible { opacity: 1; transform: translateX(-50%) translateY(0); }',
    'nextjs-portal { display: none !important; }',
    '::-webkit-scrollbar { width: 0 !important; height: 0 !important; }',
    'html { scrollbar-width: none; }',
  ].join('\n');

  const mount = () => {
    if (window.__omnyDemo) return;
    const root = document.body || document.documentElement;
    if (!root) return;

    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = 'omny-cursor';
    cursor.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4.5 2.6 19.7 12.9c.9.6.45 2-.65 2h-6.05l-2.9 5.35c-.5.92-1.85.56-1.85-.5V3.6c0-1.08 1.28-1.7 2.05-1z" fill="#0a0f14" stroke="#ffffff" stroke-width="1.4"/></svg><span class="ring"></span>';
    root.appendChild(cursor);

    const caption = document.createElement('div');
    caption.id = 'omny-caption';
    root.appendChild(caption);

    window.__omnyDemo = {
      moveTo(x, y, duration) {
        cursor.style.transition = 'transform ' + duration + 'ms cubic-bezier(.22,.61,.36,1)';
        cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      },
      click() {
        cursor.classList.add('clicking');
        setTimeout(() => cursor.classList.remove('clicking'), 520);
      },
      caption(text) {
        caption.textContent = text;
        caption.classList.add('visible');
      },
      hideCaption() {
        caption.classList.remove('visible');
      },
      hide() {
        cursor.style.display = 'none';
        caption.style.display = 'none';
      },
    };
  };

  if (document.documentElement) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  }
})();
`

// ─── Browser helpers ────────────────────────────────────────────────────────

async function checkServer(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(BASE_URL, { method: 'HEAD' })
      if (res.status < 500) return
    } catch {
      // keep waiting
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(`Dev server not reachable at ${BASE_URL}. Start it first: pnpm dev`)
}

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>

async function signInAndWarm(browser: Browser): Promise<StorageState> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: LOCALE,
    colorScheme: 'light',
    extraHTTPHeaders: { 'Accept-Language': ACCEPT_LANGUAGE },
  })
  const page = await context.newPage()

  log('signing in as demo user…')
  await page.goto(`${BASE_URL}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 240_000 })
  // Give React a moment to hydrate; the retry loop below covers the rest.
  await hold(page, 1500)
  await page.getByLabel('Email').fill(DEMO_EMAIL)
  await page.getByLabel('Password').fill(DEMO_PASSWORD)

  let signedIn = false
  for (let attempt = 0; attempt < 5 && !signedIn; attempt++) {
    await page.getByRole('button', { name: 'Sign in' }).click()
    signedIn = await page
      .waitForURL('**/dashboard', { timeout: 8_000 })
      .then(() => true)
      .catch(() => false)
    if (!signedIn) {
      await hold(page, 1000)
      await page
        .getByLabel('Email')
        .fill(DEMO_EMAIL)
        .catch(() => {})
      await page
        .getByLabel('Password')
        .fill(DEMO_PASSWORD)
        .catch(() => {})
    }
  }
  if (!signedIn) {
    throw new Error('Sign-in failed after 4 attempts')
  }
  log('signed in')

  const routes = [
    '/',
    '/dashboard',
    '/dashboard/documents',
    '/dashboard/connectors',
    '/dashboard/sync/new',
    '/dashboard/analytics',
  ]
  for (const route of routes) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 240_000 })
      await page.waitForTimeout(400)
      log(`warm-up ok: ${route}`)
    } catch (err) {
      log(`warm-up miss: ${route} — ${String(err).slice(0, 160)}`)
    }
  }

  const state = await context.storageState()
  await context.close()
  return state
}

async function installMocks(page: Page): Promise<void> {
  await page.route('**/api/connectors/*/documents', (route) => {
    const docs = C.titles.slice(0, 3).map((title, i) => ({ id: `doc-${i + 1}`, title }))
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(docs),
    })
  })

  await page.route('**/api/sync**', (route) => {
    const url = route.request().url()
    if (url.includes('demo-sync-doc')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'demo-sync-doc',
          title: C.titles[0],
          syncStatus: 'SYNCED',
          logs: C.wizardLogs,
        }),
      })
    }
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'demo-sync-doc', title: C.titles[0], syncStatus: 'NOT_SYNCED' }),
      })
    }
    return route.continue()
  })
}

async function glideXY(page: Page, x: number, y: number, duration = 420): Promise<void> {
  await page.evaluate(
    ({ x, y, duration }) =>
      (
        window as unknown as { __omnyDemo?: { moveTo: (x: number, y: number, d: number) => void } }
      ).__omnyDemo?.moveTo(x, y, duration),
    { x, y, duration }
  )
  await hold(page, duration + 80)
}

async function glideTo(page: Page, target: Locator, duration = 420): Promise<void> {
  const box = await target
    .first()
    .boundingBox()
    .catch(() => null)
  if (!box) return
  await glideXY(
    page,
    Math.round(box.x + box.width / 2),
    Math.round(box.y + box.height / 2),
    duration
  )
}

async function glideMain(
  page: Page,
  points: Array<[number, number]>,
  duration = 420
): Promise<void> {
  const box = await page
    .locator('main')
    .first()
    .boundingBox()
    .catch(() => null)
  if (!box) return
  for (const [fx, fy] of points) {
    await glideXY(
      page,
      Math.round(box.x + box.width * fx),
      Math.round(box.y + box.height * fy),
      duration
    )
  }
}

async function clickFx(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { __omnyDemo?: { click: () => void } }).__omnyDemo?.click()
  )
  await hold(page, 140)
}

async function caption(page: Page, text: string, ms = 3000): Promise<void> {
  await page.evaluate(
    (value) =>
      (window as unknown as { __omnyDemo?: { caption: (t: string) => void } }).__omnyDemo?.caption(
        value
      ),
    text
  )
  await hold(page, ms)
  await page.evaluate(() =>
    (window as unknown as { __omnyDemo?: { hideCaption: () => void } }).__omnyDemo?.hideCaption()
  )
  await hold(page, 120)
}

async function snap(page: Page, name: string): Promise<void> {
  try {
    await page.screenshot({ path: join(FRAMES_DIR, `${LANG}-${name}.png`) })
  } catch {
    // screenshots are best-effort
  }
}

// ─── Scenes ─────────────────────────────────────────────────────────────────

function endCard(): string {
  return `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><style>
    html, body { margin: 0; height: 100%; }
    body { display: grid; place-items: center; background: #ffffff; color: #16181d;
      font-family: Inter, -apple-system, 'Segoe UI', Roboto, system-ui, sans-serif; }
    .wrap { display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .mark { width: 88px; height: 88px; border-radius: 24px; background: #0064e0; color: #fff;
      display: grid; place-items: center; font-size: 44px; font-weight: 700;
      box-shadow: 0 20px 48px rgba(0, 100, 224, .28); }
    .word { font-size: 46px; font-weight: 700; letter-spacing: -.03em; }
    .tag { font-size: 23px; color: #5c6a79; }
    .url { font-size: 16px; font-weight: 600; color: #0064e0; letter-spacing: .02em; }
  </style></head><body>
    <div class="wrap">
      <div class="mark">O</div>
      <div class="word">Omnysync</div>
      <div class="tag">${C.endTagline}</div>
      <div class="url">omnysync.com</div>
    </div>
  </body></html>`
}

async function runWizard(page: Page): Promise<void> {
  const sourceTrigger = page.locator('#sync-source')
  await sourceTrigger.waitFor({ state: 'visible', timeout: 120_000 })
  await hold(page, 250)

  await glideTo(page, sourceTrigger)
  await clickFx(page)
  await sourceTrigger.click()
  const sourceOption = page.getByRole('option', { name: 'Google Docs' }).first()
  await sourceOption.waitFor({ state: 'visible', timeout: 15_000 })
  await glideTo(page, sourceOption, 300)
  await clickFx(page)
  await sourceOption.click()

  const continueButton = page.getByRole('button', { name: tr('UI_CONTINUE') })
  await continueButton.waitFor({ state: 'visible', timeout: 30_000 })
  await glideTo(page, continueButton)
  await clickFx(page)
  await continueButton.click()

  const docTrigger = page.locator('#sync-document')
  await docTrigger.waitFor({ state: 'visible', timeout: 30_000 })
  await hold(page, 200)
  await glideTo(page, docTrigger)
  await clickFx(page)
  await docTrigger.click()
  const docOption = page.getByRole('option', { name: C.titles[0] }).first()
  await docOption.waitFor({ state: 'visible', timeout: 15_000 })
  await glideTo(page, docOption, 300)
  await clickFx(page)
  await docOption.click()
  await page.getByRole('button', { name: tr('UI_CONTINUE') }).click()

  const destTrigger = page.locator('#sync-destination')
  await destTrigger.waitFor({ state: 'visible', timeout: 30_000 })
  await hold(page, 200)
  await glideTo(page, destTrigger)
  await clickFx(page)
  await destTrigger.click()
  const destOption = page.getByRole('option', { name: 'WordPress' }).first()
  await destOption.waitFor({ state: 'visible', timeout: 15_000 })
  await glideTo(page, destOption, 300)
  await clickFx(page)
  await destOption.click()
  await page.getByRole('button', { name: tr('UI_CONTINUE') }).click()

  const imagesCheckbox = page.locator('#images')
  await imagesCheckbox.waitFor({ state: 'visible', timeout: 30_000 })
  await hold(page, 250)
  await glideTo(page, imagesCheckbox)
  await clickFx(page)
  await imagesCheckbox.click()

  const startButton = page.getByRole('button', { name: tr('UI_START_SYNC') })
  await glideTo(page, startButton)
  await clickFx(page)
  await startButton.click()

  await page.getByText('Sync complete!').waitFor({ state: 'visible', timeout: 30_000 })
  await hold(page, 350)
  await glideMain(page, [
    [0.28, 0.5],
    [0.72, 0.42],
  ])
}

async function recordStoryboard(
  browser: Browser,
  storageState: StorageState
): Promise<{ rawPath: string; trimStart: number }> {
  mkdirSync(RAW_DIR, { recursive: true })
  mkdirSync(FRAMES_DIR, { recursive: true })

  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: RAW_DIR, size: VIEWPORT },
    locale: LOCALE,
    colorScheme: 'light',
    storageState,
    extraHTTPHeaders: { 'Accept-Language': ACCEPT_LANGUAGE },
  })
  await context.addInitScript({ content: OVERLAY_SCRIPT })

  // Warm the browser HTTP cache inside the recording context and prime every
  // dev route (chunks + SSR) so the recorded scenes never show a cold render.
  const warmPage = await context.newPage()
  try {
    for (const route of [
      '/dashboard',
      '/dashboard/documents',
      '/dashboard/connectors',
      '/dashboard/sync/new',
      '/dashboard/analytics',
    ]) {
      await warmPage.goto(`${BASE_URL}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 240_000,
      })
      await warmPage.locator('main').first().waitFor({ state: 'visible', timeout: 60_000 })
    }
  } catch {
    // best effort
  }
  await warmPage.close()

  const page = await context.newPage()
  const tStart = Date.now()

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  await installMocks(page)
  const video = page.video()

  // ── Scene 1: dashboard ────────────────────────────────────────────────────
  log('scene 1/6: dashboard')
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 240_000 })
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 120_000 })
  await page.evaluate(() => document.fonts.ready.then(() => true))
  await hold(page, 300)
  // Clean dashboard frame for the poster, cursor moved off-screen.
  const firstSceneAt = Math.max(0, (Date.now() - tStart) / 1000 - 0.4)
  await page.evaluate(() =>
    (
      window as unknown as { __omnyDemo?: { moveTo: (x: number, y: number, d: number) => void } }
    ).__omnyDemo?.moveTo(-120, -120, 0)
  )
  await snap(page, '0-poster')
  await glideMain(page, [[0.22, 0.24]], 420)
  await caption(page, C.captions.dashboard, 2200)
  await glideMain(page, [
    [0.5, 0.35],
    [0.55, 0.68],
  ])
  await snap(page, '1-dashboard')

  // ── Scene 2: connectors ───────────────────────────────────────────────────
  log('scene 2/6: connectors')
  await page.goto(`${BASE_URL}/dashboard/connectors`, {
    waitUntil: 'domcontentloaded',
    timeout: 240_000,
  })
  await page.getByText('Google Docs').first().waitFor({ state: 'visible', timeout: 60_000 })
  await hold(page, 250)
  await caption(page, C.captions.connectors, 1800)
  await glideMain(page, [
    [0.3, 0.38],
    [0.55, 0.62],
  ])
  await snap(page, '2-connectors')

  // ── Scene 3: documents ────────────────────────────────────────────────────
  log('scene 3/6: documents')
  await page.goto(`${BASE_URL}/dashboard/documents`, {
    waitUntil: 'domcontentloaded',
    timeout: 240_000,
  })
  await page.getByText(C.titles[0]).first().waitFor({ state: 'visible', timeout: 60_000 })
  await hold(page, 250)
  await caption(page, C.captions.documents, 2200)
  await glideMain(page, [
    [0.28, 0.42],
    [0.52, 0.64],
  ])
  await snap(page, '3-documents')

  // ── Scene 4: sync wizard ──────────────────────────────────────────────────
  log('scene 4/6: sync wizard')
  await page.goto(`${BASE_URL}/dashboard/sync/new`, {
    waitUntil: 'domcontentloaded',
    timeout: 240_000,
  })
  await caption(page, C.captions.wizardPick, 1600)
  await runWizard(page)
  await caption(page, C.captions.wizardRun, 1400)
  await snap(page, '4-wizard')

  // ── Scene 5: analytics ────────────────────────────────────────────────────
  log('scene 5/6: analytics')
  const analyticsResponse = page
    .waitForResponse((res) => res.url().includes('/api/analytics'), { timeout: 60_000 })
    .catch(() => null)
  await page.goto(`${BASE_URL}/dashboard/analytics`, {
    waitUntil: 'domcontentloaded',
    timeout: 240_000,
  })
  await analyticsResponse
  await hold(page, 400)
  await caption(page, C.captions.analytics, 2200)
  await glideMain(page, [
    [0.3, 0.32],
    [0.62, 0.58],
  ])
  await snap(page, '5-analytics')

  // ── Scene 6: end card ─────────────────────────────────────────────────────
  log('scene 6/6: end card')
  await page.setContent(endCard(), { waitUntil: 'load' })
  await page.evaluate(() =>
    (window as unknown as { __omnyDemo?: { hide: () => void } }).__omnyDemo?.hide()
  )
  await page.evaluate(() => document.fonts.ready.then(() => true))
  await hold(page, 3000)
  await snap(page, '6-end')

  await page.close()
  const rawPath = join(RAW_DIR, `omny-${LANG}.webm`)
  await video?.saveAs(rawPath)
  await context.close()
  writeFileSync(
    join(RAW_DIR, `trim-${LANG}.json`),
    JSON.stringify({ trimStart: firstSceneAt }, null, 2)
  )

  if (consoleErrors.length > 0) {
    log(`console errors during recording (${consoleErrors.length}):`)
    for (const err of consoleErrors.slice(0, 8)) log(`  - ${err.slice(0, 200)}`)
  }
  log(`load-in trims at ${firstSceneAt.toFixed(2)}s`)
  return { rawPath, trimStart: firstSceneAt }
}

// ─── Render ─────────────────────────────────────────────────────────────────

function ffmpeg(args: string[]): void {
  execFileSync('ffmpeg', args, { stdio: 'inherit' })
}

function renderMp4(rawWebm: string, outMp4: string, trimStart = 0): void {
  log('rendering 1280x720 H.264…')
  const args = ['-y']
  if (trimStart > 0.2) {
    log(`trimming ${trimStart.toFixed(2)}s of load-in`)
    args.push('-ss', trimStart.toFixed(2))
  }
  args.push(
    '-i',
    rawWebm,
    '-vf',
    'scale=1280:720:flags=lanczos',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-an',
    '-movflags',
    '+faststart',
    outMp4
  )
  ffmpeg(args)
}

function renderPoster(png: string, mp4: string, outWebp: string): void {
  log('extracting poster…')
  const args = existsSync(png)
    ? [
        '-y',
        '-i',
        png,
        '-vf',
        'scale=1280:720:flags=lanczos',
        '-frames:v',
        '1',
        '-c:v',
        'libwebp',
        '-quality',
        '82',
        outWebp,
      ]
    : [
        '-y',
        '-ss',
        '00:00:01.5',
        '-i',
        mp4,
        '-frames:v',
        '1',
        '-c:v',
        'libwebp',
        '-quality',
        '82',
        outWebp,
      ]
  ffmpeg(args)
}

function probe(file: string): string {
  return execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size',
    '-show_entries',
    'stream=width,height,codec_name',
    '-of',
    'default=noprint_wrappers=1',
    file,
  ]).toString()
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  await checkServer()
  await seed()

  const browser = await chromium.launch({
    args: ['--force-color-profile=srgb', '--hide-scrollbars'],
  })
  try {
    let rawWebm = join(RAW_DIR, `omny-${LANG}.webm`)
    let trimStart = 0
    const trimFile = join(RAW_DIR, `trim-${LANG}.json`)
    if (SKIP_WEB && existsSync(rawWebm)) {
      log(`reusing raw webm: ${rawWebm}`)
      if (existsSync(trimFile)) {
        try {
          trimStart = Number(JSON.parse(readFileSync(trimFile, 'utf8')).trimStart) || 0
        } catch {
          trimStart = 0
        }
      }
    } else {
      const state = await signInAndWarm(browser)
      const result = await recordStoryboard(browser, state)
      rawWebm = result.rawPath
      trimStart = result.trimStart
    }

    if (SKIP_RENDER) {
      log(`DEMO_SKIP_RENDER=1 — raw webm kept at ${rawWebm}`)
      return
    }

    const outMp4 = join(OUT_DIR, LANG === 'fr' ? 'demo-fr.mp4' : 'demo.mp4')
    const outPoster = join(OUT_DIR, LANG === 'fr' ? 'demo-poster-fr.webp' : 'demo-poster-en.webp')
    renderMp4(rawWebm, outMp4, trimStart)
    renderPoster(join(FRAMES_DIR, `${LANG}-0-poster.png`), outMp4, outPoster)

    const publicMp4 = join(PUBLIC_DIR, LANG === 'fr' ? 'demo-fr.mp4' : 'demo.mp4')
    const publicPoster = join(
      PUBLIC_DIR,
      LANG === 'fr' ? 'demo-poster-fr.webp' : 'demo-poster-en.webp'
    )
    copyFileSync(outMp4, publicMp4)
    copyFileSync(outPoster, publicPoster)

    log(`probe ${publicMp4}:`)
    log(probe(publicMp4).trim())
    const size = statSync(publicMp4).size
    log(`done (${LANG}): ${publicMp4} — ${(size / 1024 / 1024).toFixed(2)} MB + ${publicPoster}`)
    log(`screenshots for review: ${FRAMES_DIR}`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
