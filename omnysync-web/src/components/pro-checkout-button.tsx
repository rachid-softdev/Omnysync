'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/useTranslations'

export function ProCheckoutButton({ label }: { label: string }) {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        router.push('/auth/signin')
      }
    } catch {
      router.push('/auth/signin')
    }
  }

  return (
    <Button className="w-full rounded-full" onClick={handleCheckout} disabled={loading}>
      <Zap className="w-4 h-4 mr-2" />
      {loading ? t('UI_REDIRECTING') : label}
    </Button>
  )
}
