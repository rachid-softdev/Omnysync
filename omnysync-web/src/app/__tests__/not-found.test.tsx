import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotFound from '../not-found'

describe('NotFound page', () => {
  it('renders 404 heading', async () => {
    render(await NotFound())
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('renders page not found message', async () => {
    render(await NotFound())
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  it('renders navigation links', async () => {
    render(await NotFound())
    expect(screen.getByText('Go back home')).toBeInTheDocument()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('renders helpful message', async () => {
    render(await NotFound())
    expect(screen.getByText(/couldn't find the page/i)).toBeInTheDocument()
  })
})
