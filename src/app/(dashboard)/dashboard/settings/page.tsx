import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

async function updateProfile(formData: FormData) {
  "use server"

  const session = await auth()
  if (!session?.user?.id) return

  const name = formData.get("name") as string

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  })

  revalidatePath("/dashboard/settings")
}

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("UI_SETTINGS")}</h1>
        <p className="text-muted-foreground mt-1">{t("UI_PREFERENCES")}</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("UI_PROFILE")}</CardTitle>
            <CardDescription>{t("UI_PROFILE_DESC")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("UI_NAME")}</Label>
                <Input id="name" name="name" defaultValue={user?.name || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("UI_EMAIL")}</Label>
                <Input id="email" value={user?.email || ""} disabled />
              </div>
              <Button type="submit">{t("UI_SAVE")}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("UI_API_KEYS")}</CardTitle>
            <CardDescription>{t("UI_API_KEYS_DESC")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai">{t("UI_OPENAI_KEY")}</Label>
              <Input id="openai" type="password" placeholder="sk-..." value="••••••••" disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qstash">{t("UI_QSTASH_TOKEN")}</Label>
              <Input id="qstash" type="password" placeholder="Token QStash" value="••••••••" disabled />
            </div>
            <p className="text-xs text-muted-foreground">
              Les clés API sont configurées via les variables d&apos;environnement du serveur.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
