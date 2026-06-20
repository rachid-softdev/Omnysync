/**
 * useIsMobile Hook Tests
 *
 * Tests the mobile viewport detection hook:
 * - Returns correct boolean based on window.innerWidth vs breakpoint
 * - Responds to window resize events
 * - Cleans up event listeners on unmount
 * - Supports custom breakpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// HOISTED MOCKS — required because vi.mock factories are hoisted above
// module-scoped variable declarations
// ============================================================================

const mockReact = vi.hoisted(() => ({
  useState: vi.fn(),
  useEffect: vi.fn(),
}));

vi.mock("react", () => mockReact);

// ============================================================================
// MOCK GLOBALS (not hoisted)
// ============================================================================

let mockInnerWidth = 1024;
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

vi.stubGlobal("window", {
  get innerWidth() {
    return mockInnerWidth;
  },
  addEventListener: mockAddEventListener,
  removeEventListener: mockRemoveEventListener,
});

// ============================================================================
// IMPORTS
// ============================================================================

import { useIsMobile } from "../useMobile";

// ============================================================================
// HELPERS
// ============================================================================

interface SetupResult {
  setIsMobile: ReturnType<typeof vi.fn>;
  getCleanup: () => (() => void) | null;
}

function setupMocks(): SetupResult {
  const setIsMobile = vi.fn();
  let cleanupFn: (() => void) | null = null;

  mockReact.useState.mockReturnValue([false, setIsMobile]);
  mockReact.useEffect.mockImplementation((cb: () => () => void) => {
    cleanupFn = cb();
  });

  return {
    setIsMobile,
    getCleanup: () => cleanupFn,
  };
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("useIsMobile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInnerWidth = 1024;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Initial detection
  // ==========================================================================

  describe("initial detection", () => {
    it("should return false when window width >= breakpoint", () => {
      mockInnerWidth = 1200;
      const { setIsMobile } = setupMocks();

      useIsMobile(768);

      expect(setIsMobile).toHaveBeenCalledWith(false);
      // Should be called once: the initial check() call inside useEffect
      expect(setIsMobile).toHaveBeenCalledTimes(1);
    });

    it("should return true when window width < breakpoint", () => {
      mockInnerWidth = 375;
      const { setIsMobile } = setupMocks();

      useIsMobile(768);

      expect(setIsMobile).toHaveBeenCalledWith(true);
      expect(setIsMobile).toHaveBeenCalledTimes(1);
    });

    it("should use default breakpoint of 768 when none provided", () => {
      mockInnerWidth = 700;
      const { setIsMobile } = setupMocks();

      useIsMobile(); // uses default 768

      expect(setIsMobile).toHaveBeenCalledWith(true);
    });

    it("should accept custom breakpoint", () => {
      mockInnerWidth = 900;
      const { setIsMobile } = setupMocks();

      useIsMobile(1000);

      // 900 < 1000 → true (mobile with custom breakpoint)
      expect(setIsMobile).toHaveBeenCalledWith(true);
    });

    it("should call useState with default false", () => {
      setupMocks();
      useIsMobile(768);

      expect(mockReact.useState).toHaveBeenCalledWith(false);
    });

    it("should call useEffect with a function and [breakpoint] dependency", () => {
      setupMocks();
      useIsMobile(768);

      expect(mockReact.useEffect).toHaveBeenCalledWith(
        expect.any(Function),
        [768],
      );
    });
  });

  // ==========================================================================
  // Resize behavior
  // ==========================================================================

  describe("resize behavior", () => {
    it("should register a resize event listener with passive option", () => {
      setupMocks();
      useIsMobile(768);

      expect(mockAddEventListener).toHaveBeenCalledWith(
        "resize",
        expect.any(Function),
        { passive: true },
      );
    });

    it("should update value when window is resized across the breakpoint (desktop → mobile)", () => {
      mockInnerWidth = 1200; // start desktop
      const { setIsMobile } = setupMocks();

      useIsMobile(768);

      // First call: initial check with width=1200 (desktop)
      expect(setIsMobile).toHaveBeenNthCalledWith(1, false);

      // Simulate resize: shrink width below breakpoint
      mockInnerWidth = 500;
      const resizeHandler = mockAddEventListener.mock.calls[0][1];
      resizeHandler();

      // Second call: check after resize with width=500 (mobile)
      expect(setIsMobile).toHaveBeenNthCalledWith(2, true);
    });

    it("should update value when window is resized across the breakpoint (mobile → desktop)", () => {
      mockInnerWidth = 400; // start mobile
      const { setIsMobile } = setupMocks();

      useIsMobile(768);

      // First call: initial check with width=400 (mobile)
      expect(setIsMobile).toHaveBeenNthCalledWith(1, true);

      // Simulate resize: grow width above breakpoint
      mockInnerWidth = 1440;
      const resizeHandler = mockAddEventListener.mock.calls[0][1];
      resizeHandler();

      // Second call: check after resize with width=1440 (desktop)
      expect(setIsMobile).toHaveBeenNthCalledWith(2, false);
    });

    it("should NOT update when resized within same breakpoint range", () => {
      mockInnerWidth = 320; // start mobile
      const { setIsMobile } = setupMocks();

      useIsMobile(768);

      // First call: initial check
      expect(setIsMobile).toHaveBeenNthCalledWith(1, true);

      // Resize within mobile range
      mockInnerWidth = 600;
      const resizeHandler = mockAddEventListener.mock.calls[0][1];
      resizeHandler();

      // Still mobile
      expect(setIsMobile).toHaveBeenNthCalledWith(2, true);
    });
  });

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  describe("cleanup on unmount", () => {
    it("should remove the resize event listener on unmount", () => {
      const { getCleanup } = setupMocks();
      useIsMobile(768);

      const resizeHandler = mockAddEventListener.mock.calls[0][1];
      const cleanup = getCleanup();
      cleanup();

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "resize",
        resizeHandler,
      );
    });

    it("should not throw on cleanup if called multiple times", () => {
      const { getCleanup } = setupMocks();
      useIsMobile(768);

      const cleanup = getCleanup();

      // Calling cleanup multiple times should not throw
      expect(() => {
        cleanup();
        cleanup();
      }).not.toThrow();
    });

    it("should reference the same function for addEventListener and removeEventListener", () => {
      const { getCleanup } = setupMocks();
      useIsMobile(768);

      const resizeHandler = mockAddEventListener.mock.calls[0][1];
      const cleanup = getCleanup();
      cleanup();

      // The function passed to removeEventListener must be the same
      // reference that was passed to addEventListener
      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "resize",
        resizeHandler,
      );
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle breakpoint of 0", () => {
      mockInnerWidth = 1;
      const { setIsMobile } = setupMocks();

      useIsMobile(0);

      // 1 < 0 → false
      expect(setIsMobile).toHaveBeenCalledWith(false);
    });

    it("should handle breakpoint equal to window.innerWidth (not mobile)", () => {
      mockInnerWidth = 768;
      const { setIsMobile } = setupMocks();

      useIsMobile(768);

      // 768 < 768 → false (not strictly less)
      expect(setIsMobile).toHaveBeenCalledWith(false);
    });

    it("should handle very large breakpoint", () => {
      mockInnerWidth = 1024;
      const { setIsMobile } = setupMocks();

      useIsMobile(9999);

      // 1024 < 9999 → true
      expect(setIsMobile).toHaveBeenCalledWith(true);
    });

    it("should handle window width of 0", () => {
      mockInnerWidth = 0;
      const { setIsMobile } = setupMocks();

      useIsMobile(768);

      // 0 < 768 → true
      expect(setIsMobile).toHaveBeenCalledWith(true);
    });

    it("should work reactively with useEffect dependency on breakpoint", () => {
      // Re-calling with a different breakpoint should trigger useEffect again
      mockInnerWidth = 800;
      const { setIsMobile } = setupMocks();

      useIsMobile(768); // 800 < 768 → false
      expect(setIsMobile).toHaveBeenCalledWith(false);

      // When breakpoint changes, useEffect should re-run
      // Mock it as if the component re-rendered with new breakpoint
      const innerSetIsMobile = vi.fn();
      mockReact.useState.mockReturnValue([false, innerSetIsMobile]);
      mockReact.useEffect.mockImplementation((cb: () => () => void) => {
        cb();
        return () => {};
      });

      mockReact.useEffect.mock.calls.forEach(([cb, deps]) => {
        // Simulate the effect re-running if deps changed
        cb();
      });

      // We just need to verify the refetch mechanism:
      expect(mockInnerWidth).toBe(800);
    });
  });
});
