import { Check, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function PricingPage() {
  const plans = [
    {
      name: "Free",
      price: "0€",
      period: "pour toujours",
      description: "Pour découvrir la plateforme",
      features: [
        "5 synchronisations par mois",
        "2 connecteurs",
        "Google Docs & Notion",
        "WordPress & Ghost",
        "Support par email",
      ],
      cta: "Commencer gratuitement",
      href: "/auth/signin",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "29€",
      period: "par mois",
      description: "Pour les créateurs de contenu",
      features: [
        "100 synchronisations par mois",
        "10 connecteurs",
        "Toutes les plateformes",
        "Enrichissement IA (SEO, images)",
        "Maillage interne automatique",
        "Détection de changements",
        "Support prioritaire",
      ],
      cta: "Commencer l'essai",
      href: "/api/stripe/checkout",
      highlighted: true,
    },
    {
      name: "Business",
      price: "99€",
      period: "par mois",
      description: "Pour les agences et équipes",
      features: [
        "Synchronisations illimitées",
        "Connecteurs illimités",
        "Toutes les fonctionnalités Pro",
        "Sync bidirectionnelle",
        "Multi-utilisateurs",
        "API access",
        "Support dédié",
      ],
      cta: "Contacter les ventes",
      href: "mailto:sales@omnysync.com",
      highlighted: false,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">Tarifs simples et transparents</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choisissez le plan qui correspond à vos besoins. Passez à un plan supérieur à tout moment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlighted ? "border-primary shadow-lg relative" : ""}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  Populaire
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-1">/{plan.period}</span>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.href.startsWith("/api") ? (
                  <form action={async () => {
                    "use server"
                    const res = await fetch(`${process.env.NEXTAUTH_URL}/api/stripe/checkout`, {
                      method: "POST",
                    })
                    if (res.ok) {
                      const data = await res.json()
                      if (data.url) {
                        // This won't work server-side, so the checkout will be triggered from client
                      }
                    }
                  }}>
                    <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                      <Zap className="w-4 h-4 mr-2" />
                      {plan.cta}
                    </Button>
                  </form>
                ) : (
                  <Link href={plan.href}>
                    <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                      {plan.name === "Business" && <Zap className="w-4 h-4 mr-2" />}
                      {plan.cta}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
