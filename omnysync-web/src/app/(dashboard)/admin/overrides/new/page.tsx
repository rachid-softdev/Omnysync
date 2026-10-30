'use client'

/**
 * Admin New Override Page
 * Form to create a new entitlement override for an organization or user.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, PageShell } from '@/components/page-header'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { toast } from '@/components/toast-provider'

type ApiError = {
  error: string
  message: string
}

export default function NewOverridePage() {
  const router = useRouter()
  const { t } = useTranslations()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [scope, setScope] = useState('ORG')
  const [scopeId, setScopeId] = useState('')
  const [featureKey, setFeatureKey] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [limitValue, setLimitValue] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [reason, setReason] = useState('')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!scope) newErrors.scope = t('admin_validation_scope_required')
    if (!scopeId.trim()) newErrors.scopeId = t('admin_validation_scope_id_required')
    if (!featureKey.trim()) newErrors.featureKey = t('admin_validation_feature_key_required')
    if (!reason.trim()) newErrors.reason = t('admin_validation_reason_required')

    if (limitValue && isNaN(parseInt(limitValue, 10))) {
      newErrors.limitValue = t('admin_validation_valid_integer')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        scope,
        scopeId: scopeId.trim(),
        featureKey: featureKey.trim(),
        enabled,
        reason: reason.trim(),
      }

      if (limitValue) body.limitValue = parseInt(limitValue, 10)
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString()

      const res = await fetch('/api/admin/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(t('admin_override_new_success'))
        router.push('/admin/overrides')
      } else {
        const err: ApiError = await res.json().catch(() => ({
          error: 'UNKNOWN',
          message: t('admin_error_generic'),
        }))
        toast.error(err.message)
      }
    } catch (err) {
      toast.error(t('admin_override_new_error'))
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <PageShell>
      <PageHeader
        eyebrow={t('admin_override_new_eyebrow')}
        title={t('admin_override_new_title')}
        description={t('admin_override_new_desc')}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/overrides')}>
            <ArrowLeft className="size-3.5" />
            {t('admin_action_back')}
          </Button>
        }
      />

      <Card className="mt-6 max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-0">
            {/* Scope */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">{t('admin_override_new_scope_section')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('admin_override_new_scope_desc')}
              </p>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="scope">
                    {t('admin_override_new_scope_section')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger
                      className={`max-w-[220px] ${errors.scope ? 'border-destructive' : ''}`}
                    >
                      <SelectValue placeholder={t('admin_override_new_scope_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORG">{t('admin_override_new_scope_org')}</SelectItem>
                      <SelectItem value="USER">{t('admin_override_new_scope_user')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.scope && <p className="text-xs text-destructive">{errors.scope}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="scopeId">
                    {scope === 'ORG'
                      ? t('admin_override_new_scope_id_org')
                      : t('admin_override_new_scope_id_user')}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="scopeId"
                    placeholder={scope === 'ORG' ? 'org_abc123' : 'user_xyz789'}
                    value={scopeId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setScopeId(e.target.value)
                    }
                    className={errors.scopeId ? 'border-destructive' : ''}
                    aria-invalid={Boolean(errors.scopeId)}
                  />
                  {errors.scopeId && <p className="text-xs text-destructive">{errors.scopeId}</p>}
                </div>
              </div>
            </div>

            {/* Feature */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">{t('admin_override_new_feature_section')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('admin_override_new_feature_desc')}
              </p>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="featureKey">
                  {t('admin_override_new_feature_key')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="featureKey"
                  placeholder="EXPORT_PDF"
                  value={featureKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFeatureKey(e.target.value)
                  }
                  className={errors.featureKey ? 'border-destructive' : ''}
                  aria-invalid={Boolean(errors.featureKey)}
                />
                {errors.featureKey && (
                  <p className="text-xs text-destructive">{errors.featureKey}</p>
                )}
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-4 border-b border-border p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="enabled">{t('admin_form_enabled')}</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('admin_override_new_enabled_desc')}
                  </p>
                </div>
                <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="limitValue">{t('admin_override_new_limit_value')}</Label>
                <Input
                  id="limitValue"
                  type="number"
                  min="0"
                  placeholder="100"
                  value={limitValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLimitValue(e.target.value)
                  }
                  className={`max-w-[160px] tabular-nums ${errors.limitValue ? 'border-destructive' : ''}`}
                  aria-invalid={Boolean(errors.limitValue)}
                />
                {errors.limitValue ? (
                  <p className="text-xs text-destructive">{errors.limitValue}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('admin_override_new_limit_help')}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expiresAt">{t('admin_override_new_expires_at')}</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setExpiresAt(e.target.value)
                  }
                  className="max-w-[260px]"
                />
                <p className="text-xs text-muted-foreground">
                  {t('admin_override_new_expires_help')}
                </p>
              </div>
            </div>

            {/* Audit */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">{t('admin_override_new_audit')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('admin_override_new_audit_desc')}
              </p>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="reason">
                  {t('admin_override_new_reason')} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder={t('admin_override_new_reason_placeholder')}
                  value={reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setReason(e.target.value)
                  }
                  rows={3}
                  className={errors.reason ? 'border-destructive' : ''}
                  aria-invalid={Boolean(errors.reason)}
                />
                {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 p-5">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                {t('admin_override_new_submit')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/overrides')}
              >
                {t('admin_action_cancel')}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </PageShell>
  )
}
