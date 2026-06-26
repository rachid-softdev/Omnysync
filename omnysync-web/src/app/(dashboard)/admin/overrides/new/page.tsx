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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
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
    <div className="p-8">
      <AdminPageHeader
        title="New Override"
        description="Override feature entitlements for an organization or user"
        actions={
          <Button variant="outline" onClick={() => router.push('/admin/overrides')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Override Details</CardTitle>
          <CardDescription>
            Grant or restrict access to a specific feature for an organization or individual user.
            All overrides are logged for audit purposes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Scope */}
            <div className="space-y-2">
              <Label htmlFor="scope">
                Scope <span className="text-destructive">*</span>
              </Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className={errors.scope ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORG">Organization</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                </SelectContent>
              </Select>
              {errors.scope && <p className="text-sm text-destructive">{errors.scope}</p>}
            </div>

            <Separator />

            {/* Scope ID */}
            <div className="space-y-2">
              <Label htmlFor="scopeId">
                {scope === 'ORG' ? 'Organization ID' : 'User ID'}{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scopeId"
                placeholder={scope === 'ORG' ? 'org_abc123' : 'user_xyz789'}
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                className={errors.scopeId ? 'border-destructive' : ''}
              />
              {errors.scopeId && <p className="text-sm text-destructive">{errors.scopeId}</p>}
            </div>

            <Separator />

            {/* Feature Key */}
            <div className="space-y-2">
              <Label htmlFor="featureKey">
                Feature Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="featureKey"
                placeholder="EXPORT_PDF"
                value={featureKey}
                onChange={(e) => setFeatureKey(e.target.value)}
                className={errors.featureKey ? 'border-destructive' : ''}
              />
              {errors.featureKey && <p className="text-sm text-destructive">{errors.featureKey}</p>}
              <p className="text-xs text-muted-foreground">
                The feature key to override (must already exist).
              </p>
            </div>

            <Separator />

            {/* Enabled */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Toggle to grant or restrict access to this feature.
                </p>
              </div>
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <Separator />

            {/* Limit Value */}
            <div className="space-y-2">
              <Label htmlFor="limitValue">Limit Value</Label>
              <Input
                id="limitValue"
                type="number"
                min="0"
                placeholder="100"
                value={limitValue}
                onChange={(e) => setLimitValue(e.target.value)}
                className={`max-w-[160px] ${errors.limitValue ? 'border-destructive' : ''}`}
              />
              {errors.limitValue && <p className="text-sm text-destructive">{errors.limitValue}</p>}
              <p className="text-xs text-muted-foreground">
                Optional numeric limit for LIMIT-type features. Leave empty for unlimited.
              </p>
            </div>

            <Separator />

            {/* Expires At */}
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires At</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="max-w-[260px]"
              />
              <p className="text-xs text-muted-foreground">
                Optional expiration date. Leave empty for a permanent override.
              </p>
            </div>

            <Separator />

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Why is this override being created? (required for audit)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className={errors.reason ? 'border-destructive' : ''}
              />
              {errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Override
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/overrides')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
