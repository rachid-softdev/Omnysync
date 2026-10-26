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
import { useTranslations } from '@/lib/i18n/useTranslations'
import { toast } from '@/components/toast-provider'

type ApiError = {
  error: string
  message: string
}

export default function NewFeaturePage() {
  const router = useRouter()
  const { t, tf } = useTranslations()
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

    if (!key.trim()) newErrors.key = t('admin_validation_key_required')
    if (!name.trim()) newErrors.name = t('admin_validation_name_required')
    if (!type) newErrors.type = t('admin_validation_type_required')

    // Validate JSON if provided
    if (defaultConfig.trim()) {
      try {
        JSON.parse(defaultConfig)
      } catch {
        newErrors.defaultConfig = t('admin_validation_invalid_json')
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
        toast.success(tf('admin_feature_new_success', { name }))
        router.push('/admin/features')
      } else {
        const err: ApiError = await res.json().catch(() => ({
          error: 'UNKNOWN',
          message: t('admin_error_generic'),
        }))

        if (res.status === 409) {
          setErrors({ key: err.message })
          toast.error(err.message)
        } else {
          toast.error(err.message)
        }
      }
    } catch (err) {
      toast.error(t('admin_feature_new_error'))
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
        eyebrow={t('admin_feature_new_eyebrow')}
        title={t('admin_feature_new_title')}
        description={t('admin_feature_new_desc')}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/features')}>
            <ArrowLeft className="size-3.5" />
            {t('admin_action_back')}
          </Button>
        }
      />

      <Card className="mt-6 max-w-2xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-0">
            {/* Identity */}
            <div className="border-b border-border p-5">
              <p className="text-[13px] font-semibold">{t('admin_feature_new_identity')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('admin_feature_new_identity_desc')}
              </p>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="key">
                    {t('admin_form_key')} <span className="text-destructive">*</span>
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
                      {t('admin_feature_new_key_help')}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    {t('admin_form_name')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder={t('admin_feature_new_name_placeholder')}
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
              <p className="text-[13px] font-semibold">{t('admin_feature_new_classification')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('admin_feature_new_classification_desc')}
              </p>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="type">
                    {t('admin_form_type')} <span className="text-destructive">*</span>
                  </Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger
                      className={`max-w-[280px] ${errors.type ? 'border-destructive' : ''}`}
                    >
                      <SelectValue placeholder={t('admin_feature_new_type_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOOLEAN">{t('admin_feature_new_type_boolean')}</SelectItem>
                      <SelectItem value="LIMIT">{t('admin_feature_new_type_limit')}</SelectItem>
                      <SelectItem value="EXPERIMENT">
                        {t('admin_feature_new_type_experiment')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">{t('admin_form_description')}</Label>
                  <Textarea
                    id="description"
                    placeholder={t('admin_feature_new_description_placeholder')}
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
              <p className="text-[13px] font-semibold">{t('admin_feature_new_default_config')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('admin_feature_new_default_config_desc')}
              </p>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="defaultConfig">{t('admin_feature_new_default_config_label')}</Label>
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
                  <p className="text-xs text-muted-foreground">
                    {t('admin_feature_new_default_config_help')}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 p-5">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                {t('admin_feature_new_submit')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/features')}
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
