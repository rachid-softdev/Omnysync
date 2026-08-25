import { notFound } from 'next/navigation'
import { DevBadge } from '@/components/dev/DevBadge'
import Link from 'next/link'

export default function Dev404PreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8">
        <DevBadge />
        <h1 className="mt-4 text-3xl font-bold text-[#0f172a]">404 Page Preview</h1>
        <p className="mt-2 text-[#64748b]">
          This is the production 404 page rendered inline for preview.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2">
          <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
          <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
          <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
          <span className="ml-2 text-xs font-medium text-[#64748b]">not-found.tsx</span>
        </div>
        <div className="flex min-h-[500px] flex-col items-center justify-center p-6">
          <h1 className="text-9xl font-bold text-[#0064e0]">404</h1>
          <h2 className="mt-4 text-2xl font-semibold">Page not found</h2>
          <p className="mt-2 text-[#64748b]">
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/dev/pages"
              className="inline-flex items-center justify-center rounded-full bg-[#0064e0] px-6 py-3 text-sm font-medium text-white hover:bg-[#0064e0]/90"
            >
              Back to Dev Hub
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
