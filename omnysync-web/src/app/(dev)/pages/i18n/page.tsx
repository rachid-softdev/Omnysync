import { notFound } from 'next/navigation'
import { DevBadge } from '@/components/dev/DevBadge'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import en from '@/lib/i18n/en.json'
import fr from '@/lib/i18n/fr.json'

export default function DevI18nPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  const enKeys = Object.keys(en).sort()
  const frKeys = Object.keys(fr).sort()
  const allKeys = Array.from(new Set([...enKeys, ...frKeys])).sort()

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <Link
          href="/dev/pages"
          className="mb-4 inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#0f172a]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dev Hub
        </Link>
        <DevBadge label="i18n" />
        <h1 className="mt-4 text-3xl font-bold text-[#0f172a]">Translation Explorer</h1>
        <p className="mt-2 text-[#64748b]">
          Side-by-side EN / FR comparison — {allKeys.length} keys total
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e2e8f0]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className="px-4 py-3 text-left font-semibold text-[#0f172a]">Key</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0f172a]">EN</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0f172a]">FR</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.map((key) => {
              const enVal = (en as Record<string, string>)[key]
              const frVal = (fr as Record<string, string>)[key]
              const missingEn = !enVal
              const missingFr = !frVal

              return (
                <tr
                  key={key}
                  className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f8fafc]/50"
                >
                  <td className="px-4 py-2 font-mono text-xs text-[#0064e0]">{key}</td>
                  <td
                    className={`px-4 py-2 ${missingEn ? 'text-[#ef4444] italic' : 'text-[#0f172a]'}`}
                  >
                    {enVal ?? '— missing —'}
                  </td>
                  <td
                    className={`px-4 py-2 ${missingFr ? 'text-[#ef4444] italic' : 'text-[#0f172a]'}`}
                  >
                    {frVal ?? '— missing —'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
