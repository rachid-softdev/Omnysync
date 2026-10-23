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
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, PageShell } from '@/components/page-header'
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
    <PageShell>
      <PageHeader
        eyebrow="FEATURES / NEW"
        title="New Feature"
        description="Create a new feature flag for entitlements"
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/features')}>
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
                Define how this feature is identified in plans, overrides and API responses.
              </p>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="key">
                    Key <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="key"
                    placeholder="EXPORT_PDF"
                    value={key}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setKey(e.target.value)}
                    className={errors.key ? 'border-destructive' : ''}
                    aria-invalid={Boolean(errors.key)}
                  />
                  {errors.key ? (
                    <p className="text-xs text-destructive">{errors.key}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Unique identifier used in code (uppercase, underscores). Cannot be changed
                      later.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="Export to PDF"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    className={errors.name ? 'border-destructive' : ''}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
              </div>
            </div>

            {/* Classification */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">Classification</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The type determines how the feature is evaluated and displayed.
              </p>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="type">
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger
                      className={`max-w-[280px] ${errors.type ? 'border-destructive' : ''}`}
                    >
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOOLEAN">BOOLEAN — On/Off toggle</SelectItem>
                      <SelectItem value="LIMIT">LIMIT — Numeric quota</SelectItem>
                      <SelectItem value="EXPERIMENT">EXPERIMENT — A/B test</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description of what this feature does..."
                    value={description}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setDescription(e.target.value)
                    }
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Default Configuration */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">Default Configuration</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Applied when no plan or override is set for an organization or user.
              </p>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="defaultConfig">Default Configuration (JSON)</Label>
                <Textarea
                  id="defaultConfig"
                  placeholder='{"quota": 100, "enabled": true}'
                  value={defaultConfig}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setDefaultConfig(e.target.value)
                  }
                  rows={3}
                  className={`font-mono text-[13px] ${errors.defaultConfig ? 'border-destructive' : ''}`}
                  aria-invalid={Boolean(errors.defaultConfig)}
                />
                {errors.defaultConfig ? (
                  <p className="text-xs text-destructive">{errors.defaultConfig}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Optional. Must be valid JSON.</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 p-5">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                Create Feature
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/features')}
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
