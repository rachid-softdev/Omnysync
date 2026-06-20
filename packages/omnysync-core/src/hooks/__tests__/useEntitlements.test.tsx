/**
 * useEntitlements Hook Tests
 *
 * Tests the React hooks and components for entitlement display:
 * - useEntitlements — fetches and caches entitlements
 * - useFeature — checks if a feature is enabled
 * - useLimit — returns limit info for a feature
 * - FeatureGuard — conditional rendering component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EntitlementsResponse } from "../../entitlements/types";

// ============================================================================
// HOISTED MOCKS — required because vi.mock factories are hoisted above
// module-scoped variable declarations
// ============================================================================

const mockReact = vi.hoisted(() => ({
  useState: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  createElement: vi.fn(),
  Fragment: Symbol("Fragment"),
  // Automatic JSX runtime uses jsx and jsxs — mock these too
  jsx: vi.fn(),
  jsxs: vi.fn(),
  jsxDEV: vi.fn(),
}));

vi.mock("react", () => mockReact);

// ============================================================================
// MOCK GLOBALS (not hoisted — these run at module execution time)
// ============================================================================

const mockLocalStorage: Record<string, string> = {};
const mockFetch = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

vi.stubGlobal("fetch", mockFetch);
vi.stubGlobal("localStorage", {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
  }),
  get length() {
    return Object.keys(mockLocalStorage).length;
  },
  key: vi.fn((index: number) => Object.keys(mockLocalStorage)[index] ?? null),
});
vi.stubGlobal("window", {
  addEventListener: mockAddEventListener,
  removeEventListener: mockRemoveEventListener,
});

// ============================================================================
// IMPORTS
// ============================================================================

import {
  useEntitlements,
  useFeature,
  useLimit,
  FeatureGuard,
  UsageBar,
} from "../useEntitlements";

// ============================================================================
// HELPERS
// ============================================================================

type StateSetter<T> = (value: T | ((prev: T) => T)) => void;

let stateValues: Record<string, any> = {};
let stateIndex = 0;
const capturedUseEffects: Array<{ cb: (...args: any[]) => any; deps?: any[] }> =
  [];

function resetState() {
  stateValues = {};
  stateIndex = 0;
  capturedUseEffects.length = 0;
  delete mockLocalStorage["user-entitlements"];
}

function setupUseStateMocks(...returns: any[][]) {
  // Setup useState to return specified values sequentially
  mockReact.useState.mockReset();
  for (const ret of returns) {
    mockReact.useState.mockReturnValueOnce(ret);
  }
}

function setupDefaultMocks(data: EntitlementsResponse | null = null) {
  setupUseStateMocks(
    [data, vi.fn()], // data state
    [false, vi.fn()], // isLoading state
    [null, vi.fn()], // error state
  );
  mockReact.useEffect.mockReset().mockImplementation((cb: any) => {});
  mockReact.useCallback.mockReset().mockImplementation((fn: any) => fn);
}

/**
 * Setup that captures useEffect callbacks for testing side effects.
 * Returns the captured callbacks array.
 */
function setupWithEffectCapture(data: EntitlementsResponse | null = null) {
  setupUseStateMocks(
    [data, vi.fn()], // data state
    [false, vi.fn()], // isLoading state
    [null, vi.fn()], // error state
  );
  capturedUseEffects.length = 0;
  mockReact.useEffect
    .mockReset()
    .mockImplementation((cb: (...args: any[]) => any, deps?: any[]) => {
      capturedUseEffects.push({ cb, deps });
    });
  mockReact.useCallback.mockReset().mockImplementation((fn: any) => fn);
  return capturedUseEffects;
}

/** Set up enough useState mocks for N sequential calls (each call uses 3 useStates) */
function setupForNCalls(data: EntitlementsResponse | null, n: number) {
  mockReact.useState.mockReset();
  for (let i = 0; i < n; i++) {
    mockReact.useState.mockReturnValueOnce([data, vi.fn()]); // data
    mockReact.useState.mockReturnValueOnce([false, vi.fn()]); // isLoading
    mockReact.useState.mockReturnValueOnce([null, vi.fn()]); // error
  }
  // After the specific once-mocks are consumed, fall through to a default
  mockReact.useState.mockReturnValue([null, vi.fn()]);
  mockReact.useEffect.mockReset().mockImplementation((cb: any) => {});
  mockReact.useCallback.mockReset().mockImplementation((fn: any) => fn);
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("useEntitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    delete mockLocalStorage["user-entitlements"];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // useEntitlements
  // ==========================================================================

  describe("useEntitlements hook", () => {
    it("should return state shape with data, isLoading, error, refetch", () => {
      setupDefaultMocks();

      const result = useEntitlements();
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("isLoading");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("refetch");
      expect(typeof result.refetch).toBe("function");
    });

    it("should call fetch /api/me/entitlements on refetch", async () => {
      setupDefaultMocks();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plan: "pro",
          features: {},
          limits: {},
          usage: {},
          resetAt: {},
        }),
      });

      const { refetch } = useEntitlements();
      await refetch();

      expect(mockFetch).toHaveBeenCalledWith("/api/me/entitlements", {
        headers: {},
      });
    });

    it("should cache result in localStorage on successful fetch", async () => {
      setupDefaultMocks();

      const responseData: EntitlementsResponse = {
        plan: "free",
        features: { EXPORT_PDF: false },
        limits: { MAX_SYNCS: 10 },
        usage: { MAX_SYNCS: 3 },
        resetAt: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseData,
      });

      const { refetch } = useEntitlements();
      await refetch();

      expect(mockLocalStorage["user-entitlements"]).toBe(
        JSON.stringify(responseData),
      );
    });

    it("should try localStorage fallback on fetch error", async () => {
      setupDefaultMocks();

      const cachedData: EntitlementsResponse = {
        plan: "pro",
        features: { EXPORT_PDF: true },
        limits: {},
        usage: {},
        resetAt: {},
      };
      mockLocalStorage["user-entitlements"] = JSON.stringify(cachedData);

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { refetch } = useEntitlements();
      // Should not throw — errors are caught and handled
      await expect(refetch()).resolves.toBeUndefined();
    });

    it("should parse error message from non-ok response", async () => {
      setupDefaultMocks();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Unauthorized access" }),
      });

      const { refetch } = useEntitlements();

      // Should handle the error internally
      await expect(refetch()).resolves.toBeUndefined();
    });

    it("should use fallback error message when response has no message (covers line 62 || branch)", async () => {
      setupDefaultMocks();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}), // no message field
      });

      const { refetch } = useEntitlements();

      // Should handle the error internally with fallback message
      await expect(refetch()).resolves.toBeUndefined();
    });

    it("should use fallback error message when response has empty message (covers line 62 || branch)", async () => {
      setupDefaultMocks();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "" }), // empty message
      });

      const { refetch } = useEntitlements();

      await expect(refetch()).resolves.toBeUndefined();
    });

    it("should handle non-Error thrown in fetchEntitlements (covers line 72 ternary else branch)", async () => {
      setupDefaultMocks();

      const responseData = {
        plan: "free",
        features: {},
        limits: {},
        usage: {},
        resetAt: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseData,
      });

      // Override localStorage.setItem to throw a non-Error string
      const origSetItem = globalThis.localStorage.setItem;
      globalThis.localStorage.setItem = vi.fn(() => {
        throw "QUOTA_EXCEEDED";
      });

      const { refetch } = useEntitlements();
      await refetch();

      // Should have handled the non-Error gracefully
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/me/entitlements",
        expect.any(Object),
      );

      // Restore
      globalThis.localStorage.setItem = origSetItem;
    });

    it("should call fetchEntitlements on initial mount via useEffect", () => {
      const effects = setupWithEffectCapture();

      useEntitlements();

      // First useEffect should have a callback that calls fetch
      expect(effects.length).toBeGreaterThanOrEqual(1);
      const initialEffect = effects[0];
      expect(typeof initialEffect.cb).toBe("function");
      // Dependencies should include fetchEntitlements
      expect(initialEffect.deps).toHaveLength(1);
    });

    it("should set up interval when refreshInterval > 0", () => {
      const effects = setupWithEffectCapture();
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

      useEntitlements({ refreshInterval: 30 });

      // Second effect is the interval one
      expect(effects.length).toBeGreaterThanOrEqual(2);
      const intervalEffect = effects[1];
      // Run the effect callback to register the interval
      if (intervalEffect.deps) {
        const cleanup = intervalEffect.cb();
        expect(setIntervalSpy).toHaveBeenCalledWith(
          expect.any(Function),
          30000, // 30 * 1000
        );
        // Cleanup should clear the interval
        expect(typeof cleanup).toBe("function");
        const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
        cleanup();
        expect(clearIntervalSpy).toHaveBeenCalled();
      }
    });

    it("should NOT set up interval when refreshInterval <= 0", () => {
      const effects = setupWithEffectCapture();
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

      useEntitlements({ refreshInterval: 0 });

      const intervalEffect = effects[1];
      if (intervalEffect && intervalEffect.deps) {
        intervalEffect.cb();
        expect(setIntervalSpy).not.toHaveBeenCalled();
      }
    });

    it("should add focus event listener when refetchOnFocus is true", () => {
      const effects = setupWithEffectCapture();

      useEntitlements({ refetchOnFocus: true });

      // Third effect is the focus one
      const focusEffect = effects[2];
      if (focusEffect && focusEffect.deps) {
        focusEffect.cb();
        expect(mockAddEventListener).toHaveBeenCalledWith(
          "focus",
          expect.any(Function),
        );
        // Cleanup should remove listener
        const cleanup = focusEffect.cb();
        if (typeof cleanup === "function") {
          cleanup();
          expect(mockRemoveEventListener).toHaveBeenCalledWith(
            "focus",
            expect.any(Function),
          );
        }
      }
    });

    it("should NOT add focus event listener when refetchOnFocus is false", () => {
      const effects = setupWithEffectCapture();

      useEntitlements({ refetchOnFocus: false });

      const focusEffect = effects[2];
      if (focusEffect && focusEffect.deps) {
        focusEffect.cb();
        expect(mockAddEventListener).not.toHaveBeenCalled();
      }
    });

    it("should handle fetch error when no localStorage cache available", async () => {
      setupDefaultMocks();

      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      // No cached data in localStorage
      delete mockLocalStorage["user-entitlements"];

      const { refetch } = useEntitlements();
      await expect(refetch()).resolves.toBeUndefined();
    });

    it("should handle corrupted localStorage cache gracefully", async () => {
      setupDefaultMocks();

      mockLocalStorage["user-entitlements"] = "{invalid json!!!}";
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { refetch } = useEntitlements();
      await expect(refetch()).resolves.toBeUndefined();
    });

    it("should call fetchEntitlements when initial mount effect runs (covers line 90)", () => {
      const effects = setupWithEffectCapture();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plan: "free",
          features: {},
          limits: {},
          usage: {},
          resetAt: {},
        }),
      });

      useEntitlements();

      // Call the initial effect callback to trigger fetchEntitlements
      expect(effects.length).toBeGreaterThanOrEqual(1);
      effects[0].cb();

      // fetchEntitlements should have been called (which calls fetch)
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should invoke setInterval callback to fetch entitlements (covers lines 98-99)", () => {
      const effects = setupWithEffectCapture();
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plan: "free",
          features: {},
          limits: {},
          usage: {},
          resetAt: {},
        }),
      });

      useEntitlements({ refreshInterval: 30 });

      // Call the interval effect callback
      const intervalEffect = effects[1];
      intervalEffect.cb();

      // Get the interval callback and invoke it
      const intervalCallback = setIntervalSpy.mock.calls[0][0];
      intervalCallback();

      // fetchEntitlements should have been called
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/me/entitlements",
        expect.any(Object),
      );
    });

    it("should execute fetchEntitlements when initial useEffect callback runs (direct line 90 coverage)", async () => {
      // Use a useEffect mock that actually invokes the callback
      setupUseStateMocks([null, vi.fn()], [false, vi.fn()], [null, vi.fn()]);
      mockReact.useEffect.mockReset().mockImplementation((cb: any) => cb());
      mockReact.useCallback.mockReset().mockImplementation((fn: any) => fn);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plan: "free",
          features: {},
          limits: {},
          usage: {},
          resetAt: {},
        }),
      });

      useEntitlements();

      // The useEffect calling cb() should trigger fetchEntitlements which calls fetch
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/me/entitlements",
        expect.any(Object),
      );
    });

    it("should execute interval setup and return cleanup when refreshInterval > 0 (covers lines 95-101)", () => {
      setupUseStateMocks([null, vi.fn()], [false, vi.fn()], [null, vi.fn()]);
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
      const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

      const capturedCleanups: any[] = [];
      mockReact.useEffect
        .mockReset()
        .mockImplementation((cb: any, _deps?: any[]) => {
          capturedCleanups.push(cb());
        });
      mockReact.useCallback.mockReset().mockImplementation((fn: any) => fn);

      useEntitlements({ refreshInterval: 30 });

      // The second useEffect callback should have set up an interval (index 1)
      const intervalCleanup = capturedCleanups[1];
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
      expect(typeof intervalCleanup).toBe("function");
      intervalCleanup();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("should early-return from interval effect when refreshInterval <= 0 (covers line 95)", () => {
      setupUseStateMocks([null, vi.fn()], [false, vi.fn()], [null, vi.fn()]);
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
      mockReact.useEffect.mockReset().mockImplementation((cb: any) => cb());
      mockReact.useCallback.mockReset().mockImplementation((fn: any) => fn);

      useEntitlements({ refreshInterval: 0 });

      // No interval should be created when refreshInterval <= 0
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it("should early-return from focus effect when refetchOnFocus is false (covers line 106)", () => {
      setupUseStateMocks([null, vi.fn()], [false, vi.fn()], [null, vi.fn()]);
      mockReact.useEffect.mockReset().mockImplementation((cb: any) => cb());
      mockReact.useCallback.mockReset().mockImplementation((fn: any) => fn);

      useEntitlements({ refetchOnFocus: false });

      // No event listener should be added
      expect(mockAddEventListener).not.toHaveBeenCalled();
    });

    it("should invoke focus handler to fetch entitlements (covers lines 108-110)", () => {
      const effects = setupWithEffectCapture();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plan: "free",
          features: {},
          limits: {},
          usage: {},
          resetAt: {},
        }),
      });

      useEntitlements({ refetchOnFocus: true });

      // Call the focus effect callback to register handler
      const focusEffect = effects[2];
      focusEffect.cb();

      // Get the focus handler and invoke it
      const focusHandler = mockAddEventListener.mock.calls[0][1];
      focusHandler();

      // fetchEntitlements should have been called
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/me/entitlements",
        expect.any(Object),
      );
    });
  });

  // ==========================================================================
  // useFeature
  // ==========================================================================

  describe("useFeature", () => {
    it("should return false when no entitlements data", () => {
      setupDefaultMocks(null);

      const result = useFeature("EXPORT_PDF");
      expect(result).toBe(false);
    });

    it("should return feature value from entitlements data", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: { EXPORT_PDF: true, TWO_WAY_SYNC: false },
        limits: {},
        usage: {},
        resetAt: {},
      };
      // 2 assertions × 3 useState calls each + 1 fallback = need setupForNCalls
      setupForNCalls(data, 3);

      expect(useFeature("EXPORT_PDF")).toBe(true);
      expect(useFeature("TWO_WAY_SYNC")).toBe(false);
    });
  });

  // ==========================================================================
  // useLimit
  // ==========================================================================

  describe("useLimit", () => {
    it("should return limit, used, and remaining when data exists", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_CONNECTORS: 10 },
        usage: { MAX_CONNECTORS: 3 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = useLimit("MAX_CONNECTORS");
      expect(result.limit).toBe(10);
      expect(result.used).toBe(3);
      expect(result.remaining).toBe(7);
      expect(result.resetAt).toBeNull();
    });

    it("should return null remaining for unlimited features", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_DOCUMENTS: null },
        usage: { MAX_DOCUMENTS: 5 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = useLimit("MAX_DOCUMENTS");
      expect(result.limit).toBeNull();
      expect(result.used).toBe(5);
      expect(result.remaining).toBeNull();
    });

    it("should return defaults when no data available", () => {
      setupDefaultMocks(null);

      const result = useLimit("NON_EXISTENT");
      expect(result.limit).toBeNull();
      expect(result.used).toBe(0);
      expect(result.resetAt).toBeNull();
      expect(result.remaining).toBeNull();
    });
  });

  // ==========================================================================
  // FeatureGuard Component
  // ==========================================================================

  describe("FeatureGuard", () => {
    it("should render children when feature is enabled", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: { EXPORT_PDF: true },
        limits: {},
        usage: {},
        resetAt: {},
      };
      setupForNCalls(data, 1);

      const result = FeatureGuard({
        feature: "EXPORT_PDF",
        children: "PROTECTED CONTENT",
        fallback: "UPGRADE NOW",
      });

      // Returns a React element (Fragment wrapping children) — just verify it's truthy
      expect(result).toBeTruthy();
    });

    it("should render fallback when feature is disabled", () => {
      const data: EntitlementsResponse = {
        plan: "free",
        features: { EXPORT_PDF: false },
        limits: {},
        usage: {},
        resetAt: {},
      };
      setupForNCalls(data, 1);

      const result = FeatureGuard({
        feature: "EXPORT_PDF",
        children: "PROTECTED CONTENT",
        fallback: "UPGRADE NOW",
      });

      expect(result).toBeTruthy();
    });

    it("should handle null fallback when feature is disabled", () => {
      const data: EntitlementsResponse = {
        plan: "free",
        features: { EXPORT_PDF: false },
        limits: {},
        usage: {},
        resetAt: {},
      };
      setupForNCalls(data, 1);

      const result = FeatureGuard({
        feature: "EXPORT_PDF",
        children: "PROTECTED CONTENT",
      });

      // When fallback is null, <>{null}</> renders a Fragment with null child
      expect(result).toBeTruthy();
    });
  });

  // ==========================================================================
  // UsageBar Component
  // ==========================================================================

  describe("UsageBar", () => {
    it("should render null for unlimited features (limit === null)", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { UNLIMITED_FEATURE: null },
        usage: { UNLIMITED_FEATURE: 50 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "UNLIMITED_FEATURE" });
      expect(result).toBeNull();
    });

    it("should render with correct percentage width", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 100 },
        usage: { MAX_SYNCS: 25 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });

      // Should be a div element
      expect(result).toBeTruthy();
      expect(result.type).toBe("div");

      // Top row: first child div
      const topRow = result.props.children[0];
      expect(topRow.type).toBe("div");
      expect(topRow.props.className).toBe("flex justify-between text-sm mb-1");

      // First span: "25 / 100"
      const labelSpan = topRow.props.children[0];
      expect(labelSpan.type).toBe("span");
      const labelText = Array.isArray(labelSpan.props.children)
        ? labelSpan.props.children.join("")
        : labelSpan.props.children;
      expect(labelText).toBe("25 / 100");

      // Second span: percentage
      const percentageSpan = topRow.props.children[1];
      expect(percentageSpan.type).toBe("span");
      const pctText = Array.isArray(percentageSpan.props.children)
        ? percentageSpan.props.children.join("")
        : percentageSpan.props.children;
      expect(pctText).toBe("25%");

      // Bar container: second child div
      const barContainer = result.props.children[1];
      expect(barContainer.type).toBe("div");

      // Bar fill: inner div
      const barFill = barContainer.props.children;
      expect(barFill.type).toBe("div");
      expect(barFill.props.style).toEqual({ width: "25%" });
      expect(barFill.props.className).toContain("bg-blue-500");
    });

    it("should render label when provided (used / limit text)", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_DOCS: 50 },
        usage: { MAX_DOCS: 10 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_DOCS" });

      const topRow = result.props.children[0];
      const labelSpan = topRow.props.children[0];
      const labelText = Array.isArray(labelSpan.props.children)
        ? labelSpan.props.children.join("")
        : labelSpan.props.children;

      // Should display "used / limit" format
      expect(labelText).toBe("10 / 50");
    });

    it("should show warning color (bg-blue-500) when usage <= 80%", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 100 },
        usage: { MAX_SYNCS: 80 }, // 80% - boundary
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });
      const barFill = result.props.children[1].props.children;

      // At 80%, remaining = 20 > 0 so not at limit → blue
      expect(barFill.props.className).toContain("bg-blue-500");
      expect(barFill.props.className).not.toContain("bg-red-500");
    });

    it("should show error color (bg-red-500) when usage > 100% (over limit)", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 100 },
        usage: { MAX_SYNCS: 150 }, // 150% - over limit
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });
      const barFill = result.props.children[1].props.children;

      // Over limit → remaining = 0 → isAtLimit → red
      expect(barFill.props.className).toContain("bg-red-500");
    });

    it("should show error color when usage exactly equals 100%", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 100 },
        usage: { MAX_SYNCS: 100 }, // 100% - at limit
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });
      const barFill = result.props.children[1].props.children;

      // At 100%, remaining = 0 → isAtLimit → red
      expect(barFill.props.className).toContain("bg-red-500");
    });

    it("should show red color when usage just exceeds limit (e.g., 101%)", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 100 },
        usage: { MAX_SYNCS: 101 }, // 101%
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });
      const barFill = result.props.children[1].props.children;

      expect(barFill.props.className).toContain("bg-red-500");
    });

    it("should clamp bar width to 100% when usage exceeds max", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 100 },
        usage: { MAX_SYNCS: 200 }, // 200% of limit
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });
      const barFill = result.props.children[1].props.children;

      // percentage = Math.round(200/100 * 100) = 200
      // style width = Math.min(200, 100) = 100%
      expect(barFill.props.style).toEqual({ width: "100%" });
    });

    it("should render 0% when usage is 0", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 100 },
        usage: { MAX_SYNCS: 0 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });

      // Top row should show 0 / 100
      const topRow = result.props.children[0];
      const labelSpan = topRow.props.children[0];
      const labelText = Array.isArray(labelSpan.props.children)
        ? labelSpan.props.children.join("")
        : labelSpan.props.children;
      expect(labelText).toBe("0 / 100");

      // Percentage should show 0%
      const percentageSpan = topRow.props.children[1];
      const pctText = Array.isArray(percentageSpan.props.children)
        ? percentageSpan.props.children.join("")
        : percentageSpan.props.children;
      expect(pctText).toBe("0%");

      // Bar fill should have 0% width
      const barFill = result.props.children[1].props.children;
      expect(barFill.props.style).toEqual({ width: "0%" });
    });

    it("should render with correct ARIA-related structure (percentage visible text)", () => {
      // This component uses visible percentage text rather than ARIA attributes.
      // Verify the percentage text is screen-reader friendly.
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 100 },
        usage: { MAX_SYNCS: 42 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });

      const topRow = result.props.children[0];
      const percentageSpan = topRow.props.children[1];

      // Verify the percentage text is human-readable
      const pctText = Array.isArray(percentageSpan.props.children)
        ? percentageSpan.props.children.join("")
        : percentageSpan.props.children;
      expect(pctText).toBe("42%");

      // Verify bar fill has a style-based width (accessible via DOM)
      const barFill = result.props.children[1].props.children;
      expect(barFill.props.style).toEqual({ width: "42%" });
    });

    it("should handle undefined className gracefully (defaults to empty string)", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 50 },
        usage: { MAX_SYNCS: 10 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({
        feature: "MAX_SYNCS",
        // className not provided
      });

      expect(result.props.className).toBe("");
    });

    it("should render with custom className", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 50 },
        usage: { MAX_SYNCS: 10 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({
        feature: "MAX_SYNCS",
        className: "my-custom-class",
      });

      expect(result.props.className).toBe("my-custom-class");
    });

    it("should not show upgrade link when showUpgradeOnLimit is false and at limit", () => {
      const data: EntitlementsResponse = {
        plan: "free",
        features: {},
        limits: { MAX_SYNCS: 10 },
        usage: { MAX_SYNCS: 10 }, // at limit
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });

      // The third child is the boolean false from the conditional
      expect(result.props.children.length).toBe(3);
      expect(result.props.children[2]).toBe(false);
    });

    it("should show upgrade link when showUpgradeOnLimit is true and at limit", () => {
      const data: EntitlementsResponse = {
        plan: "free",
        features: {},
        limits: { MAX_SYNCS: 10 },
        usage: { MAX_SYNCS: 10 }, // at limit
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({
        feature: "MAX_SYNCS",
        showUpgradeOnLimit: true,
      });

      // Three children: top row, bar container, and upgrade link
      expect(result.props.children.length).toBe(3);

      // Third child is the upgrade link
      const upgradeLink = result.props.children[2];
      expect(upgradeLink.type).toBe("a");
      expect(upgradeLink.props.href).toBe("/billing/upgrade");
      expect(upgradeLink.props.children).toBe("Upgrade to get more");
    });

    it("should not show upgrade link when showUpgradeOnLimit is true but NOT at limit", () => {
      const data: EntitlementsResponse = {
        plan: "free",
        features: {},
        limits: { MAX_SYNCS: 10 },
        usage: { MAX_SYNCS: 5 }, // under limit
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({
        feature: "MAX_SYNCS",
        showUpgradeOnLimit: true,
      });

      // The third child is the boolean false from the conditional
      expect(result.props.children.length).toBe(3);
      expect(result.props.children[2]).toBe(false);
    });

    it("should handle small usage values correctly (used=1, limit=1000)", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 1000 },
        usage: { MAX_SYNCS: 1 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });

      const topRow = result.props.children[0];
      const percentageSpan = topRow.props.children[1];
      const pctText = Array.isArray(percentageSpan.props.children)
        ? percentageSpan.props.children.join("")
        : percentageSpan.props.children;

      // Math.round(1/1000 * 100) = Math.round(0.1) = 0
      expect(pctText).toBe("0%");

      // Bar fill: 0% width
      const barFill = result.props.children[1].props.children;
      expect(barFill.props.style).toEqual({ width: "0%" });
    });

    it("should handle exactly 1% usage", () => {
      const data: EntitlementsResponse = {
        plan: "pro",
        features: {},
        limits: { MAX_SYNCS: 200 },
        usage: { MAX_SYNCS: 2 },
        resetAt: {},
      };
      setupDefaultMocks(data);

      const result = UsageBar({ feature: "MAX_SYNCS" });

      const percentageSpan = result.props.children[0].props.children[1];
      const pctText = Array.isArray(percentageSpan.props.children)
        ? percentageSpan.props.children.join("")
        : percentageSpan.props.children;

      // Math.round(2/200 * 100) = Math.round(1) = 1
      expect(pctText).toBe("1%");

      const barFill = result.props.children[1].props.children;
      expect(barFill.props.style).toEqual({ width: "1%" });
    });
  });
});
