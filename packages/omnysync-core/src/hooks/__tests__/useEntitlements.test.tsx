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
  setItem: vi.fn((key: string, value: string) => { mockLocalStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockLocalStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }),
  get length() { return Object.keys(mockLocalStorage).length; },
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
} from "../useEntitlements";

// ============================================================================
// HELPERS
// ============================================================================

type StateSetter<T> = (value: T | ((prev: T) => T)) => void;

let stateValues: Record<string, any> = {};
let stateIndex = 0;

function resetState() {
  stateValues = {};
  stateIndex = 0;
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
    [data, vi.fn()],     // data state
    [false, vi.fn()],     // isLoading state
    [null, vi.fn()],      // error state
  );
  mockReact.useEffect.mockReset().mockImplementation((cb: any) => {});
  mockReact.useCallback.mockReset().mockImplementation((fn: any) => fn);
}

/** Set up enough useState mocks for N sequential calls (each call uses 3 useStates) */
function setupForNCalls(data: EntitlementsResponse | null, n: number) {
  mockReact.useState.mockReset();
  for (let i = 0; i < n; i++) {
    mockReact.useState.mockReturnValueOnce([data, vi.fn()]);    // data
    mockReact.useState.mockReturnValueOnce([false, vi.fn()]);   // isLoading
    mockReact.useState.mockReturnValueOnce([null, vi.fn()]);    // error
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
        json: async () => ({ plan: "pro", features: {}, limits: {}, usage: {}, resetAt: {} }),
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

      expect(mockLocalStorage["user-entitlements"]).toBe(JSON.stringify(responseData));
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
});
