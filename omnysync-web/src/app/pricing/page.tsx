import { Check, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProCheckoutButton } from '@/components/pro-checkout-button'
import Link from 'next/link'
import { t } from '@/lib/i18n'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Choose the perfect plan for your content sync needs. Start free, scale as you grow.',
}

export default function PricingPage() {
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
      <div className="max-w-7xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">{t('pricing_title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{t('pricing_subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.nameKey}
              className={plan.highlighted ? 'border-primary shadow-lg relative' : ''}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  {t('popular_badge')}
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{t(plan.nameKey)}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold">{t(plan.priceKey)}</span>
                  <span className="text-muted-foreground ml-1">/{t(plan.periodKey)}</span>
                </div>
                <CardDescription>{t(plan.descriptionKey)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{t(feature)}</span>
                    </li>
                  ))}
                </ul>
                {plan.href.startsWith('/api') ? (
                  <ProCheckoutButton label={t(plan.ctaKey)} />
                ) : (
                  <Link href={plan.href}>
                    <Button
                      className="w-full rounded-full"
                      variant={plan.highlighted ? 'default' : 'outline'}
                    >
                      {plan.nameKey === 'plan_business_name' && <Zap className="w-4 h-4 mr-2" />}
                      {t(plan.ctaKey)}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
