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
  const { t } = useTranslations()
  const locale = detectClientLocale()
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

      if (res.ok) {
        setInviteDialogOpen(false)
        setInviteEmail('')
        setInviteRole('MEMBER')
        fetchTeam()
      }
    } catch (e) {
      console.error(e)
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

      if (res.ok) {
        fetchTeam()
        toast.success('Member removed')
      } else {
        toast.error('Error removing member')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error removing member')
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

      if (res.ok) {
        fetchTeam()
      }
    } catch (e) {
      console.error(e)
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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Owner'
      case 'ADMIN':
        return 'Admin'
      case 'MEMBER':
        return 'Member'
      default:
        return role
    }
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="TEAM / LIVE"
          title={t('TEAM_TITLE') || 'Team'}
          description={t('TEAM_SUBTITLE') || 'Manage your organization members'}
        />
        <div className="mt-6 flex min-h-[320px] items-center justify-center border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={`TEAM / ${String(members.length).padStart(2, '0')}`}
        title={t('TEAM_TITLE') || 'Team'}
        description={t('TEAM_SUBTITLE') || 'Manage your organization members'}
        actions={
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="size-4" />
                Invite member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite member</DialogTitle>
                <DialogDescription>
                  Send an email invitation to join your organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setInviteEmail(e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="role" className="w-full">
                      <span>{inviteRole === 'ADMIN' ? 'Admin' : 'Member'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">Member</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                  {inviting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Send invitation
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
              Registry / members
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-muted-foreground" />
              Organization members
            </h2>
          </div>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
            <span className="grid size-10 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <div>
              <p className="text-base font-semibold tracking-[-0.02em]">No members found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Invite a teammate to start collaborating.
              </p>
            </div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    Member
                  </TableHead>
                  <TableHead className="h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    Role
                  </TableHead>
                  <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] md:table-cell">
                    Joined
                  </TableHead>
                  <TableHead className="h-9 px-4 text-right font-mono text-[9px] uppercase tracking-[0.14em]">
                    <span className="sr-only">Actions</span>
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
                            {member.name || 'No name'}
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
                            <SelectItem value="MEMBER">Member</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
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
                              aria-label="Remove member"
                              onClick={() => setDeleteTarget(member.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove this member? This action is
                                irreversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction onClick={confirmRemoveMember}>
                                Remove
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
              <span>
                {members.length} seat{members.length !== 1 ? 's' : ''}
              </span>
              <span>Organization</span>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
