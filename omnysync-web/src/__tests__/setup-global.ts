// Global test setup for React component tests
// Ensures DOM testing matchers are available across all test files
import '@testing-library/jest-dom/vitest'

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
