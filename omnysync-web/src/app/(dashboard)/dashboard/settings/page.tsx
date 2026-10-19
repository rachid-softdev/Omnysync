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
import { Separator } from '@/components/ui/separator'
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
  Key,
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

  // API Keys (simulées)
  const [apiKeys] = useState([
    { id: '1', name: 'Production API Key', createdAt: '2026-01-15', lastUsed: '2026-05-10' },
  ])

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
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Unable to save changes. Check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell>
      <PageHeader title={t('UI_SETTINGS')} description={t('UI_PREFERENCES')} className="mb-6" />

      <Tabs
        defaultValue="profile"
        orientation="vertical"
        className="grid gap-8 lg:grid-cols-[200px_1fr]"
      >
        <TabsList className="h-auto w-full flex-row justify-start gap-1 overflow-x-auto p-1 lg:sticky lg:top-8 lg:flex-col lg:items-stretch lg:self-start lg:overflow-visible">
          <TabsTrigger value="profile" className="justify-start gap-2 lg:w-full">
            <User className="size-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="justify-start gap-2 lg:w-full">
            <Shield className="size-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="justify-start gap-2 lg:w-full">
            <Bell className="size-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="billing" className="justify-start gap-2 lg:w-full">
            <CreditCard className="size-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="api" className="justify-start gap-2 lg:w-full">
            <Key className="size-4" />
            API
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Manage your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="text-lg">U</AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline" size="sm">
                    Change photo
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or GIF. Max 2MB.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
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
                <Label>Current organization</Label>
                <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
                  <Building className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-[13px] font-medium">My Organization</p>
                    <p className="text-xs text-muted-foreground">Pro Plan</p>
                  </div>
                </div>
              </div>

              {saveError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveProfile} disabled={loading}>
                  {loading && <Loader2 className="size-3.5 animate-spin" />}
                  {saved && <CheckCircle className="size-3.5" />}
                  {saved ? 'Saved!' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium">Delete my account</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    This action is irreversible. All your data will be lost.
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Change your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current password</Label>
                <Input id="current-password" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input id="confirm-password" type="password" placeholder="••••••••" />
              </div>
              <Button size="sm">Update password</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-factor authentication</CardTitle>
              <CardDescription>Add an extra layer of security</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-warning-soft p-2">
                    <Shield className="size-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">2FA disabled</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Protect your account with authentication
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Enable
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active sessions</CardTitle>
              <CardDescription>Manage your login sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
                  <div className="flex items-center gap-3">
                    <Globe className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-[13px] font-medium">Chrome - Windows</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Last activity: 5 minutes ago
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Current</Badge>
                </div>
                <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                  <div className="flex items-center gap-3">
                    <Globe className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-[13px] font-medium">Safari - macOS</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Last activity: 3 days ago
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    Revoke
                  </Button>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-5 w-full">
                Sign out all other sessions
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email notifications</CardTitle>
              <CardDescription>Choose what you want to receive</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
                  <div>
                    <p className="text-[13px] font-medium">Sync successful</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Receive an email when a document is synced
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
                    <p className="text-[13px] font-medium">Sync failure</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Be notified immediately in case of error
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
                    <p className="text-[13px] font-medium">Weekly digest</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Receive a weekly activity summary
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
                    <p className="text-[13px] font-medium">Team invites</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Notifications when someone joins your organization
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
                Save preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>Manage your plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted/50 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold tracking-tight">Pro Plan</p>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    $29/month - renews June 15, 2026
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Change plan
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>Your consumption this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Documents</span>
                  <span className="tabular-nums text-muted-foreground">45 / 100</span>
                </div>
                <Progress value={45} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Syncs</span>
                  <span className="tabular-nums text-muted-foreground">67 / 100</span>
                </div>
                <Progress value={67} className="h-1.5" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Connectors</span>
                  <span className="tabular-nums text-muted-foreground">6 / 10</span>
                </div>
                <Progress value={60} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice history</CardTitle>
              <CardDescription>Download your invoices</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { date: 'May 15, 2026', amount: '$29.00', status: 'Paid' },
                    { date: 'April 15, 2026', amount: '$29.00', status: 'Paid' },
                    { date: 'March 15, 2026', amount: '$29.00', status: 'Paid' },
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
                          aria-label={`Open invoice ${invoice.date}`}
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

        {/* API Tab */}
        <TabsContent value="api" className="max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage keys for external integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Use API keys to integrate Omnysync with your own applications.
                </p>
                <Button size="sm">
                  <Key className="size-3.5" />
                  Generate a key
                </Button>
              </div>

              <Separator />

              {apiKeys.map((key) => (
                <div key={key.id} className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium">{key.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Created on {key.createdAt} - Last used: {key.lastUsed}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      aria-label={`Delete ${key.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
              <CardDescription>Complete endpoint reference</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Full API documentation is available on our developer site.
              </p>
              <Button variant="outline" size="sm" className="mt-4">
                <ExternalLink className="size-3.5" />
                View documentation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
