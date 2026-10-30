'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from '@/components/toast-provider'
import { useTranslations } from '@/lib/i18n/useTranslations'

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

interface ScheduleSettingsProps {
  documentId: string
  autoSyncEnabled: boolean
  syncFrequency: string | null
  canSchedule: boolean
  locale?: string
}

const FREQUENCY_KEYS: Record<Frequency, string> = {
  DAILY: 'DOC_FREQ_DAILY',
  WEEKLY: 'DOC_FREQ_WEEKLY',
  MONTHLY: 'DOC_FREQ_MONTHLY',
}

function initialFrequency(value: string | null): Frequency {
  return value === 'WEEKLY' || value === 'MONTHLY' ? value : 'DAILY'
}

export function ScheduleSettings({
  documentId,
  autoSyncEnabled,
  syncFrequency,
  canSchedule,
  locale,
}: ScheduleSettingsProps) {
  const router = useRouter()
  const { t, tf } = useTranslations(locale)
  const frequencyLabel = (value: Frequency) => t(FREQUENCY_KEYS[value])
  const [enabled, setEnabled] = useState(autoSyncEnabled)
  const [frequency, setFrequency] = useState<Frequency>(initialFrequency(syncFrequency))
  const [loading, setLoading] = useState(false)

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/sync/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || data.message || t('DOC_SCHEDULE_ERROR'))
    }
    return data
  }

  const toggle = async (nextEnabled: boolean) => {
    if (!canSchedule) return
    setLoading(true)
    try {
      if (nextEnabled) {
        await patch({ action: 'schedule', frequency })
        setEnabled(true)
        toast.success(
          tf('DOC_SCHEDULE_ENABLED_TOAST', {
            frequency: frequencyLabel(frequency).toLowerCase(),
          })
        )
      } else {
        await patch({ action: 'disable_schedule' })
        setEnabled(false)
        toast.success(t('DOC_SCHEDULE_DISABLED_TOAST'))
      }
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('DOC_SCHEDULE_ERROR'))
    } finally {
      setLoading(false)
    }
  }

  const changeFrequency = async (nextFrequency: Frequency) => {
    setFrequency(nextFrequency)
    if (!enabled) return

    setLoading(true)
    try {
      await patch({ action: 'schedule', frequency: nextFrequency })
      toast.success(
        tf('DOC_SCHEDULE_SET_TOAST', {
          frequency: frequencyLabel(nextFrequency).toLowerCase(),
        })
      )
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('DOC_SCHEDULE_ERROR'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium">{t('DOC_SCHEDULE_AUTO_SYNC')}</p>
          <p className="text-xs text-muted-foreground">
            {canSchedule ? t('DOC_SCHEDULE_DESC') : t('DOC_SCHEDULE_PRO_REQUIRED')}
          </p>
        </div>
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <Switch
            checked={enabled}
            onCheckedChange={toggle}
            disabled={!canSchedule || loading}
            aria-label={t('DOC_SCHEDULE_ARIA')}
          />
        )}
      </div>

      {!canSchedule && (
        <p className="text-xs text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">
            {t('DOC_SCHEDULE_VIEW_PLANS')}
          </Link>{' '}
          {t('DOC_SCHEDULE_ENABLE_HINT')}
        </p>
      )}

      {canSchedule && (
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">{t('DOC_SCHEDULE_FREQUENCY')}</p>
          <Select
            value={frequency}
            onValueChange={(value) => void changeFrequency(value as Frequency)}
            disabled={!enabled || loading}
          >
            <SelectTrigger className="mt-1.5 w-full" aria-label={t('DOC_SCHEDULE_FREQ_ARIA')}>
              <span>{frequencyLabel(frequency)}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">{t('DOC_FREQ_DAILY')}</SelectItem>
              <SelectItem value="WEEKLY">{t('DOC_FREQ_WEEKLY')}</SelectItem>
              <SelectItem value="MONTHLY">{t('DOC_FREQ_MONTHLY')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
