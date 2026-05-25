/**
 * Auth session helper
 * Omnysync - 2026
 *
 * Framework-agnostic auth helper.
 * By default it returns null (no session).
 * Override via setAuth() for your framework (NextAuth, etc.)
 */

export interface AuthSession {
  user?: {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  };
  expires?: string;
}

let authFn: () => AuthSession | Promise<AuthSession | null> | null = () => null;

/**
 * Get the current auth session
 */
export async function auth(): Promise<AuthSession | null> {
  const result = authFn();
  if (result instanceof Promise) {
    return result;
  }
  return result;
}

/**
 * Override the auth function (for framework integration)
 */
export function setAuth(
  fn: () => AuthSession | Promise<AuthSession | null> | null,
): void {
  authFn = fn;
}
