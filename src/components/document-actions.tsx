"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Edit, RefreshCw, Trash2 } from "lucide-react"

interface DocumentActionsProps {
  documentId: string
  onEdit?: () => void
}

export function DocumentActions({ documentId }: DocumentActionsProps) {
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch(`/api/sync/${documentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error("Sync failed:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        router.push("/dashboard/documents")
      }
    } catch (error) {
      console.error("Delete failed:", error)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/dashboard/documents/${documentId}/edit`)}
        >
          <Edit className="w-4 h-4 mr-2" />
          Modifier
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Synchronisation..." : "Synchroniser"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Supprimer
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le document sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}