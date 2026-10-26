'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader, PageShell } from '@/components/page-header'
import { useTranslations } from '@/lib/i18n/useTranslations'
import {
  User,
  Bell,
  CreditCard,
  Shield,
  Trash2,
  Loader2,
  CheckCircle,
  ExternalLink,
  Building,
  Globe,
  AlertCircle,
} from 'lucide-react'

export default function SettingsPage() {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState('')
  const [notifications, setNotifications] = useState({
    syncSuccess: true,
    syncFailed: true,
    weeklyDigest: false,
    teamInvites: true,
  })

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
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('settings_save_error'))
    } finally {
      setLoading(false)
    }
  }

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
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="text-lg">U</AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">
                    {t('settings_change_photo')}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">{t('settings_photo_hint')}</p>
                </div>
              </div>

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
                    value="user@example.com"
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
                    <p className="text-[13px] font-medium">{t('settings_org_name')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings_plan_pro')}</p>
                  </div>
                </div>
              </div>

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
                <Button variant="destructive" size="sm">
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
                <Input id="current-password" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">{t('settings_new_password')}</Label>
                <Input id="new-password" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">{t('settings_confirm_password')}</Label>
                <Input id="confirm-password" type="password" placeholder="••••••••" />
              </div>
              <Button size="sm">{t('settings_update_password')}</Button>
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
                  <div className="rounded-[2px] bg-warning-soft p-2">
                    <Shield className="size-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{t('settings_2fa_disabled')}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('settings_2fa_disabled_desc')}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  {t('settings_enable')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings_sessions_title')}</CardTitle>
              <CardDescription>{t('settings_sessions_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                  <div className="flex items-center gap-3">
                    <Globe className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-[13px] font-medium">Chrome - Windows</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('settings_last_activity_5m')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{t('settings_current')}</Badge>
                </div>
                <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Globe className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-[13px] font-medium">Safari - macOS</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('settings_last_activity_3d')}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    {t('settings_revoke')}
                  </Button>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-5 w-full">
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
          <Card>
            <CardHeader>
              <CardTitle>{t('settings_current_plan')}</CardTitle>
              <CardDescription>{t('settings_current_plan_desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-border bg-muted/30 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold tracking-tight">{t('settings_plan_pro')}</p>
                    <Badge variant="success">{t('settings_active')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{t('settings_plan_meta')}</p>
                </div>
                <Button variant="outline" size="sm">
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
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('settings_documents')}</span>
                  <span className="tabular-nums text-muted-foreground">45 / 100</span>
                </div>
                <Progress value={45} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('settings_syncs')}</span>
                  <span className="tabular-nums text-muted-foreground">67 / 100</span>
                </div>
                <Progress value={67} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('settings_connectors')}</span>
                  <span className="tabular-nums text-muted-foreground">6 / 10</span>
                </div>
                <Progress value={60} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settings_invoice_history')}</CardTitle>
              <CardDescription>{t('settings_invoice_history_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="h-9 font-mono text-[9px] uppercase tracking-[0.14em]">
                      {t('settings_date')}
                    </TableHead>
                    <TableHead className="h-9 font-mono text-[9px] uppercase tracking-[0.14em]">
                      {t('settings_amount')}
                    </TableHead>
                    <TableHead className="h-9 font-mono text-[9px] uppercase tracking-[0.14em]">
                      {t('settings_status')}
                    </TableHead>
                    <TableHead className="h-9 text-right font-mono text-[9px] uppercase tracking-[0.14em]">
                      <span className="sr-only">{t('settings_actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { date: 'May 15, 2026', amount: '$29.00', status: t('settings_paid') },
                    { date: 'April 15, 2026', amount: '$29.00', status: t('settings_paid') },
                    { date: 'March 15, 2026', amount: '$29.00', status: t('settings_paid') },
                  ].map((invoice, i) => (
                    <TableRow key={i}>
                      <TableCell>{invoice.date}</TableCell>
                      <TableCell className="tabular-nums">{invoice.amount}</TableCell>
                      <TableCell>
                        <Badge variant="success">{invoice.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${t('settings_open_invoice')} ${invoice.date}`}
                        >
                          <ExternalLink className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
