import { notFound } from 'next/navigation'
import { DevBadge } from '@/components/dev/DevBadge'
import Link from 'next/link'
import { Globe, FileText, ShoppingBag, ArrowLeft, Check, Zap } from 'lucide-react'

const palette = [
  { name: 'Primary (Cobalt Blue)', value: '#0064e0', text: 'white' },
  { name: 'Secondary (Sky)', value: '#0ea5e9', text: 'white' },
  { name: 'Background', value: '#ffffff', text: '#0f172a' },
  { name: 'Surface', value: '#f8fafc', text: '#0f172a' },
  { name: 'Text', value: '#0f172a', text: 'white' },
  { name: 'Muted', value: '#64748b', text: 'white' },
  { name: 'Border', value: '#e2e8f0', text: '#0f172a' },
]

const connectors = [
  { name: 'WordPress', icon: Globe, color: '#21759b' },
  { name: 'Ghost', icon: Check, color: '#15171a' },
  { name: 'Webflow', icon: Zap, color: '#4353ff' },
  { name: 'Shopify', icon: ShoppingBag, color: '#96bf48' },
  { name: 'Google Docs', icon: FileText, color: '#4285f4' },
  { name: 'Notion', icon: FileText, color: '#000000' },
]

export default function DevBrandPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <Link
          href="/dev/pages"
          className="mb-4 inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#0f172a]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dev Hub
        </Link>
        <DevBadge label="BRAND" />
        <h1 className="mt-4 text-3xl font-bold text-[#0f172a]">Brand Tokens</h1>
        <p className="mt-2 text-[#64748b]">Omnysync visual identity reference.</p>
      </div>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-[#0f172a]">Palette</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {palette.map((color) => (
            <div key={color.value} className="overflow-hidden rounded-lg border border-[#e2e8f0]">
              <div className="flex h-24 items-end p-3" style={{ backgroundColor: color.value }}>
                <span className="text-xs font-mono font-medium" style={{ color: color.text }}>
                  {color.value}
                </span>
              </div>
              <div className="bg-white p-3">
                <p className="text-sm font-medium text-[#0f172a]">{color.name}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-[#0f172a]">Typography</h2>
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-6">
          <p className="font-sans text-4xl font-bold text-[#0f172a]">Inter</p>
          <p className="mt-2 text-[#64748b]">
            Primary typeface. Variable weight support from 100 to 900.
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-[#64748b]">
              <span className="font-mono text-xs text-[#0064e0]">--font-sans</span> —
              &quot;Inter&quot;, system-ui, sans-serif
            </p>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-[#0f172a]">CSS Variables</h2>
        <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
          <pre className="overflow-x-auto p-4 text-sm font-mono text-[#0f172a]">
            {`:root {
  --color-primary: #0064e0;
  --color-secondary: #0ea5e9;
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #0f172a;
  --color-muted: #64748b;
  --color-border: #e2e8f0;
}`}
          </pre>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-[#0f172a]">Connector Icons</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {connectors.map((connector) => {
            const Icon = connector.icon
            return (
              <div
                key={connector.name}
                className="flex flex-col items-center gap-3 rounded-lg border border-[#e2e8f0] bg-white p-6"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${connector.color}15` }}
                >
                  <Icon className="h-6 w-6" style={{ color: connector.color }} />
                </div>
                <span className="text-sm font-medium text-[#0f172a]">{connector.name}</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
