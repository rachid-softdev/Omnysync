'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, PageShell } from '@/components/page-header'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { detectClientLocale, formatDate } from '@/lib/format-date'
import {
  User,
  Bell,
  CreditCard,
  Shield,
  Trash2,
  Loader2,
  CheckCircle,
  Building,
  Globe,
  AlertCircle,
} from 'lucide-react'

interface BillingUsage {
  currentPlan: string
  billingCycle: { start: string; end: string }
  syncUsed: number
  syncLimit: number
  documentsUsed: number
  documentsLimit: number
  connectorsUsed: number
  connectorsLimit: number
}

interface ProfileData {
  id: string
  name: string | null
  email: string | null
  image: string | null
  organization: { id: string; name: string } | null
}

export default function SettingsPage() {
  const { t, tf } = useTranslations()
  const locale = detectClientLocale()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [billingActionLoading, setBillingActionLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState('')
  const [billing, setBilling] = useState<BillingUsage | null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [billingError, setBillingError] = useState(false)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(false)
  const [notifications, setNotifications] = useState({
    syncSuccess: true,
    syncFailed: true,
    weeklyDigest: false,
    teamInvites: true,
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState('')
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string
    otpauthUrl: string
  } | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[] | null>(null)
  const [sessionActionLoading, setSessionActionLoading] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const fetchBilling = useCallback(async () => {
    setBillingLoading(true)
    setBillingError(false)

    try {
      const res = await fetch('/api/usage')
      if (!res.ok) {
        throw new Error(`Failed to load billing (${res.status})`)
      }
      setBilling((await res.json()) as BillingUsage)
    } catch {
      setBilling(null)
      setBillingError(true)
    } finally {
      setBillingLoading(false)
    }
  }, [])

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true)
    setProfileError(false)

    try {
      const res = await fetch('/api/user/profile')
      if (!res.ok) {
        throw new Error(`Failed to load profile (${res.status})`)
      }
      const data = (await res.json()) as ProfileData
      setProfile(data)
      setName((current) => current || data.name || '')
    } catch {
      setProfile(null)
      setProfileError(true)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchBilling()
    void fetchProfile()
  }, [fetchBilling, fetchProfile])

  const handleSaveProfile = async () => {
    setLoading(true)
    setSaved(false)
    setSaveError('')

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed to save profile (${res.status})`)
      }
      const data = (await res.json().catch(() => ({}))) as { name?: string | null }
      const savedName = data.name ?? name.trim()
      setName(savedName)
      setProfile((current) => (current ? { ...current, name: savedName } : current))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('settings_save_error'))
    } finally {
      setLoading(false)
    }
  }

  const handleChangePlan = async () => {
    setBillingActionLoading(true)

    try {
      const res = await fetch('/api/stripe/portal')
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { url?: string }
        if (data.url) {
          window.location.href = data.url
          return
        }
      }
    } catch {
      // Fall through to the plan picker when the portal is unavailable.
    } finally {
      setBillingActionLoading(false)
    }

    // Free plans have no Stripe customer, so the portal returns 404.
    router.push('/pricing')
  }

  useEffect(() => {
    let cancelled = false

    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: { has2FA?: boolean } } | null) => {
        if (!cancelled && data?.user?.has2FA) {
          setTwoFactorEnabled(true)
        }
      })
      .catch(() => {
        // The 2FA status is also returned by the setup endpoint on demand.
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleUpdatePassword = async () => {
    setPasswordError('')
    setPasswordSaved(false)

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError(t('settings_password_required'))
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError(t('settings_password_too_short'))
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('settings_password_mismatch'))
      return
    }

    setPasswordLoading(true)

    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || t('settings_password_error'))
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordSaved(true)
      // Changing the password invalidates every existing JWT, including this
      // one. Send the user to sign in again instead of leaving a dead session.
      await signOut({ callbackUrl: '/auth/signin' })
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('settings_password_error'))
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleStartTwoFactor = async () => {
    setTwoFactorLoading(true)
    setTwoFactorError('')

    try {
      const res = await fetch('/api/auth/2fa/setup')
      const data = (await res.json().catch(() => ({}))) as {
        enabled?: boolean
        secret?: string
        otpauthUrl?: string
        error?: string
      }

      if (!res.ok) {
        throw new Error(data.error || t('settings_2fa_error'))
      }

      if (data.enabled) {
        setTwoFactorEnabled(true)
        return
      }

      if (!data.secret || !data.otpauthUrl) {
        throw new Error(t('settings_2fa_error'))
      }

      setTwoFactorSetup({ secret: data.secret, otpauthUrl: data.otpauthUrl })
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : t('settings_2fa_error'))
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleVerifyTwoFactor = async () => {
    setTwoFactorError('')

    if (!/^\d{6}$/.test(twoFactorCode)) {
      setTwoFactorError(t('settings_2fa_invalid_code'))
      return
    }

    setTwoFactorLoading(true)

    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code: twoFactorCode }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        backupCodes?: string[]
        error?: string
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || t('settings_2fa_error'))
      }

      setTwoFactorEnabled(true)
      setTwoFactorBackupCodes(data.backupCodes ?? [])
      setTwoFactorSetup(null)
      setTwoFactorCode('')
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : t('settings_2fa_error'))
    } finally {
      setTwoFactorLoading(false)
    }
  }

  const handleSignOutEverywhere = async () => {
    setSessionActionLoading(true)
    setSessionError('')

    try {
      const res = await fetch('/api/user/sessions', { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || t('settings_sessions_error'))
      }

      await signOut({ callbackUrl: '/auth/signin' })
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : t('settings_sessions_error'))
    } finally {
      setSessionActionLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteError('')

    if (deleteConfirm !== 'SUPPRIMER') {
      setDeleteError(t('settings_delete_confirm_hint'))
      return
    }

    setDeleteLoading(true)

    try {
      const res = await fetch(`/api/user?confirmText=${encodeURIComponent(deleteConfirm)}`, {
        method: 'DELETE',
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || t('settings_delete_error'))
      }

      await signOut({ callbackUrl: '/' })
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('settings_delete_error'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const initials = (profile?.name || profile?.email || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <PageShell>
      <PageHeader
        eyebrow={t('settings_eyebrow')}
        title={t('UI_SETTINGS')}
        description={t('UI_PREFERENCES')}
        className="mb-6"
      />

      <Tabs
        defaultValue="profile"
        orientation="vertical"
        className="grid gap-8 lg:grid-cols-[200px_1fr]"
      >
        <TabsList className="h-auto w-full flex-row flex-wrap justify-start gap-0.5 border border-border bg-card p-0.5 lg:sticky lg:top-8 lg:flex-col lg:items-stretch lg:self-start">
          <TabsTrigger
            value="profile"
            className="justify-start gap-2 rounded-[2px] px-3 py-2 text-[13px] lg:w-full"
          >
            <User className="size-4" />
            {t('settings_tab_profile')}
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="justify-start gap-2 rounded-[2px] px-3 py-2 text-[13px] lg:w-full"
          >
            <Shield className="size-4" />
            {t('settings_tab_security')}
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="justify-start gap-2 rounded-[2px] px-3 py-2 text-[13px] lg:w-full"
          >
            <Bell className="size-4" />
            {t('settings_tab_notifications')}
          </TabsTrigger>
          <TabsTrigger
            value="billing"
            className="justify-start gap-2 rounded-[2px] px-3 py-2 text-[13px] lg:w-full"
          >
            <CreditCard className="size-4" />
            {t('settings_tab_billing')}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings_profile_title')}</CardTitle>
              <CardDescription>{t('settings_profile_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Avatar className="size-16">
                {profile?.image && <AvatarImage src={profile.image} alt={profile.name ?? ''} />}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t('settings_full_name')}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder={t('settings_name_placeholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t('settings_email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email ?? ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('settings_current_org')}</Label>
                <div className="flex items-center gap-3 rounded-[3px] border border-border bg-muted/40 px-3 py-2.5">
                  <Building className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-[13px] font-medium">
                      {profileLoading
                        ? t('loading.default')
                        : (profile?.organization?.name ?? t('settings_no_org'))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {billingLoading
                        ? t('loading.default')
                        : billing
                          ? billing.currentPlan
                          : t('settings_plan_unknown')}
                    </p>
                  </div>
                </div>
              </div>

              {profileError && (
                <p className="text-sm text-destructive">{t('settings_profile_unavailable')}</p>
              )}

              {saveError && (
                <div className="flex items-start gap-2 rounded-[3px] border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveProfile} disabled={loading}>
                  {loading && <Loader2 className="size-3.5 animate-spin" />}
                  {saved && <CheckCircle className="size-3.5" />}
                  {saved ? t('settings_saved') : t('settings_save')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">{t('settings_danger_zone')}</CardTitle>
              <CardDescription>{t('settings_irreversible')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium">{t('settings_delete_account')}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('settings_delete_account_desc')}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteConfirm('')
                    setDeleteError('')
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 className="size-3.5" />
                  {t('settings_delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings_password_title')}</CardTitle>
              <CardDescription>{t('settings_password_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">{t('settings_current_password')}</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">{t('settings_new_password')}</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">{t('settings_confirm_password')}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                />
              </div>
              {passwordError && (
                <div className="flex items-start gap-2 rounded-[3px] border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}
              {passwordSaved && (
                <p className="text-sm text-success">{t('settings_password_success')}</p>
              )}
              <Button size="sm" onClick={handleUpdatePassword} disabled={passwordLoading}>
                {passwordLoading && <Loader2 className="size-3.5 animate-spin" />}
                {t('settings_update_password')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings_2fa_title')}</CardTitle>
              <CardDescription>{t('settings_2fa_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-[2px] p-2 ${
                      twoFactorEnabled ? 'bg-success-soft' : 'bg-warning-soft'
                    }`}
                  >
                    <Shield
                      className={`size-4 ${twoFactorEnabled ? 'text-success' : 'text-warning'}`}
                    />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">
                      {twoFactorEnabled ? t('settings_2fa_enabled') : t('settings_2fa_disabled')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {twoFactorEnabled
                        ? t('settings_2fa_enabled_desc')
                        : t('settings_2fa_disabled_desc')}
                    </p>
                  </div>
                </div>
                {!twoFactorEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartTwoFactor}
                    disabled={twoFactorLoading}
                  >
                    {twoFactorLoading && <Loader2 className="size-3.5 animate-spin" />}
                    {t('settings_enable')}
                  </Button>
                )}
              </div>
              {twoFactorError && !twoFactorSetup && (
                <p className="mt-3 text-sm text-destructive">{twoFactorError}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings_sessions_title')}</CardTitle>
              <CardDescription>{t('settings_sessions_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 rounded-[3px] border border-border bg-muted/40 p-3">
                <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t('settings_sessions_unavailable')}
                </p>
              </div>
              {sessionError && <p className="mt-3 text-sm text-destructive">{sessionError}</p>}
              <Button
                variant="outline"
                size="sm"
                className="mt-5 w-full"
                onClick={handleSignOutEverywhere}
                disabled={sessionActionLoading}
              >
                {sessionActionLoading && <Loader2 className="size-3.5 animate-spin" />}
                {t('settings_sign_out_all')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings_email_notifications')}</CardTitle>
              <CardDescription>{t('settings_email_notifications_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
                  <div>
                    <p className="text-[13px] font-medium">{t('settings_sync_success')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('settings_sync_success_desc')}
                    </p>
                  </div>
                  <Switch
                    checked={notifications.syncSuccess}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, syncSuccess: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-[13px] font-medium">{t('settings_sync_failure')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('settings_sync_failure_desc')}
                    </p>
                  </div>
                  <Switch
                    checked={notifications.syncFailed}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, syncFailed: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-[13px] font-medium">{t('settings_weekly_digest')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('settings_weekly_digest_desc')}
                    </p>
                  </div>
                  <Switch
                    checked={notifications.weeklyDigest}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, weeklyDigest: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 py-4 last:pb-0">
                  <div>
                    <p className="text-[13px] font-medium">{t('settings_team_invites')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('settings_team_invites_desc')}
                    </p>
                  </div>
                  <Switch
                    checked={notifications.teamInvites}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, teamInvites: checked }))
                    }
                  />
                </div>
              </div>
              <Button size="sm" className="mt-6" onClick={handleSaveProfile} disabled={loading}>
                {loading && <Loader2 className="size-3.5 animate-spin" />}
                {t('settings_save_preferences')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="max-w-2xl space-y-6">
          {billingLoading ? (
            <Card>
              <CardContent className="flex min-h-[160px] items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : billingError || !billing ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('settings_current_plan')}</CardTitle>
                <CardDescription>{t('settings_current_plan_desc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
                  <span>{t('settings_billing_unavailable')}</span>
                  <Button variant="outline" size="sm" onClick={fetchBilling}>
                    {t('settings_retry')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings_current_plan')}</CardTitle>
                  <CardDescription>{t('settings_current_plan_desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-border bg-muted/30 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold tracking-tight">
                          {billing.currentPlan}
                        </p>
                        <Badge variant="outline">{t('settings_current')}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {billing.currentPlan.toLowerCase() === 'free'
                          ? t('settings_plan_free_meta')
                          : tf('settings_plan_period_ends', {
                              date: formatDate(billing.billingCycle.end, locale),
                            })}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleChangePlan}
                      disabled={billingActionLoading}
                    >
                      {billingActionLoading && <Loader2 className="size-3.5 animate-spin" />}
                      {t('settings_change_plan')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('settings_usage_title')}</CardTitle>
                  <CardDescription>{t('settings_usage_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      label: t('settings_documents'),
                      used: billing.documentsUsed,
                      limit: billing.documentsLimit,
                    },
                    {
                      label: t('settings_syncs'),
                      used: billing.syncUsed,
                      limit: billing.syncLimit,
                    },
                    {
                      label: t('settings_connectors'),
                      used: billing.connectorsUsed,
                      limit: billing.connectorsLimit,
                    },
                  ].map((row) => {
                    const unlimited = row.limit === -1
                    const percentage =
                      unlimited || row.limit <= 0
                        ? 0
                        : Math.min(100, Math.round((row.used / row.limit) * 100))

                    return (
                      <div key={row.label} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{row.label}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {row.used} / {unlimited ? t('settings_unlimited') : row.limit}
                          </span>
                        </div>
                        {!unlimited && <Progress value={percentage} className="h-1.5" />}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(twoFactorSetup)}
        onOpenChange={(open) => {
          if (!open && !twoFactorLoading) {
            setTwoFactorSetup(null)
            setTwoFactorCode('')
            setTwoFactorError('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings_2fa_setup_title')}</DialogTitle>
            <DialogDescription>{t('settings_2fa_setup_desc')}</DialogDescription>
          </DialogHeader>

          {twoFactorSetup && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('settings_2fa_secret')}</Label>
                <code className="block break-all rounded-[3px] border border-border bg-muted/40 p-3 font-mono text-xs">
                  {twoFactorSetup.secret}
                </code>
              </div>
              <div className="space-y-1.5">
                <Label>{t('settings_2fa_uri')}</Label>
                <code className="block break-all rounded-[3px] border border-border bg-muted/40 p-3 font-mono text-xs">
                  {twoFactorSetup.otpauthUrl}
                </code>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="two-factor-code">{t('settings_2fa_code')}</Label>
                <Input
                  id="two-factor-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                />
              </div>
              {twoFactorError && <p className="text-sm text-destructive">{twoFactorError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTwoFactorSetup(null)
                setTwoFactorCode('')
                setTwoFactorError('')
              }}
              disabled={twoFactorLoading}
            >
              {t('settings_2fa_cancel')}
            </Button>
            <Button onClick={handleVerifyTwoFactor} disabled={twoFactorLoading}>
              {twoFactorLoading && <Loader2 className="size-3.5 animate-spin" />}
              {t('settings_2fa_verify')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(twoFactorBackupCodes)}
        onOpenChange={(open) => {
          if (!open) setTwoFactorBackupCodes(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings_2fa_backup_title')}</DialogTitle>
            <DialogDescription>{t('settings_2fa_backup_desc')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-[3px] border border-border bg-muted/40 p-4 font-mono text-sm">
            {twoFactorBackupCodes?.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setTwoFactorBackupCodes(null)}>{t('settings_2fa_done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings_delete_confirm_title')}</DialogTitle>
            <DialogDescription>{t('settings_delete_confirm_desc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">{t('settings_delete_confirm_hint')}</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="SUPPRIMER"
                autoComplete="off"
              />
            </div>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
              {t('settings_delete_cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteLoading || deleteConfirm !== 'SUPPRIMER'}
            >
              {deleteLoading && <Loader2 className="size-3.5 animate-spin" />}
              {t('settings_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
