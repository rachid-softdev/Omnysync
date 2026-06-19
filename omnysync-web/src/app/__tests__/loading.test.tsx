/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Loading from '../loading'

describe('Loading page', () => {
  it('renders loading indicator', () => {
    render(<Loading />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders spinning icon', () => {
    const { container } = render(<Loading />)
    const svg = container.querySelector('svg.animate-spin')
    expect(svg).toBeInTheDocument()
  })
})
