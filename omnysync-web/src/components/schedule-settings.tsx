'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from '@/components/toast-provider'

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'

interface ScheduleSettingsProps {
  documentId: string
  autoSyncEnabled: boolean
  syncFrequency: string | null
  canSchedule: boolean
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
}

function initialFrequency(value: string | null): Frequency {
  return value === 'WEEKLY' || value === 'MONTHLY' ? value : 'DAILY'
}

export function ScheduleSettings({
  documentId,
  autoSyncEnabled,
  syncFrequency,
  canSchedule,
}: ScheduleSettingsProps) {
  const router = useRouter()
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
      throw new Error(data.error || data.message || 'Schedule could not be updated')
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
        toast.success(`Scheduled sync enabled (${FREQUENCY_LABELS[frequency].toLowerCase()})`)
      } else {
        await patch({ action: 'disable_schedule' })
        setEnabled(false)
        toast.success('Scheduled sync disabled')
      }
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Schedule could not be updated')
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
      toast.success(`Scheduled sync set to ${FREQUENCY_LABELS[nextFrequency].toLowerCase()}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Schedule could not be updated')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium">Auto sync</p>
          <p className="text-xs text-muted-foreground">
            {canSchedule
              ? 'Run this sync on a recurring schedule'
              : 'Scheduled sync requires the Pro plan'}
          </p>
        </div>
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <Switch
            checked={enabled}
            onCheckedChange={toggle}
            disabled={!canSchedule || loading}
            aria-label="Auto sync enabled"
          />
        )}
      </div>

      {!canSchedule && (
        <p className="text-xs text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">
            View plans
          </Link>{' '}
          to enable scheduled sync.
        </p>
      )}

      {canSchedule && (
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">Frequency</p>
          <Select
            value={frequency}
            onValueChange={(value) => void changeFrequency(value as Frequency)}
            disabled={!enabled || loading}
          >
            <SelectTrigger className="mt-1.5 w-full" aria-label="Sync frequency">
              <span>{FREQUENCY_LABELS[frequency]}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
