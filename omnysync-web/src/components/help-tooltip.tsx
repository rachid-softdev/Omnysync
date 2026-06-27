import { Info } from 'lucide-react'

interface HelpTooltipProps {
  text: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function HelpTooltip({ text, side = 'right' }: HelpTooltipProps) {
  const sideClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span className="relative inline-flex items-center group">
      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" aria-hidden="true" />
      <span className="sr-only">Help: {text}</span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute ${sideClasses[side]} w-56 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-50`}
      >
        {text}
      </span>
    </span>
  )
}
