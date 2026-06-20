/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// The auth module has module-level mutable state (authFn).
// We re-import in each test via resetModules for clean state.

describe("Auth module", () => {
  let auth: (typeof import("../auth"))["auth"];
  let setAuth: (typeof import("../auth"))["setAuth"];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../auth");
    auth = mod.auth;
    setAuth = mod.setAuth;
  });

  describe("auth() with default behavior", () => {
    it("returns null by default", async () => {
      const session = await auth();
      expect(session).toBeNull();
    });
  });

  describe("setAuth() with sync function", () => {
    it("returns session from sync function", async () => {
      const mockSession = {
        user: { id: "user-1", name: "John", email: "john@example.com" },
        expires: "2026-07-01",
      };
      setAuth(() => mockSession);

      const result = await auth();
      expect(result).toEqual(mockSession);
    });

    it("returns null from sync function", async () => {
      setAuth(() => null);
      const result = await auth();
      expect(result).toBeNull();
    });
  });

  describe("setAuth() with async function", () => {
    it("returns session from async function", async () => {
      const mockSession = {
        user: { id: "user-2", name: "Alice", email: "alice@example.com" },
      };
      setAuth(() => Promise.resolve(mockSession));

      const result = await auth();
      expect(result).toEqual(mockSession);
    });

    it("returns null from async function", async () => {
      setAuth(() => Promise.resolve(null));
      const result = await auth();
      expect(result).toBeNull();
    });

    it("handles async function that throws", async () => {
      setAuth(() => Promise.reject(new Error("Auth failed")));
      await expect(auth()).rejects.toThrow("Auth failed");
    });
  });

  describe("setAuth() override", () => {
    it("replaces previous auth function", async () => {
      setAuth(() => ({ user: { id: "old" } }));
      setAuth(() => ({ user: { id: "new" } }));

      const result = await auth();
      expect(result!.user!.id).toBe("new");
    });
  });

  describe("setAuth() with different session shapes", () => {
    it("handles minimal session (no user)", async () => {
      setAuth(() => ({}));
      const result = await auth();
      expect(result).toEqual({});
    });

    it("handles session with image only", async () => {
      setAuth(() => ({
        user: { id: "u1", image: "https://example.com/avatar.png" },
      }));
      const result = await auth();
      expect(result!.user!.image).toBe("https://example.com/avatar.png");
    });

    it("handles session with expires field", async () => {
      const expires = new Date(Date.now() + 3600000).toISOString();
      setAuth(() => ({ expires, user: { id: "u1" } }));
      const result = await auth();
      expect(result!.expires).toBe(expires);
    });
  });
});
