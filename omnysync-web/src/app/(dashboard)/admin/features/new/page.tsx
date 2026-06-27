'use client'

/**
 * Admin New Feature Page
 * Form to create a new feature flag.
 */

import { useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

export default function NewFeaturePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [key, setKey] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('BOOLEAN')
  const [defaultConfig, setDefaultConfig] = useState('')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!key.trim()) newErrors.key = 'Key is required'
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!type) newErrors.type = 'Type is required'

    // Validate JSON if provided
    if (defaultConfig.trim()) {
      try {
        JSON.parse(defaultConfig)
      } catch {
        newErrors.defaultConfig = 'Invalid JSON format'
      }
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
        type,
      }
      if (description.trim()) body.description = description.trim()
      if (defaultConfig.trim()) body.defaultConfig = JSON.parse(defaultConfig)

      const res = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(`Feature "${name}" created successfully`)
        router.push('/admin/features')
      } else {
        const err: ApiError = await res.json().catch(() => ({
          error: 'UNKNOWN',
          message: 'An error occurred',
        }))

        if (res.status === 409) {
          setErrors({ key: err.message })
          toast.error(err.message)
        } else {
          toast.error(err.message)
        }
      }
    } catch (err) {
      toast.error('Failed to create feature')
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
        title="New Feature"
        description="Create a new feature flag for entitlements"
        actions={
          <Button variant="outline" onClick={() => router.push('/admin/features')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Feature Details</CardTitle>
          <CardDescription>
            Define a new feature that can be assigned to plans and overridden per organization or
            user.
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
                placeholder="EXPORT_PDF"
                value={key}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setKey(e.target.value)}
                className={errors.key ? 'border-destructive' : ''}
              />
              {errors.key && <p className="text-sm text-destructive">{errors.key}</p>}
              <p className="text-xs text-muted-foreground">
                Unique identifier used in code (uppercase, underscores). Cannot be changed later.
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
                placeholder="Export to PDF"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <Separator />

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className={errors.type ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOOLEAN">BOOLEAN — On/Off toggle</SelectItem>
                  <SelectItem value="LIMIT">LIMIT — Numeric quota</SelectItem>
                  <SelectItem value="EXPERIMENT">EXPERIMENT — A/B test</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type}</p>}
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description of what this feature does..."
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <Separator />

            {/* Default Config */}
            <div className="space-y-2">
              <Label htmlFor="defaultConfig">Default Configuration (JSON)</Label>
              <Textarea
                id="defaultConfig"
                placeholder='{"quota": 100, "enabled": true}'
                value={defaultConfig}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDefaultConfig(e.target.value)}
                rows={3}
              />
              {errors.defaultConfig && (
                <p className="text-sm text-destructive">{errors.defaultConfig}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Optional JSON configuration applied when no plan or override is set.
              </p>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Feature
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/features')}
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
