/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignInPage from '../../auth/signin/page'

const mockPush = vi.fn()
const mockSignIn = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next-auth/react', () => ({
  signIn: (...args: any[]) => mockSignIn(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('SignInPage', () => {
  it('renders sign-in form by default', () => {
    render(<SignInPage />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('switches to registration form', () => {
    render(<SignInPage />)
    fireEvent.click(screen.getByText('Sign up'))
    expect(screen.getByText('Create your account')).toBeInTheDocument()
    expect(screen.getByText('Create account')).toBeInTheDocument()
  })

  it('shows name field in registration mode', () => {
    render(<SignInPage />)
    fireEvent.click(screen.getByText('Sign up'))
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('shows forgot password link in login mode', () => {
    render(<SignInPage />)
    expect(screen.getByText('Forgot password?')).toBeInTheDocument()
  })

  it('shows error on login failure', async () => {
    mockSignIn.mockResolvedValueOnce({ error: 'Invalid credentials' })

    render(<SignInPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText('Sign in'))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
  })

  it('renders Google sign-in button', () => {
    render(<SignInPage />)
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
  })

  it('renders omnysync brand link', () => {
    render(<SignInPage />)
    expect(screen.getByText('Omnysync')).toBeInTheDocument()
  })

  it('redirects to dashboard on successful login', async () => {
    mockSignIn.mockResolvedValueOnce({ ok: true, error: undefined })

    render(<SignInPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText('Sign in'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
