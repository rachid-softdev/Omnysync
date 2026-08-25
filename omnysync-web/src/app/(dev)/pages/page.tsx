import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DevBadge } from '@/components/dev/DevBadge'
import { PagePreview } from '@/components/dev/PagePreview'
import { FileText, Zap, Globe, Shield, Package } from 'lucide-react'

const links = [
  {
    title: '404 Page Preview',
    description: 'Production not-found page rendered inline',
    href: '/dev/404-preview',
    icon: FileText,
    color: '#ef4444',
  },
  {
    title: 'Brand Tokens',
    description: 'Palette, typography, CSS variables, connector icons',
    href: '/dev/brand',
    icon: Zap,
    color: '#0064e0',
  },
  {
    title: 'i18n Explorer',
    description: 'Side-by-side EN / FR translation comparison',
    href: '/dev/pages/i18n',
    icon: Globe,
    color: '#0ea5e9',
  },
]

const stateCards = [
  { label: 'Default', bg: 'bg-white', border: 'border-[#e2e8f0]', text: 'text-[#0f172a]' },
  { label: 'Surface', bg: 'bg-[#f8fafc]', border: 'border-[#e2e8f0]', text: 'text-[#0f172a]' },
  { label: 'Primary', bg: 'bg-[#0064e0]', border: 'border-[#0064e0]', text: 'text-white' },
  { label: 'Muted', bg: 'bg-[#64748b]', border: 'border-[#64748b]', text: 'text-white' },
]

const techDetails = [
  { icon: Shield, label: 'CSRF + Rate Limiting', value: 'Middleware' },
  { icon: Zap, label: 'Rendering', value: 'Next.js App Router' },
  { icon: Package, label: 'CSS', value: 'Tailwind CSS v4' },
  { icon: Globe, label: 'i18n', value: 'EN / FR (JSON)' },
]

export default function DevHubPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10">
        <DevBadge />
        <h1 className="mt-4 text-3xl font-bold text-[#0f172a]">Developer Hub</h1>
        <p className="mt-2 text-[#64748b]">
          Internal preview pages, brand tokens, and translation explorer.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-[#0f172a]">Quick Links</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-white p-5 transition-colors hover:border-[#0064e0]/30 hover:shadow-sm"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${link.color}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color: link.color }} />
                </div>
                <div>
                  <p className="font-semibold text-[#0f172a] group-hover:text-[#0064e0]">
                    {link.title}
                  </p>
                  <p className="mt-1 text-sm text-[#64748b]">{link.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-[#0f172a]">State Previews</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stateCards.map((card) => (
            <div key={card.label} className={`rounded-lg border ${card.border} ${card.bg} p-4`}>
              <p className={`text-sm font-medium ${card.text}`}>{card.label}</p>
              <p className={`mt-1 font-mono text-xs ${card.text} opacity-60`}>
                {card.bg === 'bg-white'
                  ? '#ffffff'
                  : card.bg === 'bg-[#f8fafc]'
                    ? '#f8fafc'
                    : card.bg === 'bg-[#0064e0]'
                      ? '#0064e0'
                      : '#64748b'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-[#0f172a]">Page Preview</h2>
        <PagePreview src="/dev/404-preview" title="404 Preview" />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#0f172a]">Technical Details</h2>
        <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
          <dl>
            {techDetails.map((detail, i) => {
              const Icon = detail.icon
              return (
                <div
                  key={detail.label}
                  className={`flex items-center justify-between px-5 py-3 ${i < techDetails.length - 1 ? 'border-b border-[#e2e8f0]' : ''}`}
                >
                  <dt className="flex items-center gap-2 text-sm text-[#0f172a]">
                    <Icon className="h-4 w-4 text-[#64748b]" />
                    {detail.label}
                  </dt>
                  <dd className="font-mono text-xs text-[#64748b]">{detail.value}</dd>
                </div>
              )
            })}
          </dl>
        </div>
      </section>
    </div>
  )
}
