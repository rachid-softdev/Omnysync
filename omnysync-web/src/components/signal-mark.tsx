import { cn } from '@/lib/utils'

/**
 * Omnysync signal mark — two routes crossing a central node.
 * The geometry is intentionally squared off to match the 3px radius system.
 */
export function SignalMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn('size-4', className)}>
      <path
        d="M2.5 6.5h5.4a3.6 3.6 0 0 1 3.6 3.6v3.8a3.6 3.6 0 0 0 3.6 3.6h6.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="square"
      />
      <path
        d="M2.5 17.5h5.4a3.6 3.6 0 0 0 3.6-3.6v-3.8a3.6 3.6 0 0 1 3.6-3.6h6.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="square"
        opacity="0.5"
      />
      <rect x="10" y="10" width="4" height="4" fill="currentColor" />
    </svg>
  )
}

export function BrandLockup({
  tone = 'default',
  className,
}: {
  tone?: 'default' | 'sidebar'
  className?: string
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="grid size-7 shrink-0 place-items-center rounded-[3px] bg-primary text-primary-foreground">
        <SignalMark className="size-4" />
      </span>
      <span
        className={cn(
          'text-[15px] font-semibold tracking-[-0.01em]',
          tone === 'sidebar' ? 'text-sidebar-foreground' : 'text-foreground'
        )}
      >
        Omnysync
      </span>
    </span>
  )
}
