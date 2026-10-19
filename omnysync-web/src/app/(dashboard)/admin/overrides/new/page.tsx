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
import { toast } from '@/components/toast-provider'

type ApiError = {
  error: string
  message: string
}

export default function NewOverridePage() {
  const router = useRouter()
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

    if (!scope) newErrors.scope = 'Scope is required'
    if (!scopeId.trim()) newErrors.scopeId = 'Scope ID is required'
    if (!featureKey.trim()) newErrors.featureKey = 'Feature key is required'
    if (!reason.trim()) newErrors.reason = 'Reason is required (for audit trail)'

    if (limitValue && isNaN(parseInt(limitValue, 10))) {
      newErrors.limitValue = 'Must be a valid integer'
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
        toast.success('Override created successfully')
        router.push('/admin/overrides')
      } else {
        const err: ApiError = await res.json().catch(() => ({
          error: 'UNKNOWN',
          message: 'An error occurred',
        }))
        toast.error(err.message)
      }
    } catch (err) {
      toast.error('Failed to create override')
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
        title="New Override"
        description="Override feature entitlements for an organization or user"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/overrides')}>
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
        }
      />

      <Card className="mt-6 max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-0">
            {/* Scope */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">Scope</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Choose whether this override applies to a whole organization or a single user.
              </p>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="scope">
                    Scope <span className="text-destructive">*</span>
                  </Label>
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger
                      className={`max-w-[220px] ${errors.scope ? 'border-destructive' : ''}`}
                    >
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORG">Organization</SelectItem>
                      <SelectItem value="USER">User</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.scope && <p className="text-xs text-destructive">{errors.scope}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="scopeId">
                    {scope === 'ORG' ? 'Organization ID' : 'User ID'}{' '}
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
              <p className="text-[13px] font-semibold">Feature</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The feature key to override. It must already exist.
              </p>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="featureKey">
                  Feature Key <span className="text-destructive">*</span>
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
                  <Label htmlFor="enabled">Enabled</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Toggle to grant or restrict access to this feature.
                  </p>
                </div>
                <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="limitValue">Limit Value</Label>
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
                    Optional numeric limit for LIMIT-type features. Leave empty for unlimited.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expiresAt">Expires At</Label>
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
                  Optional expiration date. Leave empty for a permanent override.
                </p>
              </div>
            </div>

            {/* Audit */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">Audit</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                All overrides are logged for audit purposes.
              </p>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="reason">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Why is this override being created? (required for audit)"
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
                Create Override
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/overrides')}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </PageShell>
  )
}
