"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  FileText, 
  ArrowRight, 
  Check, 
  Loader2, 
  Plug,
  Zap,
  Send,
  Clock
} from "lucide-react"

interface SyncStep {
  id: number
  title: string
  description: string
  status: "pending" | "current" | "completed" | "error"
}

interface LogEntry {
  timestamp: Date
  message: string
  status: "info" | "success" | "error" | "warning"
}

export default function NewSyncPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [source, setSource] = useState("")
  const [sourceDoc, setSourceDoc] = useState("")
  const [destination, setDestination] = useState("")
  const [isSyncing, setIsSyncing] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const steps: SyncStep[] = [
    { id: 1, title: "Source", description: "Sélectionnez la source", status: currentStep === 0 ? "current" : currentStep > 0 ? "completed" : "pending" },
    { id: 2, title: "Document", description: "Choisissez le document", status: currentStep === 1 ? "current" : currentStep > 1 ? "completed" : "pending" },
    { id: 3, title: "Destination", description: "Configurez la destination", status: currentStep === 2 ? "current" : currentStep > 2 ? "completed" : "pending" },
    { id: 4, title: "IA", description: "Options d'enrichissement", status: currentStep === 3 ? "current" : currentStep > 3 ? "completed" : "pending" },
    { id: 5, title: "Synchronisation", description: "Lancez le transfert", status: currentStep === 4 ? "current" : "pending" },
  ]

  const addLog = (message: string, status: LogEntry["status"] = "info") => {
    setLogs(prev => [...prev, { timestamp: new Date(), message, status }])
  }

  const handleSourceSelect = () => {
    addLog("Connexion à Google Docs...", "info")
    setTimeout(() => {
      addLog("Documents récupérer avec succès", "success")
      setCurrentStep(1)
    }, 1000)
  }

  const handleDocSelect = () => {
    addLog(`Document "${sourceDoc}" sélectionné`, "info")
    setTimeout(() => {
      addLog("Contenu du document analysé", "success")
      setCurrentStep(2)
    }, 800)
  }

  const handleDestinationSelect = () => {
    addLog(`Destination ${destination} configurée`, "info")
    setTimeout(() => {
      addLog("Connexion vérifiée", "success")
      setCurrentStep(3)
    }, 1000)
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setCurrentStep(4)
    
    addLog("Démarrage de la synchronisation...", "info")
    
    setTimeout(() => addLog("Récupération du contenu depuis la source...", "info"), 500)
    setTimeout(() => addLog("Parsing HTML du document...", "success"), 1200)
    setTimeout(() => addLog("Génération des métadonnées SEO...", "info"), 1800)
    setTimeout(() => addLog("SEO généré avec succès", "success"), 2400)
    setTimeout(() => addLog("Upload des images...", "info"), 3000)
    setTimeout(() => addLog("3 images uploadées", "success"), 4000)
    setTimeout(() => addLog("Connexion à WordPress...", "info"), 4500)
    setTimeout(() => addLog("Publication de l'article...", "info"), 5000)
    setTimeout(() => addLog("Article publié avec succès!", "success"), 6000)
    setTimeout(() => {
      addLog("Synchronisation terminée", "success")
      setIsSyncing(false)
    }, 6500)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Nouvelle Synchronisation</h1>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step.status === "completed" ? "bg-green-500 text-white" :
                step.status === "current" ? "bg-slate-900 text-white" :
                "bg-slate-200 text-slate-500"
              }`}>
                {step.status === "completed" ? <Check className="w-5 h-5" /> :
                 step.status === "current" ? <span className="text-sm font-bold">{index + 1}</span> :
                 <span className="text-sm">{index + 1}</span>}
              </div>
              <div className="ml-3 hidden sm:block">
                <p className={`font-medium ${step.status === "pending" ? "text-slate-500" : "text-slate-900"}`}>
                  {step.title}
                </p>
                <p className="text-xs text-slate-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-2 ${index < currentStep ? "bg-green-500" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          {currentStep === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sélectionner la source</CardTitle>
                <CardDescription>Choisissez où récupérer le contenu</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google-docs">📄 Google Docs</SelectItem>
                      <SelectItem value="notion">📝 Notion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {source && (
                  <Button onClick={handleSourceSelect} className="w-full">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Continuer
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Sélectionner le document</CardTitle>
                <CardDescription>Choisissez le document à synchroniser</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Document</Label>
                  <Select value={sourceDoc} onValueChange={setSourceDoc}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un document" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doc-1">Article SEO 2024</SelectItem>
                      <SelectItem value="doc-2">Guide Marketing</SelectItem>
                      <SelectItem value="doc-3">Tutoriel Technique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {sourceDoc && (
                  <Button onClick={handleDocSelect} className="w-full">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Continuer
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Destination</CardTitle>
                <CardDescription>Sélectionnez où publier le contenu</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Plateforme</Label>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une destination" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wordpress">🔵 WordPress</SelectItem>
                      <SelectItem value="ghost">👻 Ghost</SelectItem>
                      <SelectItem value="webflow">🌐 Webflow</SelectItem>
                      <SelectItem value="shopify">🛒 Shopify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {destination && (
                  <div className="space-y-2">
                    <Label>URL du site</Label>
                    <Input placeholder="https://exemple.com" />
                  </div>
                )}
                {destination && (
                  <Button onClick={handleDestinationSelect} className="w-full">
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Continuer
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Enrichissement IA</CardTitle>
                <CardDescription>Options d'optimisation automatique</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="seo" className="rounded" defaultChecked />
                  <Label htmlFor="seo">Générer les métadonnées SEO</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="images" className="rounded" />
                  <Label htmlFor="images">Générer des images IA</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="links" className="rounded" defaultChecked />
                  <Label htmlFor="links">Ajouter des liens internes</Label>
                </div>
                <Button onClick={handleSync} className="w-full">
                  <Zap className="w-4 h-4 mr-2" />
                  Lancer la synchronisation
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Synchronisation en cours</CardTitle>
                <CardDescription>Ne fermez pas cette page</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <Loader2 className="w-12 h-12 animate-spin text-slate-900" />
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Console de logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-900 text-green-400 p-4 rounded-lg h-[400px] overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <p className="text-slate-500">En attente d'activité...</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    <span className="text-slate-500">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>{" "}
                    <span className={
                      log.status === "error" ? "text-red-400" :
                      log.status === "warning" ? "text-yellow-400" :
                      log.status === "success" ? "text-green-400" :
                      "text-blue-400"
                    }>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}