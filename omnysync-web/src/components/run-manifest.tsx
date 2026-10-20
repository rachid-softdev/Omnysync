import {
  Check,
  FileText,
  Globe,
  LayoutTemplate,
  RefreshCw,
  ShoppingBag,
  Workflow,
} from 'lucide-react'

const DESTINATIONS = [
  { name: 'WordPress', meta: '1.2s', icon: Globe, done: true },
  { name: 'Ghost', meta: '0.8s', icon: LayoutTemplate, done: true },
  { name: 'Webflow', meta: '1.4s', icon: Workflow, done: true },
  { name: 'Shopify', meta: '62%', icon: ShoppingBag, done: false },
]

const PIPELINE = [
  { label: 'parse', meta: '0.4s' },
  { label: 'enrich', meta: '1.8s' },
  { label: 'publish', meta: '10.2s' },
] as const

type RunManifestLabels = {
  console: string
  live: string
  source: string
  destinations: string
  parse: string
  enrich: string
  publish: string
  synced: string
  syncing: string
  errors: string
  duration: string
}

/**
 * A compact run ledger for the marketing demo. It describes the same route as
 * the hero map, but at the level of a single execution: source, pipeline,
 * destinations and timing.
 */
export function RunManifest({ labels }: { labels: RunManifestLabels }) {
  return (
    <aside className="relative flex h-full flex-col overflow-hidden bg-sidebar p-5 text-sidebar-foreground sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--sidebar-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--sidebar-border)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.18] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,black,transparent)]"
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em]">
          <span className="inline-flex items-center gap-2 text-sidebar-primary">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-pulse-soft rounded-full bg-success opacity-50" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            {labels.live}
          </span>
          <span className="text-sidebar-foreground/35">{labels.console} · #2841</span>
        </div>

        <div className="mt-6 border border-sidebar-border bg-white/[0.03] p-3">
          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/35">
            <span>{labels.source}</span>
            <span className="text-success">read</span>
          </div>
          <div className="mt-2.5 flex items-start gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center border border-sidebar-border text-sidebar-foreground/60">
              <FileText className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-sidebar-foreground">
                launch-notes.md
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-sidebar-foreground/35">
                Google Docs · 1,284w
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          {PIPELINE.map((stage, index) => (
            <div key={stage.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="grid size-5 place-items-center border border-sidebar-border bg-sidebar-accent font-mono text-[9px] text-sidebar-foreground/60">
                  {index + 1}
                </span>
                {index < PIPELINE.length - 1 && (
                  <span className="h-5 w-px bg-sidebar-border" aria-hidden="true" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pb-3">
                <p className="text-[12px] leading-5 text-sidebar-foreground/75">
                  {labels[stage.label]}
                </p>
                <span className="shrink-0 font-mono text-[9px] text-sidebar-foreground/35">
                  {stage.meta}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-1 border-t border-sidebar-border pt-4">
          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/35">
            <span>{labels.destinations}</span>
            <span>04</span>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {DESTINATIONS.map((destination) => {
              const Icon = destination.icon
              return (
                <li key={destination.name} className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center border border-sidebar-border text-sidebar-foreground/55">
                    <Icon className="size-3" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-sidebar-foreground/75">
                    {destination.name}
                  </span>
                  {destination.done ? (
                    <Check className="size-3 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <RefreshCw
                      className="size-3 shrink-0 animate-spin text-sidebar-primary"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-[9px] ${
                      destination.done ? 'text-success' : 'text-sidebar-foreground/35'
                    }`}
                  >
                    {destination.done ? labels.synced : labels.syncing}
                  </span>
                  <span className="w-7 shrink-0 text-right font-mono text-[9px] text-sidebar-foreground/35">
                    {destination.meta}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-sidebar-border pt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-sidebar-foreground/35">
          <span className="text-success">00 {labels.errors}</span>
          <span className="inline-flex items-center gap-2">
            <span>{labels.duration}</span>
            <span className="text-sidebar-foreground/70">12.4s</span>
          </span>
        </div>
      </div>
    </aside>
  )
}
