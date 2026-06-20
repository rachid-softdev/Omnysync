import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Avatar, AvatarImage, AvatarFallback } from '../avatar'

describe('Avatar', () => {
  it('renders with fallback initials', () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders with AvatarImage in jsdom (image hidden, fallback visible)', () => {
    render(
      <Avatar>
        <AvatarImage src="/avatar.jpg" alt="User avatar" />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    )

    // In jsdom, images don't load so Radix keeps img hidden (role=img not findable)
    // The fallback text is visible
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('shows fallback text when image src is provided', () => {
    render(
      <Avatar>
        <AvatarImage src="/photo.png" alt="Photo" />
        <AvatarFallback>FB</AvatarFallback>
      </Avatar>
    )

    expect(screen.getByText('FB')).toBeInTheDocument()
  })

  it('applies custom className to Avatar root', () => {
    const { container } = render(
      <Avatar className="custom-avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
    )

    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('custom-avatar')
    expect(root).toHaveClass('rounded-full')
  })

  it('applies custom className to AvatarFallback', () => {
    render(
      <Avatar>
        <AvatarFallback className="custom-fallback">FB</AvatarFallback>
      </Avatar>
    )

    expect(screen.getByText('FB')).toHaveClass('custom-fallback')
  })

  it('renders without image gracefully', () => {
    render(
      <Avatar>
        <AvatarFallback>NN</AvatarFallback>
      </Avatar>
    )

    expect(screen.getByText('NN')).toBeInTheDocument()
  })

  it('has proper displayName', () => {
    expect(Avatar.displayName).toBeDefined()
    expect(AvatarImage.displayName).toBeDefined()
    expect(AvatarFallback.displayName).toBeDefined()
  })
})
