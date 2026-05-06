"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/lib/i18n/useTranslations"
import { 
  Check,
  Loader2, 
  Zap,
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
  const { t } = useTranslations("fr")
  const [currentStep, setCurrentStep] = useState(0)
  const [source, setSource] = useState("")
  const [sourceDoc, setSourceDoc] = useState("")
  const [destination, setDestination] = useState("")
  const [isSyncing, setIsSyncing] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const steps: SyncStep[] = [
    { id: 1, title: t("UI_STEP_SOURCE"), description: t("UI_STEP_SOURCE_DESC"), status: currentStep === 0 ? "current" : currentStep > 0 ? "completed" : "pending" },
    { id: 2, title: t("UI_STEP_DOCUMENT"), description: t("UI_STEP_DOCUMENT_DESC"), status: currentStep === 1 ? "current" : currentStep > 1 ? "completed" : "pending" },
    { id: 3, title: t("UI_STEP_DESTINATION"), description: t("UI_STEP_DESTINATION_DESC"), status: currentStep === 2 ? "current" : currentStep > 2 ? "completed" : "pending" },
    { id: 4, title: t("UI_STEP_IA"), description: t("UI_STEP_IA_DESC"), status: currentStep === 3 ? "current" : currentStep > 3 ? "completed" : "pending" },
    { id: 5, title: t("UI_STEP_SYNC"), description: t("UI_STEP_SYNC_DESC"), status: currentStep === 4 ? "current" : "pending" },
  ]

  const addLog = (message: string, status: LogEntry["status"] = "info") => {
    setLogs(prev => [...prev, { timestamp: new Date(), message, status }])
  }

  const handleSourceSelect = () => {
    addLog(t("UI_CONNECTING_SERVICE"), "info")
    setTimeout(() => {
      addLog(t("UI_RETRIEVING_CONTENT"), "success")
      setCurrentStep(1)
    }, 1000)
  }

  const handleDocSelect = () => {
    addLog(t("UI_DOCUMENT_ANALYZED"), "info")
    setTimeout(() => {
      addLog(t("UI_CONTENT_ANALYZED"), "success")
      setCurrentStep(2)
    }, 800)
  }

  const handleDestinationSelect = () => {
    addLog(t("UI_DESTINATION_CONFIGURED"), "info")
    setTimeout(() => {
      addLog(t("UI_CONNECTION_VERIFIED"), "success")
      setCurrentStep(3)
    }, 1000)
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setCurrentStep(4)
    
    addLog(t("UI_SYNC_STARTING"), "info")
    
    setTimeout(() => addLog(t("UI_RETRIEVING_CONTENT"), "info"), 500)
    setTimeout(() => addLog(t("UI_PARSING_HTML"), "success"), 1200)
    setTimeout(() => addLog(t("UI_GENERATING_SEO"), "info"), 1800)
    setTimeout(() => addLog(t("UI_SEO_GENERATED"), "success"), 2400)
    setTimeout(() => addLog(t("UI_UPLOADING_IMAGES"), "info"), 3000)
    setTimeout(() => addLog(t("UI_3_IMAGES"), "success"), 4000)
    setTimeout(() => addLog(t("UI_CONNECTING_WP"), "info"), 4500)
    setTimeout(() => addLog(t("UI_PUBLISHING"), "info"), 5000)
    setTimeout(() => addLog(t("UI_PUBLISHED"), "success"), 6000)
    setTimeout(() => {
      addLog(t("UI_SYNC_COMPLETE"), "success")
      setIsSyncing(false)
    }, 6500)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">{t("UI_NEW_SYNC")}</h1>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step.status === "completed" ? "bg-primary text-primary-foreground" :
                step.status === "current" ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {step.status === "completed" ? <Check className="w-5 h-5" /> :
                 step.status === "current" ? <span className="text-sm font-bold">{index + 1}</span> :
                 <span className="text-sm">{index + 1}</span>}
              </div>
              <div className="ml-3 hidden sm:block">
                <p className={`font-medium ${step.status === "pending" ? "text-muted-foreground" : ""}`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-0.5 mx-2 ${index < currentStep ? "bg-primary" : "bg-muted"}`} />
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
                <CardTitle>{t("UI_SELECT_SOURCE")}</CardTitle>
                <CardDescription>{t("UI_SOURCE_DESC")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("UI_SOURCE")}</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("UI_SELECT_SOURCE_PLACEHOLDER")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google-docs">{t("UI_GOOGLE_DOCS")}</SelectItem>
                      <SelectItem value="notion">{t("UI_NOTION")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {source && (
                  <Button onClick={handleSourceSelect} className="w-full">
                    {t("UI_CONTINUE")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("UI_SELECT_DOCUMENT")}</CardTitle>
                <CardDescription>{t("UI_DOCUMENT_DESC")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("UI_DOCUMENT")}</Label>
                  <Select value={sourceDoc} onValueChange={setSourceDoc}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("UI_SELECT_DOCUMENT_PLACEHOLDER")} />
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
                    {t("UI_CONTINUE")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("UI_DESTINATION")}</CardTitle>
                <CardDescription>{t("UI_DESTINATION_DESC")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("UI_PLATFORM")}</Label>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("UI_SELECT_DESTINATION")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wordpress">{t("UI_WORDPRESS")}</SelectItem>
                      <SelectItem value="ghost">{t("UI_GHOST")}</SelectItem>
                      <SelectItem value="webflow">{t("UI_WEBFLOW")}</SelectItem>
                      <SelectItem value="shopify">{t("UI_SHOPIFY")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {destination && (
                  <div className="space-y-2">
                    <Label>{t("UI_SITE_URL")}</Label>
                    <Input placeholder="https://exemple.com" />
                  </div>
                )}
                {destination && (
                  <Button onClick={handleDestinationSelect} className="w-full">
                    {t("UI_CONTINUE")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("UI_AI_ENRICHMENT")}</CardTitle>
                <CardDescription>{t("UI_AI_OPTIONS")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="seo" className="rounded" defaultChecked />
                  <Label htmlFor="seo">{t("LABEL_SEO")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="images" className="rounded" />
                  <Label htmlFor="images">{t("LABEL_IA_IMAGES")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="links" className="rounded" defaultChecked />
                  <Label htmlFor="links">{t("LABEL_INTERNAL_LINKS")}</Label>
                </div>
                <Button onClick={handleSync} className="w-full">
                  <Zap className="w-4 h-4 mr-2" />
                  {t("UI_START_SYNC")}
                </Button>
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("UI_SYNC_IN_PROGRESS")}</CardTitle>
                <CardDescription>{t("UI_DO_NOT_CLOSE")}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t("UI_LOG_CONSOLE")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-card text-primary p-4 rounded-lg h-[400px] overflow-y-auto font-mono text-sm border">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">{t("UI_WAITING")}</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    <span className="text-muted-foreground">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>{" "}
                    <span className={
                      log.status === "error" ? "text-destructive" :
                      log.status === "warning" ? "text-yellow-500" :
                      log.status === "success" ? "text-green-500" :
                      "text-blue-500"
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