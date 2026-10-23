'use client'

import { ArrowUpRight, Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type ProductDemoProps = {
  src: string
  poster: string
  url: string
  label: string
  playLabel: string
  pauseLabel: string
  silentLabel: string
  fallbackHref: string
  fallbackLabel: string
  /** Drop the outer frame when the video is embedded in a larger panel. */
  flush?: boolean
}

export function ProductDemo({
  src,
  poster,
  url,
  label,
  playLabel,
  pauseLabel,
  silentLabel,
  fallbackHref,
  fallbackLabel,
  flush = false,
}: ProductDemoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const userPaused = useRef(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Respect reduced-motion preferences: never autoplay in that case.
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    // jsdom and older browsers do not expose IntersectionObserver.
    if (typeof window.IntersectionObserver !== 'function') return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return

        if (entry.isIntersecting) {
          if (!userPaused.current) {
            void video.play().catch(() => {})
          }
        } else {
          video.pause()
        }
      },
      { threshold: 0.35 }
    )

    observer.observe(video)

    return () => observer.disconnect()
  }, [])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      userPaused.current = false
      void video.play().catch(() => {})
    } else {
      userPaused.current = true
      video.pause()
    }
  }

  return (
    <figure className={cn('w-full', flush && 'h-full')}>
      <div
        className={cn(
          'flex flex-col overflow-hidden border border-border bg-card',
          flush ? 'h-full border-0' : 'shadow-sm'
        )}
      >
        {/* Recording chrome: the demo reads as captured product evidence. */}
        <div className="flex h-9 items-center gap-3 border-b border-border bg-muted/40 px-3.5">
          <span className="relative flex size-1.5" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-40" />
            <span className="relative inline-flex size-1.5 rounded-full bg-destructive" />
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            REC
          </span>
          <span className="mx-auto truncate font-mono text-[9px] text-muted-foreground">{url}</span>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:inline">
            {silentLabel}
          </span>
        </div>

        <div className={cn('relative bg-muted', flush ? 'min-h-[280px] flex-1' : 'aspect-video')}>
          <video
            ref={videoRef}
            className="absolute inset-0 size-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
            poster={poster}
            aria-label={label}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            <source src={src} type="video/mp4" />
          </video>
        </div>

        <div className="flex h-10 items-center justify-between border-t border-border px-3.5">
          <a
            href={fallbackHref}
            className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline"
          >
            {fallbackLabel}
            <ArrowUpRight className="size-2.5" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={playing ? pauseLabel : playLabel}
            className="inline-flex size-7 items-center justify-center rounded-[2px] border border-border bg-background text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {playing ? (
              <Pause className="size-3.5" aria-hidden="true" />
            ) : (
              <Play className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  )
}
