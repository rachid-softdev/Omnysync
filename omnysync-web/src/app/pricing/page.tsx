import { Check, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProCheckoutButton } from '@/components/pro-checkout-button'
import Link from 'next/link'
import { getT } from '@/lib/i18n'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Choose the perfect plan for your content sync needs. Start free, scale as you grow.',
}

export default async function PricingPage() {
  const t = await getT()

  const plans = [
    {
      nameKey: 'plan_free_name',
      priceKey: 'plan_free_price',
      periodKey: 'plan_free_period',
      descriptionKey: 'plan_free_description',
      features: [
        'plan_free_feature_1',
        'plan_free_feature_2',
        'plan_free_feature_3',
        'plan_free_feature_4',
        'plan_free_feature_5',
      ],
      ctaKey: 'cta_start_free',
      href: '/auth/signin',
      highlighted: false,
    },
    {
      nameKey: 'plan_pro_name',
      priceKey: 'plan_pro_price',
      periodKey: 'plan_pro_period',
      descriptionKey: 'plan_pro_description',
      features: [
        'plan_pro_feature_1',
        'plan_pro_feature_2',
        'plan_pro_feature_3',
        'plan_pro_feature_4',
        'plan_pro_feature_5',
        'plan_pro_feature_6',
        'plan_pro_feature_7',
      ],
      ctaKey: 'cta_start_trial',
      href: '/api/stripe/checkout',
      highlighted: true,
    },
    {
      nameKey: 'plan_business_name',
      priceKey: 'plan_business_price',
      periodKey: 'plan_business_period',
      descriptionKey: 'plan_business_description',
      features: [
        'plan_business_feature_1',
        'plan_business_feature_2',
        'plan_business_feature_3',
        'plan_business_feature_4',
        'plan_business_feature_5',
        'plan_business_feature_6',
        'plan_business_feature_7',
      ],
      ctaKey: 'cta_contact_sales',
      href: 'mailto:sales@omnysync.com',
      highlighted: false,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-28">
        {/* Header */}
        <div className="animate-enter-up flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              02 / Plans
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              {t('pricing_title')}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {t('pricing_subtitle')}
            </p>
          </div>
          <p className="max-w-xs font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-muted-foreground">
            {t('pricing_note_1')}
            <br />
            {t('pricing_note_2')}
          </p>
        </div>

        {/* Plans: the recommended plan is visually dominant, the others recede. */}
        <div className="mt-10 grid items-start gap-4 lg:grid-cols-3">
          {plans.map((plan, index) => {
            const isPro = plan.highlighted

            return (
              <div
                key={plan.nameKey}
                className={`animate-enter-up transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 ${
                  isPro
                    ? 'relative rounded-xl border border-primary/30 bg-card p-6 shadow-lg ring-1 ring-primary/10 hover:shadow-xl lg:-mt-3 lg:pb-8'
                    : 'rounded-xl border border-border bg-card p-6 shadow-sm hover:border-border-strong hover:shadow-md'
                }`}
                style={{ animationDelay: `${80 + index * 90}ms` }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-tight">{t(plan.nameKey)}</h2>
                  {isPro && (
                    <span className="rounded-[3px] bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                      {t('popular_badge')}
                    </span>
                  )}
                </div>

                <p className="mt-1 text-[13px] text-muted-foreground">{t(plan.descriptionKey)}</p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">
                    {t(plan.priceKey)}
                  </span>
                  <span className="text-[13px] text-muted-foreground">/{t(plan.periodKey)}</span>
                </div>

                <div className="mt-5">
                  {plan.href.startsWith('/api') ? (
                    <ProCheckoutButton label={t(plan.ctaKey)} />
                  ) : (
                    <Button
                      asChild
                      variant={isPro ? 'default' : 'outline'}
                      className="w-full rounded-[3px]"
                    >
                      <Link href={plan.href}>
                        {t(plan.ctaKey)}
                        {isPro && <ArrowRight className="size-4" />}
                      </Link>
                    </Button>
                  )}
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-border pt-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span
                        className={
                          isPro
                            ? 'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[3px] bg-primary/10 text-primary'
                            : 'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[3px] bg-muted text-muted-foreground'
                        }
                      >
                        <Check className="size-2.5" aria-hidden="true" />
                      </span>
                      <span className="text-[13px] leading-snug text-foreground">{t(feature)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Comparison note — answers the question the cards raise. */}
        <div
          className="animate-enter-fade mt-10 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-muted/40 p-6 sm:flex-row sm:items-center"
          style={{ animationDelay: '380ms' }}
        >
          <div>
            <p className="text-sm font-medium">{t('cta_section_title')}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{t('cta_section_subtitle')}</p>
          </div>
          <Button asChild className="shrink-0 rounded-[3px]">
            <Link href="/auth/signin">
              {t('cta_final_button')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
