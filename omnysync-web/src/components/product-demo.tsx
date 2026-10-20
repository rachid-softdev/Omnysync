'use client'

import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
    <figure>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        {/* Window chrome, matching the hero mockup. */}
        <div className="flex h-10 items-center gap-2 border-b border-border bg-muted/50 px-3.5">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <div className="mx-auto flex h-6 w-64 items-center justify-center rounded-md border border-border bg-background text-[10px] text-muted-foreground">
            {url}
          </div>
        </div>

        <div className="relative aspect-video bg-muted">
          <video
            ref={videoRef}
            className="size-full object-cover"
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
          <span className="text-xs text-muted-foreground">{silentLabel}</span>
          <button
            type="button"
            onClick={togglePlayback}
            aria-label={playing ? pauseLabel : playLabel}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {playing ? (
              <Pause className="size-3.5" aria-hidden="true" />
            ) : (
              <Play className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <a
          href={fallbackHref}
          className="text-xs text-muted-foreground underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline"
        >
          {fallbackLabel}
        </a>
      </div>

      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  )
}
