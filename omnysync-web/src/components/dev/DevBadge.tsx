export function DevBadge({ label = 'DEV' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0064e0]/10 px-3 py-1 text-xs font-semibold text-[#0064e0] ring-1 ring-[#0064e0]/20">
      <span className="h-1.5 w-1.5 rounded-full bg-[#0064e0] animate-pulse" />
      {label}
    </span>
  )
}
