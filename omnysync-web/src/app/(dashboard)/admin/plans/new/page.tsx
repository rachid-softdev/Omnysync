'use client'

/**
 * Admin New Plan Page
 * Form to create a new subscription plan.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, PageShell } from '@/components/page-header'
import { toast } from '@/components/toast-provider'

type ApiError = {
  error: string
  message: string
}

export default function NewPlanPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [priceMonthly, setPriceMonthly] = useState('')
  const [priceYearly, setPriceYearly] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState('0')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!key.trim()) newErrors.key = 'Key is required'
    if (!name.trim()) newErrors.name = 'Name is required'

    if (priceMonthly && isNaN(parseFloat(priceMonthly))) {
      newErrors.priceMonthly = 'Must be a valid number'
    }
    if (priceYearly && isNaN(parseFloat(priceYearly))) {
      newErrors.priceYearly = 'Must be a valid number'
    }
    if (sortOrder && isNaN(parseInt(sortOrder, 10))) {
      newErrors.sortOrder = 'Must be a valid integer'
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
        key: key.trim(),
        name: name.trim(),
        isActive,
      }

      if (priceMonthly) body.priceMonthly = parseFloat(priceMonthly)
      if (priceYearly) body.priceYearly = parseFloat(priceYearly)
      if (sortOrder) body.sortOrder = parseInt(sortOrder, 10)

      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(`Plan "${name}" created successfully`)
        router.push('/admin/plans')
      } else {
        const err: ApiError = await res.json().catch(() => ({
          error: 'UNKNOWN',
          message: 'An error occurred',
        }))

        if (res.status === 409) {
          setErrors({ key: err.message })
        }
        toast.error(err.message)
      }
    } catch (err) {
      toast.error('Failed to create plan')
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
        eyebrow="PLANS / NEW"
        title="New Plan"
        description="Create a new subscription plan"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/plans')}>
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
        }
      />

      <Card className="mt-6 max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-0">
            {/* Identity */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">Identity</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The key is permanent and used in code and API responses.
              </p>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="key">
                    Key <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="key"
                    placeholder="pro"
                    value={key}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKey(e.target.value)}
                    className={errors.key ? 'border-destructive' : ''}
                    aria-invalid={Boolean(errors.key)}
                  />
                  {errors.key ? (
                    <p className="text-xs text-destructive">{errors.key}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Unique identifier (lowercase, no spaces). Cannot be changed later.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="Pro Plan"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    className={errors.name ? 'border-destructive' : ''}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">Pricing</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Leave prices empty for custom or contact-based plans.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="priceMonthly">Price Monthly ($)</Label>
                  <Input
                    id="priceMonthly"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="29.00"
                    value={priceMonthly}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPriceMonthly(e.target.value)
                    }
                    className={`tabular-nums ${errors.priceMonthly ? 'border-destructive' : ''}`}
                  />
                  {errors.priceMonthly && (
                    <p className="text-xs text-destructive">{errors.priceMonthly}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="priceYearly">Price Yearly ($)</Label>
                  <Input
                    id="priceYearly"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="290.00"
                    value={priceYearly}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPriceYearly(e.target.value)
                    }
                    className={`tabular-nums ${errors.priceYearly ? 'border-destructive' : ''}`}
                  />
                  {errors.priceYearly && (
                    <p className="text-xs text-destructive">{errors.priceYearly}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Availability */}
            <div className="space-y-4 border-b border-border p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="isActive">Active</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Inactive plans cannot be selected by new subscribers.
                  </p>
                </div>
                <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={sortOrder}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSortOrder(e.target.value)
                  }
                  className={`max-w-[120px] tabular-nums ${errors.sortOrder ? 'border-destructive' : ''}`}
                />
                {errors.sortOrder ? (
                  <p className="text-xs text-destructive">{errors.sortOrder}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Lower values appear first in lists.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 p-5">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                Create Plan
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/plans')}
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
