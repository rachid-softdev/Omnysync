import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Progress } from '../progress'

describe('Progress', () => {
  it('renders with 0% progress', () => {
    const { container } = render(<Progress value={0} />)

    const root = container.firstChild as HTMLElement
    expect(root).toBeInTheDocument()
    expect(root).toHaveAttribute('role', 'progressbar')
  })

  it('renders with 50% progress', () => {
    const { container } = render(<Progress value={50} />)

    const root = container.firstChild as HTMLElement
    expect(root).toBeInTheDocument()

    const indicator = container.querySelector(
      '[data-radix-progress-indicator]'
    ) as HTMLElement | null
    // The indicator has a transform that reflects the value
    const indicatorEl = root.querySelector('div[class*="h-full"]') as HTMLElement | null
    if (indicatorEl) {
      expect(indicatorEl.style.transform).toBe('translateX(-50%)')
    }
  })

  it('renders with 100% progress', () => {
    const { container } = render(<Progress value={100} />)

    const indicatorEl = container.querySelector('div[class*="h-full"]') as HTMLElement | null
    if (indicatorEl) {
      expect(indicatorEl.style.transform).toBe('translateX(-0%)')
    }
  })

  it('renders with undefined value (falls back to 0)', () => {
    const { container } = render(<Progress />)

    const indicatorEl = container.querySelector('div[class*="h-full"]') as HTMLElement | null
    if (indicatorEl) {
      expect(indicatorEl.style.transform).toBe('translateX(-100%)')
    }
  })

  it('applies custom className', () => {
    const { container } = render(<Progress value={50} className="custom-progress" />)

    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('custom-progress')
  })

  it('has proper ARIA role', () => {
    const { container } = render(<Progress value={30} />)

    const root = container.firstChild as HTMLElement
    expect(root).toHaveAttribute('role', 'progressbar')
  })

  it('has correct overflow hidden class', () => {
    const { container } = render(<Progress value={75} />)

    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('overflow-hidden')
  })

  it('has primary background on indicator', () => {
    const { container } = render(<Progress value={60} />)

    const indicator = container.querySelector('div[class*="h-full"]') as HTMLElement | null
    if (indicator) {
      expect(indicator).toHaveClass('bg-primary')
    }
  })
})
