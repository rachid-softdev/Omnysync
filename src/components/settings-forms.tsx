"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"

interface ApiKey {
  id: string
  name: string
  prefix: string
  lastUsedAt?: string | null
  expiresAt?: string | null
  createdAt: string
}

interface SettingsFormsProps {
  initialApiKeys?: ApiKey[]
}

export function SettingsForms({ initialApiKeys = [] }: SettingsFormsProps) {
  const router = useRouter()

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(initialApiKeys)
  const [newKeyName, setNewKeyName] = useState("")
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState("")
  const [keyLoading, setKeyLoading] = useState(false)

  // Handle password change
  const handlePasswordChange = async () => {
    setPasswordError("")
    setPasswordSuccess(false)

    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas")
      return
    }

    if (newPassword.length < 8) {
      setPasswordError("Le mot de passe doit contenir au moins 8 caractères")
      return
    }

    setPasswordLoading(true)
    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (res.ok) {
        setPasswordSuccess(true)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setPasswordError(data.error || "Erreur lors du changement de mot de passe")
      }
    } catch (e) {
      setPasswordError("Erreur de connexion")
    } finally {
      setPasswordLoading(false)
    }
  }

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "SUPPRIMER") {
      return
    }

    setDeleteLoading(true)
    try {
      const res = await fetch("/api/user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: deleteConfirmText }),
      })

      if (res.ok) {
        router.push("/")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteLoading(false)
    }
  }

  // Handle API key creation
  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return

    setKeyLoading(true)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      })

      const data = await res.json()

      if (res.ok && data.rawKey) {
        setNewKeyValue(data.rawKey)
        setApiKeys([...apiKeys, data.apiKey])
        setNewKeyName("")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setKeyLoading(false)
    }
  }

  // Handle API key deletion
  const handleDeleteApiKey = async (id: string) => {
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" })
      if (res.ok) {
        setApiKeys(apiKeys.filter(k => k.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Mot de passe actuel</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-green-500">Mot de passe mis à jour!</p>}
          <Button onClick={handlePasswordChange} disabled={passwordLoading}>
            {passwordLoading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
          </Button>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>Clés API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeys.length > 0 && (
            <div className="space-y-2">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{key.name}</p>
                    <p className="text-sm text-muted-foreground">{key.prefix}...</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDeleteApiKey(key.id)}
                  >
                    Supprimer
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="Nom de la clé"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <Button onClick={handleCreateApiKey} disabled={keyLoading || !newKeyName.trim()}>
              {keyLoading ? "Création..." : "Générer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone - Delete Account */}
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="text-red-500">Zone dangereuse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            La suppression de votre compte est irréversible. Toutes vos données seront perdues.
          </p>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            Supprimer mon compte
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer votre compte?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Tapez "SUPPRIMER" pour confirmer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Tapez SUPPRIMER"
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== "SUPPRIMER" || deleteLoading}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {deleteLoading ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New API Key Dialog - Show the key once */}
      <AlertDialog open={!!newKeyValue} onOpenChange={() => !newKeyValue && setNewKeyValue("")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clé API créée!</AlertDialogTitle>
            <AlertDialogDescription>
              Copiez cette clé maintenant. Vous ne pourrez plus la voir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 my-4">
            <code className="flex-1 p-2 bg-muted rounded font-mono text-sm">{newKeyValue}</code>
            <Button variant="outline" onClick={() => copyToClipboard(newKeyValue)}>Copier</Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setNewKeyValue("")}>J'ai copié</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}