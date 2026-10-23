import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignInPage from '../../auth/signin/page'

const mockSignIn = vi.fn()

vi.mock('next-auth/react', () => ({
  signIn: (...args: any[]) => mockSignIn(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SignInPage', () => {
  it('renders the magic-link form by default', () => {
    render(<SignInPage />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByText('Send sign-in link')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('renders the Google sign-in button', () => {
    render(<SignInPage />)
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
  })

  it('requires an email address before sending a link', () => {
    render(<SignInPage />)
    fireEvent.click(screen.getByText('Send sign-in link'))
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('rejects an invalid email address', () => {
    render(<SignInPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByText('Send sign-in link'))
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('sends a magic link and shows the inbox confirmation', async () => {
    mockSignIn.mockResolvedValueOnce({ ok: true, error: undefined })

    render(<SignInPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } })
    fireEvent.click(screen.getByText('Send sign-in link'))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('resend', {
        email: 'test@test.com',
        redirect: false,
        callbackUrl: '/dashboard',
      })
    })

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument()
    expect(screen.getByText('test@test.com')).toBeInTheDocument()
  })

  it('shows an error when the magic link cannot be sent', async () => {
    mockSignIn.mockResolvedValueOnce({ error: 'Configuration' })

    render(<SignInPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } })
    fireEvent.click(screen.getByText('Send sign-in link'))

    expect(
      await screen.findByText('Unable to send the sign-in link. Please try again.')
    ).toBeInTheDocument()
  })

  it('lets the user try another email after sending', async () => {
    mockSignIn.mockResolvedValueOnce({ ok: true, error: undefined })

    render(<SignInPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } })
    fireEvent.click(screen.getByText('Send sign-in link'))

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Use another address'))

    expect(screen.getByText('Send sign-in link')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })

  it('starts Google OAuth with the dashboard callback', async () => {
    render(<SignInPage />)
    fireEvent.click(screen.getByText('Continue with Google'))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/dashboard' })
    })
  })

  it('renders the Omnysync brand link', () => {
    render(<SignInPage />)
    expect(screen.getByText('Omnysync')).toBeInTheDocument()
  })
})
