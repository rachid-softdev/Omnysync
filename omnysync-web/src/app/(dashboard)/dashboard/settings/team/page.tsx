'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, UserPlus, Shield, Crown, User, Trash2, Loader2 } from 'lucide-react'
import { toast } from '@/components/toast-provider'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { PageHeader, PageShell } from '@/components/page-header'
import { formatDate, detectClientLocale } from '@/lib/format-date'

interface TeamMember {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  joinedAt: string
}

export default function TeamSettingsPage() {
  const { t, tf } = useTranslations()
  const locale = detectClientLocale()
  const roleLabels: Record<string, string> = {
    OWNER: t('admin_role_owner'),
    ADMIN: t('admin_role_admin'),
    MEMBER: t('admin_role_member'),
  }
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')
  const [inviting, setInviting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const fetchTeam = async () => {
    try {
      const res = await fetch('/api/team')
      if (res.ok) {
        const data = await res.json()
        setMembers(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeam()
  }, [])

  const handleInvite = async () => {
    if (!inviteEmail) return

    setInviting(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setInviteDialogOpen(false)
        setInviteEmail('')
        setInviteRole('MEMBER')
        fetchTeam()
        toast.success(t('TEAM_ADD_SUCCESS'))
      } else {
        toast.error(typeof data?.error === 'string' ? data.error : t('TEAM_ADD_ERROR'))
      }
    } catch (e) {
      console.error(e)
      toast.error(t('TEAM_ADD_ERROR'))
    } finally {
      setInviting(false)
    }
  }

  const confirmRemoveMember = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/team/${deleteTarget}`, {
        method: 'DELETE',
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        fetchTeam()
        toast.success(t('TEAM_REMOVE_SUCCESS'))
      } else {
        toast.error(typeof data?.error === 'string' ? data.error : t('TEAM_REMOVE_ERROR'))
      }
    } catch (e) {
      console.error(e)
      toast.error(t('TEAM_REMOVE_ERROR'))
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        fetchTeam()
      } else {
        toast.error(typeof data?.error === 'string' ? data.error : t('TEAM_ROLE_UPDATE_ERROR'))
      }
    } catch (e) {
      console.error(e)
      toast.error(t('TEAM_ROLE_UPDATE_ERROR'))
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="size-3.5 text-warning" />
      case 'ADMIN':
        return <Shield className="size-3.5 text-info" />
      default:
        return <User className="size-3.5 text-muted-foreground" />
    }
  }

  const getRoleLabel = (role: string) => roleLabels[role] ?? role

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={t('TEAM_EYEBROW_LIVE')}
          title={t('TEAM_TITLE')}
          description={t('TEAM_SUBTITLE')}
        />
        <div className="mt-6 flex min-h-[320px] items-center justify-center border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    )
  }

  const memberCountLabel = tf(
    members.length === 1 ? 'TEAM_MEMBER_COUNT_ONE' : 'TEAM_MEMBER_COUNT_OTHER',
    { count: members.length }
  )
  const seatCountLabel = tf(members.length === 1 ? 'TEAM_SEAT_ONE' : 'TEAM_SEAT_OTHER', {
    count: members.length,
  })

  return (
    <PageShell>
      <PageHeader
        eyebrow={tf('TEAM_EYEBROW_COUNT', {
          count: String(members.length).padStart(2, '0'),
        })}
        title={t('TEAM_TITLE')}
        description={t('TEAM_SUBTITLE')}
        actions={
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="size-4" />
                {t('TEAM_ADD_MEMBER')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('TEAM_ADD_MEMBER')}</DialogTitle>
                <DialogDescription>{t('TEAM_ADD_MEMBER_DESC')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t('settings_email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('TEAM_EMAIL_PLACEHOLDER')}
                    value={inviteEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setInviteEmail(e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role">{t('TEAM_ROLE')}</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="role" className="w-full">
                      <span>{getRoleLabel(inviteRole)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">{t('admin_role_member')}</SelectItem>
                      <SelectItem value="ADMIN">{t('admin_role_admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  {t('TEAM_CANCEL')}
                </Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                  {inviting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t('TEAM_ADD_MEMBER')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mt-6 border border-border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {t('TEAM_REGISTRY')}
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-muted-foreground" />
              {t('TEAM_MEMBERS_TITLE')}
            </h2>
          </div>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {memberCountLabel}
          </span>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
            <span className="grid size-10 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-[-0.02em]">{t('TEAM_EMPTY_TITLE')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('TEAM_EMPTY_DESC')}</p>
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('TEAM_COL_MEMBER')}
                  </TableHead>
                  <TableHead className="h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('TEAM_ROLE')}
                  </TableHead>
                  <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] md:table-cell">
                    {t('TEAM_COL_JOINED')}
                  </TableHead>
                  <TableHead className="h-9 px-4 text-right font-mono text-[9px] uppercase tracking-[0.14em]">
                    <span className="sr-only">{t('TEAM_ACTIONS')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className="border-border hover:bg-muted/30">
                    <TableCell className="px-3 py-2.5 sm:px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-7 sm:size-8">
                          <AvatarImage src={member.image || undefined} />
                          <AvatarFallback className="text-[11px]">
                            {member.name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="max-w-[8rem] truncate text-[13px] font-medium sm:max-w-[20rem]">
                            {member.name || t('TEAM_NO_NAME')}
                          </p>
                          <p className="max-w-[8rem] truncate font-mono text-[10px] text-muted-foreground sm:max-w-[20rem]">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 sm:px-4">
                      {member.role === 'OWNER' ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] text-warning">
                          {getRoleIcon(member.role)}
                          {getRoleLabel(member.role)}
                        </span>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(newRole) => handleUpdateRole(member.id, newRole)}
                        >
                          <SelectTrigger className="h-7 w-[5.5rem] rounded-[2px] border-border bg-transparent px-2 font-mono text-[9px] uppercase tracking-[0.1em] sm:w-[6.5rem]">
                            <span className="inline-flex items-center gap-1.5">
                              {getRoleIcon(member.role)}
                              {getRoleLabel(member.role)}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">{t('admin_role_member')}</SelectItem>
                            <SelectItem value="ADMIN">{t('admin_role_admin')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap px-4 py-2.5 font-mono text-[10px] tabular-nums text-muted-foreground md:table-cell">
                      {formatDate(member.joinedAt, locale, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-right sm:px-4">
                      {member.role !== 'OWNER' && (
                        <AlertDialog
                          open={deleteTarget === member.id}
                          onOpenChange={(open) => {
                            if (!open) setDeleteTarget(null)
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:bg-destructive-soft"
                              aria-label={t('TEAM_REMOVE_MEMBER')}
                              onClick={() => setDeleteTarget(member.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('TEAM_REMOVE_MEMBER')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('TEAM_REMOVE_DESC')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
                                {t('TEAM_CANCEL')}
                              </AlertDialogCancel>
                              <AlertDialogAction onClick={confirmRemoveMember}>
                                {t('TEAM_REMOVE')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{seatCountLabel}</span>
              <span>{t('TEAM_ORGANIZATION')}</span>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
