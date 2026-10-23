import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProductDemo } from '../product-demo'

const baseProps = {
  src: '/demo.mp4',
  poster: '/demo-poster-en.webp',
  url: 'app.omnysync.com/dashboard',
  label: 'Product demo video',
  playLabel: 'Play demo',
  pauseLabel: 'Pause demo',
  silentLabel: 'Silent demo',
  fallbackHref: '/demo.mp4',
  fallbackLabel: 'Download the video',
}

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
}

let playSpy: ReturnType<typeof vi.spyOn>
let pauseSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mockMatchMedia(false)
  playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ProductDemo', () => {
  it('renders the video, fallback link and caption', () => {
    render(<ProductDemo {...baseProps} />)

    const video = screen.getByLabelText('Product demo video')
    expect(video).toHaveAttribute('poster', '/demo-poster-en.webp')
    expect(video.querySelector('source')).toHaveAttribute('src', '/demo.mp4')
    expect(video.querySelector('source')).toHaveAttribute('type', 'video/mp4')

    expect(screen.getByText('app.omnysync.com/dashboard')).toBeInTheDocument()
    expect(screen.getByText('Silent demo')).toBeInTheDocument()

    const fallback = screen.getByRole('link', { name: 'Download the video' })
    expect(fallback).toHaveAttribute('href', '/demo.mp4')
  })

  it('toggles between play and pause from the control button', () => {
    render(<ProductDemo {...baseProps} />)

    const video = screen.getByLabelText('Product demo video')
    const playButton = screen.getByRole('button', { name: 'Play demo' })

    fireEvent.click(playButton)
    expect(playSpy).toHaveBeenCalledTimes(1)

    // The media element drives the button state, not the click handler.
    fireEvent.play(video)
    expect(screen.getByRole('button', { name: 'Pause demo' })).toBeInTheDocument()

    Object.defineProperty(video, 'paused', { configurable: true, get: () => false })
    fireEvent.click(screen.getByRole('button', { name: 'Pause demo' }))
    expect(pauseSpy).toHaveBeenCalledTimes(1)

    fireEvent.pause(video)
    expect(screen.getByRole('button', { name: 'Play demo' })).toBeInTheDocument()
  })

  it('does not autoplay when reduced motion is preferred', () => {
    mockMatchMedia(true)

    render(<ProductDemo {...baseProps} />)

    expect(playSpy).not.toHaveBeenCalled()
  })

  it('renders without crashing when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)

    expect(() => render(<ProductDemo {...baseProps} />)).not.toThrow()
    expect(screen.getByLabelText('Product demo video')).toBeInTheDocument()
    expect(playSpy).not.toHaveBeenCalled()
  })
})
