'use client'

export function PagePreview({ src, title }: { src: string; title: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-white">
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2">
        <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
        <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
        <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
        <span className="ml-2 text-xs font-medium text-[#64748b]">{title}</span>
      </div>
      <iframe src={src} title={title} className="h-[500px] w-full border-0" loading="lazy" />
    </div>
  )
}
