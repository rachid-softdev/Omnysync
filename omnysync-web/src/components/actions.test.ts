import { describe, it, expect, vi } from 'vitest'

const mockSignIn = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  signIn: mockSignIn,
}))

describe('signInWithGoogle', () => {
  it('calls signIn with google provider and redirects to dashboard', async () => {
    const { signInWithGoogle } = await import('./actions')
    await signInWithGoogle()

    expect(mockSignIn).toHaveBeenCalledWith('google', { redirectTo: '/dashboard' })
    expect(mockSignIn).toHaveBeenCalledTimes(1)
  })

  it('can be called multiple times', async () => {
    const { signInWithGoogle } = await import('./actions')
    await signInWithGoogle()
    await signInWithGoogle()

    expect(mockSignIn).toHaveBeenCalledTimes(3)
  })
})
