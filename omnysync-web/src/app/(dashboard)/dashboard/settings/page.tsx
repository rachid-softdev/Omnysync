"use client"

import { useState } from "react"
import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useTranslations } from "@/lib/i18n/useTranslations"
import { 
  User, 
  Key, 
  Bell, 
  CreditCard, 
  Shield, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Building,
  Mail,
  Globe
} from "lucide-react"

interface UserData {
  id: string
  name: string | null
  email: string | null
  image: string | null
  createdAt: Date
}

export default function SettingsPage() {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState("")
  const [notifications, setNotifications] = useState({
    syncSuccess: true,
    syncFailed: true,
    weeklyDigest: false,
    teamInvites: true,
  })
  
  // API Keys (simulées)
  const [apiKeys] = useState([
    { id: "1", name: "Production API Key", createdAt: "2026-01-15", lastUsed: "2026-05-10" },
  ])

  const handleSave = async () => {
    setLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("UI_SETTINGS")}</h1>
        <p className="text-muted-foreground mt-1">{t("UI_PREFERENCES")}</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="w-4 h-4 mr-2" />
            Abonnement
          </TabsTrigger>
          <TabsTrigger value="api">
            <Key className="w-4 h-4 mr-2" />
            API
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Informations du profil</CardTitle>
                <CardDescription>Gérez vos informations personnelles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6 mb-6">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src="/placeholder-avatar.jpg" />
                    <AvatarFallback className="text-2xl">U</AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm">Changer la photo</Button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou GIF. Max 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom complet</Label>
                    <Input 
                      id="name" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Votre nom"
                    />
                  </div>
                  <div className="space-y-2">
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

                <div className="space-y-2">
                  <Label>Organisation actuelle</Label>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Building className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Mon Organisation</p>
                      <p className="text-xs text-muted-foreground">Plan Pro</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {saved && <CheckCircle className="w-4 h-4 mr-2" />}
                    {saved ? "Sauvegardé!" : "Enregistrer"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Zone dangereuse</CardTitle>
                <CardDescription>Actions irréversibles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Supprimer mon compte</p>
                    <p className="text-sm text-muted-foreground">
                      Cette action est irréversible. Toutes vos données seront perdues.
                    </p>
                  </div>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Mot de passe</CardTitle>
                <CardDescription>Modifiez votre mot de passe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Mot de passe actuel</Label>
                  <Input id="current-password" type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input id="new-password" type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                  <Input id="confirm-password" type="password" placeholder="••••••••" />
                </div>
                <Button>Mettre à jour le mot de passe</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Authentification à deux facteurs</CardTitle>
                <CardDescription>Ajoutez une couche de sécurité supplémentaire</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Shield className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="font-medium">2FA désactivé</p>
                      <p className="text-sm text-muted-foreground">
                        Protégez votre compte avec l'authentification
                      </p>
                    </div>
                  </div>
                  <Button variant="outline">Activer</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sessions actives</CardTitle>
                <CardDescription>Gérez vos sessions de connexion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Chrome - Windows</p>
                        <p className="text-xs text-muted-foreground">Dernière activité: Il y a 5 minutes</p>
                      </div>
                    </div>
                    <Badge variant="outline">Actuelle</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Safari - macOS</p>
                        <p className="text-xs text-muted-foreground">Dernière activité: Il y a 3 jours</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive">
                      Révoquer
                    </Button>
                  </div>
                </div>
                <Button variant="outline" className="mt-4 w-full">
                  Déconnecter toutes les autres sessions
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <div className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Notifications par email</CardTitle>
                <CardDescription>Choisissez ce que vous souhaitez recevoir</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Synchronisation réussie</p>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un email quand un document est synchronisé
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.syncSuccess}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, syncSuccess: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Échec de synchronisation</p>
                    <p className="text-sm text-muted-foreground">
                      Être notifié immédiatement en cas d'erreur
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.syncFailed}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, syncFailed: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Résumé hebdomadaire</p>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un résumé de l'activité de la semaine
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.weeklyDigest}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, weeklyDigest: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Invitations d'équipe</p>
                    <p className="text-sm text-muted-foreground">
                      Notifications quand quelqu'un rejoint votre organisation
                    </p>
                  </div>
                  <Switch 
                    checked={notifications.teamInvites}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, teamInvites: checked }))}
                  />
                </div>
                <Button className="mt-4" onClick={handleSave} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enregistrer les préférences
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <div className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Abonnement actuel</CardTitle>
                <CardDescription>Gérez votre plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold">Plan Pro</p>
                      <Badge>Actif</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">29€/mois - renovación le 15 juin 2026</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Changer de plan</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Utilisation</CardTitle>
                <CardDescription>Votre consommation ce mois-ci</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Documents</span>
                    <span className="text-muted-foreground">45 / 100</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: "45%" }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Synchronisations</span>
                    <span className="text-muted-foreground">67 / 100</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: "67%" }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Connecteurs</span>
                    <span className="text-muted-foreground">6 / 10</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: "60%" }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Historique des factures</CardTitle>
                <CardDescription>Téléchargez vos factures</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { date: "15 mai 2026", amount: "29,00€", status: "Paid" },
                    { date: "15 avril 2026", amount: "29,00€", status: "Paid" },
                    { date: "15 mars 2026", amount: "29,00€", status: "Paid" },
                  ].map((invoice, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{invoice.date}</p>
                        <p className="text-sm text-muted-foreground">{invoice.amount}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-500">{invoice.status}</Badge>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Tab */}
        <TabsContent value="api">
          <div className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Clés API</CardTitle>
                <CardDescription>Gérez les clés pour l'intégration externe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Utilisez les clés API pour intégrer Omnysync avec vos propres applications.
                  </p>
                  <Button>
                    <Key className="w-4 h-4 mr-2" />
                    Générer une clé
                  </Button>
                </div>

                <Separator />

                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Créée le {key.createdAt} - Dernière utilisation: {key.lastUsed}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">Copier</Button>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documentation API</CardTitle>
                <CardDescription>Référence complète des endpoints</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  La documentation complète de l'API est disponible sur notre site développeur.
                </p>
                <Button variant="outline">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Voir la documentation
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}