'use client'

import Link from 'next/link'
import { ArrowUpRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { cn } from '@/lib/utils'

interface PlanGateProps {
  title: string
  description: string
  upgradeUrl?: string
  className?: string
}

/**
 * Plan-gated feature panel.
 *
 * Used when an API returns `PLAN_FEATURE_REQUIRED`: the page stays useful and
 * explains the upgrade path instead of surfacing a raw 403 toast.
 */
export function PlanGate({ title, description, upgradeUrl, className }: PlanGateProps) {
  const { t } = useTranslations()
  const href = upgradeUrl?.startsWith('/') && !upgradeUrl.startsWith('//') ? upgradeUrl : '/pricing'

  return (
    <div className={cn('border border-border bg-card', className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        <span>{t('plan_gate_eyebrow')}</span>
        <span>{t('plan_gate_badge')}</span>
      </div>
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
        <span className="grid size-10 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
          <Lock className="size-5" />
        </span>
        <div className="max-w-xl">
          <p className="text-base font-semibold tracking-[-0.02em]">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <Button asChild className="mt-5">
            <Link href={href}>
              {t('plan_gate_cta')}
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
