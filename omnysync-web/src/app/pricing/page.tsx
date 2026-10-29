import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProCheckoutButton } from '@/components/pro-checkout-button'
import Link from 'next/link'
import { getT } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    titleKey: 'META_PRICING_TITLE',
    descriptionKey: 'META_PRICING_DESC',
    path: '/pricing',
  })
}

type PlanCard = {
  nameKey: string
  priceKey: string
  periodKey?: string
  descriptionKey: string
  ctaKey: string
  href: string
  priceIsCustom?: boolean
}

export default async function PricingPage() {
  const t = await getT()

  const plans: PlanCard[] = [
    {
      nameKey: 'plan_pro_name',
      priceKey: 'plan_pro_price',
      periodKey: 'plan_pro_period',
      descriptionKey: 'plan_pro_description',
      ctaKey: 'cta_upgrade_pro',
      href: '/api/stripe/checkout',
    },
    {
      nameKey: 'plan_free_name',
      priceKey: 'plan_free_price',
      periodKey: 'plan_free_period',
      descriptionKey: 'plan_free_description',
      ctaKey: 'cta_start_free',
      href: '/auth/signin',
    },
    {
      nameKey: 'plan_business_name',
      priceKey: 'plan_business_price',
      descriptionKey: 'plan_business_description',
      ctaKey: 'cta_contact_sales',
      href: 'mailto:sales@omnysync.com',
      priceIsCustom: true,
    },
  ]

  const comparisonRows = [
    {
      labelKey: 'compare_syncs',
      values: [t('plan_pro_feature_1'), t('plan_free_feature_1'), t('plan_business_feature_1')],
    },
    {
      labelKey: 'compare_connectors',
      values: [t('plan_pro_feature_2'), t('plan_free_feature_2'), t('plan_business_feature_2')],
    },
    {
      labelKey: 'compare_documents',
      values: [t('plan_pro_feature_3'), t('plan_free_feature_3'), t('plan_business_feature_3')],
    },
    {
      labelKey: 'compare_scheduled',
      values: [t('plan_pro_feature_4'), '—', t('plan_pro_feature_4')],
    },
    {
      labelKey: 'compare_team',
      values: ['—', '—', t('plan_business_feature_4')],
    },
    {
      labelKey: 'compare_support',
      values: [t('plan_pro_feature_6'), t('plan_free_feature_4'), t('plan_business_feature_5')],
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1200px] px-6 pb-20 pt-28">
        {/* Header */}
        <div className="animate-enter-up flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              02 / Plans
            </p>
            <h1 className="mt-3 text-[clamp(2.25rem,4.5vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
              {t('pricing_title')}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
              {t('pricing_subtitle')}
            </p>
          </div>
          <p className="max-w-xs font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
            {t('pricing_note_1')}
            <br />
            {t('pricing_note_2')}
          </p>
        </div>

        {/* Matrix heading: the table itself stays a pure spec sheet. */}
        <div className="mt-14 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              {t('pricing_matrix_eyebrow')}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {t('pricing_matrix_title')}
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t('pricing_matrix_subtitle')}
          </p>
        </div>

        {/* Plan matrix: one spec sheet, with Pro as the signal column. */}
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground lg:hidden">
          {t('pricing_matrix_hint')}
        </p>
        <div className="mt-6 overflow-x-auto border border-border bg-card lg:mt-6">
          <table
            className="w-full min-w-[820px] border-separate border-spacing-0 text-left"
            aria-label={t('pricing_matrix_title')}
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-[132px] border-b border-border bg-card px-3 py-5 align-top sm:w-[190px] sm:px-5 lg:w-[24%]"
                >
                  <div className="flex h-full min-h-[230px] flex-col justify-between gap-8">
                    <span className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
                      {t('pricing_matrix_label')}
                    </span>
                    <div
                      aria-hidden="true"
                      className="relative flex flex-1 items-center justify-between py-6"
                    >
                      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                      <span className="relative size-1.5 bg-primary" />
                      <span className="relative size-1.5 border border-border bg-card" />
                      <span className="relative size-1.5 border border-border bg-card" />
                    </div>
                    <span className="font-mono text-[8px] uppercase leading-relaxed tracking-[0.1em] text-muted-foreground/60">
                      {t('pricing_matrix_meta')}
                    </span>
                  </div>
                </th>
                {plans.map((plan, index) => {
                  const isPro = index === 0
                  return (
                    <th
                      key={plan.nameKey}
                      scope="col"
                      className={
                        isPro
                          ? 'relative border-b border-l border-sidebar-border bg-sidebar px-5 py-5 align-top text-sidebar-foreground'
                          : 'border-b border-l border-border px-5 py-5 align-top'
                      }
                    >
                      {isPro && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 top-0 h-0.5 bg-primary"
                        />
                      )}
                      <div className="flex h-full flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-sm font-semibold tracking-tight">
                            {t(plan.nameKey)}
                          </h2>
                          {isPro && (
                            <span className="rounded-[3px] bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                              {t('popular_badge')}
                            </span>
                          )}
                        </div>
                        <p
                          className={
                            isPro
                              ? 'mt-1 min-h-9 text-[12px] leading-relaxed text-sidebar-foreground/50'
                              : 'mt-1 min-h-9 text-[12px] leading-relaxed text-muted-foreground'
                          }
                        >
                          {t(plan.descriptionKey)}
                        </p>
                        <div className="mt-6 flex items-baseline gap-1">
                          <span className="text-4xl font-semibold tracking-[-0.04em] tabular-nums">
                            {t(plan.priceKey)}
                          </span>
                          {!plan.priceIsCustom && plan.periodKey ? (
                            <span
                              className={
                                isPro
                                  ? 'text-[11px] text-sidebar-foreground/45'
                                  : 'text-[11px] text-muted-foreground'
                              }
                            >
                              /{t(plan.periodKey)}
                            </span>
                          ) : null}
                        </div>
                        {isPro && (
                          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-sidebar-primary">
                            {t('pricing_pro_meta')}
                          </p>
                        )}
                        <div className="mt-auto pt-6">
                          {plan.href.startsWith('/api') ? (
                            <ProCheckoutButton label={t(plan.ctaKey)} className="h-10" />
                          ) : (
                            <Button asChild variant="outline" size="lg" className="w-full">
                              <Link href={plan.href}>
                                {t(plan.ctaKey)}
                                {!plan.href.startsWith('/api') && (
                                  <ArrowRight className="size-4" aria-hidden="true" />
                                )}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.labelKey}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-t border-border bg-card px-3 py-3.5 text-left text-[12px] font-medium text-foreground sm:px-5"
                  >
                    {t(row.labelKey)}
                  </th>
                  {row.values.map((value, index) => {
                    const isPro = index === 0
                    return (
                      <td
                        key={`${row.labelKey}-${index}`}
                        className={
                          isPro
                            ? 'border-l border-t border-sidebar-border bg-sidebar px-5 py-3.5 align-top text-[12px] leading-relaxed text-sidebar-foreground/75'
                            : 'border-l border-t border-border px-5 py-3.5 align-top text-[12px] leading-relaxed text-muted-foreground'
                        }
                      >
                        {value === '—' ? (
                          <span
                            className={
                              isPro ? 'text-sidebar-foreground/25' : 'text-muted-foreground/40'
                            }
                          >
                            {value}
                          </span>
                        ) : (
                          value
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Fine print: the matrix already carries the decision. */}
        <div className="animate-enter-fade mt-10 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-start sm:justify-between">
          <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
            {t('pricing_note_1')} {t('pricing_note_2')}
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-right">
            {t('pricing_footer_note')}
          </p>
        </div>
      </div>
    </div>
  )
}
