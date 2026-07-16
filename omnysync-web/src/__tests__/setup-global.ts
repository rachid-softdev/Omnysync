// Global test setup for React component tests
// Ensures DOM testing matchers are available across all test files
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock next/headers globally so server components/pages that call headers() or
// cookies() during render don't throw "outside a request scope" under jsdom.
// Test files that define their own `vi.mock('next/headers', ...)` take precedence
// over this factory for that file.
vi.mock('next/headers', () => {
  const makeReadonlyHeaders = () => ({
    get: vi.fn((_key: string) => null),
    set: vi.fn(),
    has: vi.fn(() => false),
    delete: vi.fn(),
    append: vi.fn(),
    entries: vi.fn(() => []),
    forEach: vi.fn(),
    keys: vi.fn(() => []),
    values: vi.fn(() => []),
    [Symbol.iterator]: vi.fn(() => [][Symbol.iterator]()),
  })

  return {
    headers: vi.fn(() => makeReadonlyHeaders()),
    cookies: vi.fn(() => ({
      get: vi.fn(() => undefined),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(() => false),
      getAll: vi.fn(() => []),
      clear: vi.fn(),
    })),
    draftMode: vi.fn(() => ({ isEnabled: false, enable: vi.fn(), disable: vi.fn() })),
  }
})

// Polyfill PointerEvent methods for Radix UI + jsdom compatibility
// @radix-ui/react-select and other Radix primitives use hasPointerCapture
// which is not implemented in jsdom
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}

if (typeof PointerEvent === 'undefined') {
  class MockPointerEvent extends MouseEvent {
    pointerType: string
    constructor(type: string, init?: PointerEventInit) {
      super(type, init)
      this.pointerType = init?.pointerType ?? 'mouse'
    }
  }
  globalThis.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent
}
