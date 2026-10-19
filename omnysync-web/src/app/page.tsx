import Link from 'next/link'
import {
  ArrowRight,
  Check,
  FileText,
  Globe,
  LayoutTemplate,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Workflow,
  Zap,
} from 'lucide-react'
import { getT } from '@/lib/i18n'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Omnysync — Your content, everywhere',
  description:
    'Write once, publish everywhere. Omnysync keeps WordPress, Ghost, Webflow and Shopify in sync from a single draft.',
}

const PLATFORMS = [
  { name: 'WordPress', icon: Globe },
  { name: 'Ghost', icon: LayoutTemplate },
  { name: 'Webflow', icon: Workflow },
  { name: 'Shopify', icon: ShoppingBag },
  { name: 'Notion', icon: FileText },
]

export default async function Home() {
  const t = await getT()

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-14">
        {/* Faint grid, clipped to the hero. Adds depth without decoration. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
        />

        <div className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center sm:pt-28">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs">
            <Sparkles className="size-3 text-primary" aria-hidden="true" />
            {t('hero_badge')}
          </p>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
            {t('hero_headline')} <span className="text-muted-foreground">{t('hero_tagline')}</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('hero_subtitle')}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              href="/auth/signin"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary-hover sm:w-auto"
            >
              {t('hero_cta_primary')}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-medium text-foreground shadow-2xs transition-colors duration-150 hover:bg-muted sm:w-auto"
            >
              {t('hero_cta_secondary')}
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">{t('hero_no_credit_card')}</p>
        </div>

        {/* Product mockup — built in HTML/CSS, no image asset. */}
        <div className="mx-auto max-w-5xl px-6 pb-20">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            {/* Window chrome */}
            <div className="flex h-10 items-center gap-2 border-b border-border bg-muted/50 px-3.5">
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <div className="mx-auto flex h-6 w-64 items-center justify-center rounded-md border border-border bg-background text-[10px] text-muted-foreground">
                app.omnysync.com/dashboard
              </div>
            </div>

            <div className="grid gap-0 sm:grid-cols-[190px_1fr]">
              {/* Sidebar */}
              <div className="hidden border-r border-border bg-sidebar p-3 sm:block">
                <div className="mb-4 flex items-center gap-2 px-1.5">
                  <span className="grid size-5 place-items-center rounded bg-primary text-[9px] font-bold text-primary-foreground">
                    O
                  </span>
                  <span className="text-xs font-semibold tracking-tight">Omnysync</span>
                </div>
                <div className="space-y-0.5">
                  {['Dashboard', 'Documents', 'Connectors', 'Synchronization', 'Analytics'].map(
                    (item, index) => (
                      <div
                        key={item}
                        className={`flex h-7 items-center gap-2 rounded-md px-2 text-[11px] ${
                          index === 0
                            ? 'bg-background font-medium text-foreground shadow-2xs'
                            : 'text-muted-foreground'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${index === 0 ? 'bg-primary' : 'bg-border-strong'}`}
                        />
                        {item}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Main panel */}
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[13px] font-semibold tracking-tight">Synchronization</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Launching an article to 4 destinations
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">
                    <span className="size-1.5 rounded-full bg-success" />
                    Live
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    { name: 'WordPress', detail: 'Published · hero image optimized', done: true },
                    { name: 'Ghost', detail: 'Published · tags mapped', done: true },
                    { name: 'Webflow', detail: 'Published · CMS fields mapped', done: true },
                    { name: 'Shopify', detail: 'Publishing · 62%', done: false },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-full ${
                          row.done ? 'bg-success-soft text-success' : 'bg-info-soft text-info'
                        }`}
                      >
                        {row.done ? (
                          <Check className="size-3" aria-hidden="true" />
                        ) : (
                          <RefreshCw className="size-3 animate-spin" aria-hidden="true" />
                        )}
                      </span>
                      <span className="text-[11px] font-medium">{row.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {row.detail}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Sync rate', value: '98%' },
                    { label: 'Documents', value: '142' },
                    { label: 'Time saved', value: '6.4h' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-border bg-muted/40 p-2.5"
                    >
                      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform strip ──────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-8 sm:flex-row sm:justify-between">
          <p className="text-xs font-medium text-muted-foreground">{t('hero_platforms')}</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {PLATFORMS.map((platform) => (
              <li
                key={platform.name}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
              >
                <platform.icon className="size-4" aria-hidden="true" />
                {platform.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('features_title')}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {t('features_subtitle')}
            </p>
          </div>

          {/* Asymmetric: one dominant card + two stacked supporting cards. */}
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-7 shadow-sm">
              <div>
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <RefreshCw className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  {t('feature_two_way_title')}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t('feature_two_way_desc')}
                </p>
              </div>

              {/* Directional diagram: both directions, so the card earns its space. */}
              <div className="mt-7 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium shadow-2xs">
                    Google Docs
                  </span>
                  <span
                    className="flex-1 border-t border-dashed border-border-strong"
                    aria-hidden="true"
                  />
                  <ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span
                    className="flex-1 border-t border-dashed border-border-strong"
                    aria-hidden="true"
                  />
                  <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium shadow-2xs">
                    WordPress
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium shadow-2xs">
                    WordPress
                  </span>
                  <span
                    className="flex-1 border-t border-dashed border-border-strong"
                    aria-hidden="true"
                  />
                  <ArrowRight
                    className="size-3.5 shrink-0 rotate-180 text-primary"
                    aria-hidden="true"
                  />
                  <span
                    className="flex-1 border-t border-dashed border-border-strong"
                    aria-hidden="true"
                  />
                  <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium shadow-2xs">
                    Google Docs
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {[
                {
                  icon: Zap,
                  titleKey: 'feature_analytics_title',
                  descKey: 'feature_analytics_desc',
                },
                {
                  icon: Workflow,
                  titleKey: 'feature_scheduling_title',
                  descKey: 'feature_scheduling_desc',
                },
              ].map((feature) => (
                <div
                  key={feature.titleKey}
                  className="rounded-xl border border-border bg-card p-6 shadow-sm"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <feature.icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3.5 text-base font-semibold tracking-tight">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t(feature.descKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-border bg-muted/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('how_it_works_title')}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">{t('how_it_works_subtitle')}</p>
          </div>

          {/* Numbered rail — one connected flow, not three detached cards. */}
          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-0">
            {[
              { titleKey: 'step_1_title', descKey: 'step_1_desc' },
              { titleKey: 'step_2_title', descKey: 'step_2_desc' },
              { titleKey: 'step_3_title', descKey: 'step_3_desc' },
            ].map((step, index) => (
              <li key={step.titleKey} className="relative sm:pr-8">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card text-[13px] font-semibold text-foreground shadow-2xs">
                    {index + 1}
                  </span>
                  {index < 2 && (
                    <span className="hidden h-px flex-1 bg-border sm:block" aria-hidden="true" />
                  )}
                </div>
                <h3 className="mt-3.5 text-base font-semibold tracking-tight">
                  {t(step.titleKey)}
                </h3>
                <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {t(step.descKey)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card px-8 py-12 text-center shadow-sm">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,var(--accent),transparent)]"
            />
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {t('cta_section_title')}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {t('cta_section_subtitle')}
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <Link
                  href="/auth/signin"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-xs transition-colors duration-150 hover:bg-primary-hover sm:w-auto"
                >
                  {t('cta_final_button')}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex h-10 w-full items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-medium text-foreground shadow-2xs transition-colors duration-150 hover:bg-muted sm:w-auto"
                >
                  {t('nav_pricing')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              O
            </span>
            <span className="text-sm font-semibold tracking-tight">Omnysync</span>
          </div>
          <nav
            className="flex items-center gap-5 text-sm text-muted-foreground"
            aria-label="Footer"
          >
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              {t('nav_pricing')}
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              {t('footer_privacy')}
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              {t('footer_terms')}
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">{t('footer_copyright')}</p>
        </div>
      </footer>
    </div>
  )
}
