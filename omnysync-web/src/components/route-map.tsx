'use client'

import {
  Check,
  FileText,
  Globe,
  LayoutTemplate,
  RefreshCw,
  ShoppingBag,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n/useTranslations'

type Tone = 'light' | 'dark'

const DESTINATIONS = [
  { name: 'WordPress', meta: '1.2s', icon: Globe, top: 14, done: true },
  { name: 'Ghost', meta: '0.8s', icon: LayoutTemplate, top: 38, done: true },
  { name: 'Webflow', meta: '1.4s', icon: Workflow, top: 62, done: true },
  { name: 'Shopify', meta: '62%', icon: ShoppingBag, top: 86, done: false },
]

const ROUTES = [
  'M39 50 C48 50 49 14 60 14',
  'M39 50 C48 50 49 38 60 38',
  'M39 50 C48 50 49 62 60 62',
  'M39 50 C48 50 49 86 60 86',
]

/**
 * The product in one picture: one source document routed to four destinations.
 * Used in the marketing hero and the auth console. Decorative for screen readers.
 */
export function RouteMap({ tone = 'light', className }: { tone?: Tone; className?: string }) {
  const dark = tone === 'dark'
  const { t } = useTranslations()

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-[3px] border p-4 sm:p-5',
        dark ? 'border-white/10 bg-[#07111d]' : 'border-border bg-card',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-40" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.16em]',
              dark ? 'text-white/50' : 'text-muted-foreground'
            )}
          >
            {t('route_live_run')}
          </span>
        </div>
        <span
          className={cn('font-mono text-[10px]', dark ? 'text-white/35' : 'text-muted-foreground')}
        >
          #2841
        </span>
      </div>

      <div className="relative mt-5 aspect-[4/3] w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {ROUTES.map((d, index) => (
            <g key={d}>
              <path
                d={d}
                fill="none"
                stroke={dark ? 'rgba(255,255,255,0.14)' : 'var(--border-strong)'}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={d}
                fill="none"
                stroke={dark ? 'var(--signal)' : 'var(--primary)'}
                strokeWidth="1.4"
                strokeDasharray="1 4"
                strokeLinecap="square"
                vectorEffect="non-scaling-stroke"
                className="route-dash"
                style={{ animationDelay: `${index * 180}ms` }}
              />
            </g>
          ))}
        </svg>

        {/* Source node */}
        <div
          className={cn(
            'absolute left-0 top-1/2 w-[39%] -translate-y-1/2 rounded-[3px] border p-2.5',
            dark ? 'border-white/10 bg-white/[0.05]' : 'border-border bg-background'
          )}
        >
          <div className="flex items-start gap-2">
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-[2px] border',
                dark ? 'border-white/10 text-white/70' : 'border-border text-muted-foreground'
              )}
            >
              <FileText className="size-3" />
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate text-[11px] font-medium',
                  dark ? 'text-white/85' : 'text-foreground'
                )}
              >
                launch-notes.md
              </p>
              <p
                className={cn(
                  'mt-0.5 truncate font-mono text-[9px]',
                  dark ? 'text-white/35' : 'text-muted-foreground'
                )}
              >
                Google Docs · {t('route_words')}
              </p>
            </div>
          </div>
          <div className={cn('mt-2 border-t pt-2', dark ? 'border-white/10' : 'border-border')}>
            <span
              className={cn(
                'font-mono text-[9px] uppercase tracking-[0.12em]',
                dark ? 'text-white/35' : 'text-muted-foreground'
              )}
            >
              {t('route_source')}
            </span>
          </div>
        </div>

        {/* Destination nodes */}
        {DESTINATIONS.map((destination) => {
          const Icon = destination.icon
          return (
            <div
              key={destination.name}
              className={cn(
                'absolute right-0 flex w-[40%] -translate-y-1/2 items-center gap-1.5 rounded-[3px] border px-2 py-2',
                dark ? 'border-white/10 bg-white/[0.05]' : 'border-border bg-background'
              )}
              style={{ top: `${destination.top}%` }}
            >
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-[2px] border',
                  dark ? 'border-white/10 text-white/65' : 'border-border text-muted-foreground'
                )}
              >
                <Icon className="size-3" />
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[10px] font-medium',
                  dark ? 'text-white/80' : 'text-foreground'
                )}
              >
                {destination.name}
              </span>
              {destination.done ? (
                <Check className="size-3 shrink-0 text-success" />
              ) : (
                <RefreshCw className="size-3 shrink-0 animate-spin text-info" />
              )}
              <span
                className={cn(
                  'font-mono text-[9px]',
                  destination.done
                    ? 'text-success'
                    : dark
                      ? 'text-white/40'
                      : 'text-muted-foreground'
                )}
              >
                {destination.meta}
              </span>
            </div>
          )
        })}
      </div>

      <div
        className={cn(
          'mt-4 flex items-center justify-between border-t pt-3 font-mono text-[9px] uppercase tracking-[0.12em]',
          dark ? 'border-white/10 text-white/35' : 'border-border text-muted-foreground'
        )}
      >
        <span>
          4 {t('route_destinations')} · {t('route_duration')}
        </span>
        <span className="text-success">{t('route_errors')}</span>
      </div>
    </div>
  )
}
