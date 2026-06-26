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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
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
    <div className="p-8">
      <AdminPageHeader
        title="New Plan"
        description="Create a new subscription plan"
        actions={
          <Button variant="outline" onClick={() => router.push('/admin/plans')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
          <CardDescription>
            Define a new subscription plan with pricing and feature entitlements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Key */}
            <div className="space-y-2">
              <Label htmlFor="key">
                Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="key"
                placeholder="pro"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className={errors.key ? 'border-destructive' : ''}
              />
              {errors.key && <p className="text-sm text-destructive">{errors.key}</p>}
              <p className="text-xs text-muted-foreground">
                Unique identifier (lowercase, no spaces). Cannot be changed later.
              </p>
            </div>

            <Separator />

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Pro Plan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <Separator />

            {/* Pricing row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceMonthly">Price Monthly ($)</Label>
                <Input
                  id="priceMonthly"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="29.00"
                  value={priceMonthly}
                  onChange={(e) => setPriceMonthly(e.target.value)}
                  className={errors.priceMonthly ? 'border-destructive' : ''}
                />
                {errors.priceMonthly && (
                  <p className="text-sm text-destructive">{errors.priceMonthly}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceYearly">Price Yearly ($)</Label>
                <Input
                  id="priceYearly"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="290.00"
                  value={priceYearly}
                  onChange={(e) => setPriceYearly(e.target.value)}
                  className={errors.priceYearly ? 'border-destructive' : ''}
                />
                {errors.priceYearly && (
                  <p className="text-sm text-destructive">{errors.priceYearly}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Is Active */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isActive">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive plans cannot be selected by new subscribers.
                </p>
              </div>
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <Separator />

            {/* Sort Order */}
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                min="0"
                placeholder="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className={`max-w-[120px] ${errors.sortOrder ? 'border-destructive' : ''}`}
              />
              {errors.sortOrder && <p className="text-sm text-destructive">{errors.sortOrder}</p>}
              <p className="text-xs text-muted-foreground">Lower values appear first in lists.</p>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Plan
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/admin/plans')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
