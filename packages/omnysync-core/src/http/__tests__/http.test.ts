/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("HTTP module", () => {
  let fetchWithTimeout: (typeof import("../index"))["fetchWithTimeout"];
  let fetchWithRetry: (typeof import("../index"))["fetchWithRetry"];
  let consoleLogSpy: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mod = await import("../index");
    fetchWithTimeout = mod.fetchWithTimeout;
    fetchWithRetry = mod.fetchWithRetry;
  });

  afterEach(() => {
    consoleLogSpy?.mockRestore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("fetchWithTimeout", () => {
    it("fetches and parses JSON response", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
        text: () => Promise.resolve(""),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

      const result = await fetchWithTimeout<{ data: string }>(
        "https://api.example.com/data",
      );
      expect(result).toEqual({ data: "test" });
    });

    it("throws on non-ok response (HTTP error)", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

      await expect(
        fetchWithTimeout("https://api.example.com/notfound"),
      ).rejects.toThrow("HTTP 404: Not found");
    });

    it("throws on timeout (AbortController)", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(
        () =>
          new Promise((_, reject) => {
            // Simulate abort by rejecting with AbortError
            const error = new DOMException(
              "The operation was aborted",
              "AbortError",
            );
            reject(error);
          }),
      );

      await expect(
        fetchWithTimeout("https://api.example.com/slow", {}, 1),
      ).rejects.toThrow();
    });

    it("sends JSON content-type header by default", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      };
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(mockResponse as any);

      await fetchWithTimeout("https://api.example.com/post", {
        method: "POST",
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/post",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("allows overriding headers", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      };
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(mockResponse as any);

      await fetchWithTimeout("https://api.example.com/auth", {
        headers: { Authorization: "Bearer token" },
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/auth",
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer token",
          },
        }),
      );
    });

    it("works with undefined options", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ data: "no-options" }),
        text: () => Promise.resolve(""),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

      const result = await fetchWithTimeout(
        "https://api.example.com/no-options",
        undefined,
      );
      expect(result).toEqual({ data: "no-options" });
    });

    it("throws when response.json() fails", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
        text: () => Promise.resolve(""),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

      await expect(
        fetchWithTimeout("https://api.example.com/bad-json"),
      ).rejects.toThrow(SyntaxError);
    });

    it("passes custom timeoutMs to setTimeout", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      await fetchWithTimeout("https://api.example.com/slow", {}, 5000);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    });

    it("throws on network error (fetch rejects with TypeError)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new TypeError("Failed to fetch"),
      );

      await expect(
        fetchWithTimeout("https://api.example.com/no-network"),
      ).rejects.toThrow(TypeError);
    });

    it("throws on non-Error thrown during fetch", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue("string error");

      await expect(
        fetchWithTimeout("https://api.example.com/strange-error"),
      ).rejects.toBe("string error");
    });

    it("clears timeout even when fetch throws synchronously", async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new Error("Instant failure"),
      );

      await expect(
        fetchWithTimeout("https://api.example.com/instant-fail"),
      ).rejects.toThrow("Instant failure");

      // finally block should always clear the timeout
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("triggers abort callback when timeout expires before fetch resolves", () => {
      vi.useFakeTimers();

      let capturedSignal: AbortSignal | undefined;
      vi.spyOn(globalThis, "fetch").mockImplementation(
        (_url: string, options: any) => {
          capturedSignal = options?.signal;
          // Return a promise that never settles so the timeout has to fire
          return new Promise<never>(() => {});
        },
      );

      // Call without awaiting — we only need to verify abort state
      fetchWithTimeout("https://api.example.com/hangs", {}, 1000);

      // Before timeout, signal is not aborted
      expect(capturedSignal?.aborted).toBe(false);

      // Advance time to trigger the timeout
      vi.advanceTimersByTime(1000);

      // After timeout, the signal should be in aborted state
      expect(capturedSignal?.aborted).toBe(true);
    });

    it("always clears timeout after completion (finally block)", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ data: "ok" }),
        text: () => Promise.resolve(""),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      await fetchWithTimeout("https://api.example.com/clear-test");

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("fetchWithRetry", () => {
    it("succeeds on first attempt", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true }),
        text: () => Promise.resolve(""),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

      const result = await fetchWithRetry("https://api.example.com/data");
      expect(result).toEqual({ success: true });
    });

    it("retries on 5xx and succeeds eventually", async () => {
      const mockFailResponse = {
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server error"),
      };
      const mockSuccessResponse = {
        ok: true,
        json: () => Promise.resolve({ success: true }),
        text: () => Promise.resolve(""),
      };

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(mockFailResponse as any)
        .mockResolvedValueOnce(mockFailResponse as any)
        .mockResolvedValueOnce(mockSuccessResponse as any);

      const result = await fetchWithRetry(
        "https://api.example.com/flaky",
        {},
        3,
      );
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("does not retry on 4xx client errors", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad request"),
      };
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(mockResponse as any);

      await expect(
        fetchWithRetry("https://api.example.com/bad", {}, 3),
      ).rejects.toThrow("HTTP 400: Bad request");
      expect(fetchSpy).toHaveBeenCalledTimes(1); // no retry
    });

    it("does not retry on 401", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      };
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(mockResponse as any);

      await expect(
        fetchWithRetry("https://api.example.com/unauth", {}, 3),
      ).rejects.toThrow("HTTP 401: Unauthorized");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("throws after exhausting all retries on 5xx", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server error"),
      };
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(mockResponse as any);

      await expect(
        fetchWithRetry("https://api.example.com/error", {}, 2),
      ).rejects.toThrow("HTTP 500: Server error");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("retries on network error (fetch throws)", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
          text: () => Promise.resolve(""),
        } as any);

      const result = await fetchWithRetry(
        "https://api.example.com/unstable",
        {},
        3,
      );
      expect(result).toEqual({ success: true });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("logs retry attempts", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: () => Promise.resolve("Error"),
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

      await expect(
        fetchWithRetry("https://api.example.com/log-retry", {}, 2),
      ).rejects.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Retry 1/2"),
      );
    });

    it("succeeds with maxRetries=1 (no retry on first failure for 5xx)", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server error"),
      };
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(mockResponse as any);

      await expect(
        fetchWithRetry("https://api.example.com/single-retry", {}, 1),
      ).rejects.toThrow("HTTP 500: Server error");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("passes options through to fetchWithTimeout", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ result: "ok" }),
        text: () => Promise.resolve(""),
      };
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(mockResponse as any);

      await fetchWithRetry(
        "https://api.example.com/with-options",
        { method: "POST", body: JSON.stringify({ key: "val" }) },
        2,
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.example.com/with-options",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ key: "val" }),
        }),
      );
    });

    it("retries on timeout error (AbortError) and exhausts", async () => {
      const abortError = new DOMException(
        "The operation was aborted",
        "AbortError",
      );
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(abortError);

      await expect(
        fetchWithRetry("https://api.example.com/timeout", {}, 2),
      ).rejects.toThrow();
      // Should attempt all retries since AbortError is not HTTP 4xx
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
