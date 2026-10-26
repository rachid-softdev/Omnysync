import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLookup = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({ lookup: mockLookup }));

import { assertSafeOutboundUrl } from "../outbound-url";

describe("assertSafeOutboundUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects non-HTTPS URLs", async () => {
    await expect(assertSafeOutboundUrl("http://example.com")).rejects.toThrow(
      "must use HTTPS",
    );
  });

  it("rejects invalid URLs", async () => {
    await expect(assertSafeOutboundUrl("not a url")).rejects.toThrow(
      "not a valid URL",
    );
  });

  it("rejects embedded credentials", async () => {
    await expect(
      assertSafeOutboundUrl("https://user:pass@example.com"),
    ).rejects.toThrow("must not contain credentials");
  });

  it("rejects localhost and private literal addresses", async () => {
    for (const url of [
      "https://localhost",
      "https://localhost.",
      "https://127.0.0.1",
      "https://10.0.0.1",
      "https://169.254.169.254",
      "https://192.168.1.1",
      "https://[::1]",
      "https://[::7f00:1]",
      "https://[64:ff9b::7f00:1]",
      "https://[2002:7f00:1::]",
      "https://[fd00::1]",
    ]) {
      await expect(assertSafeOutboundUrl(url)).rejects.toThrow(
        "must point to a public host",
      );
    }
  });

  it("allows public hostnames without treating them as private addresses", async () => {
    await expect(
      assertSafeOutboundUrl("https://example.com"),
    ).resolves.toBeInstanceOf(URL);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("honours the private-host allowlist", async () => {
    process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS = "localhost,wordpress.internal";

    await expect(
      assertSafeOutboundUrl("https://localhost:8080"),
    ).resolves.toBeInstanceOf(URL);
    await expect(
      assertSafeOutboundUrl("https://wordpress.internal"),
    ).resolves.toBeInstanceOf(URL);
  });

  it("honours the explicit allowPrivate option", async () => {
    await expect(
      assertSafeOutboundUrl("https://127.0.0.1", { allowPrivate: true }),
    ).resolves.toBeInstanceOf(URL);
  });

  it("rejects a public hostname that resolves to a private address", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);

    await expect(
      assertSafeOutboundUrl("https://rebind.example.com"),
    ).rejects.toThrow("must point to a public host");
  });

  it("allows a public hostname that resolves only to public addresses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    await expect(
      assertSafeOutboundUrl("https://example.com"),
    ).resolves.toBeInstanceOf(URL);
    expect(mockLookup).toHaveBeenCalledWith("example.com", {
      all: true,
      verbatim: true,
    });
  });

  it("rejects a hostname that cannot be resolved", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockLookup.mockRejectedValue(new Error("ENOTFOUND"));

    await expect(
      assertSafeOutboundUrl("https://missing.example.com"),
    ).rejects.toThrow("could not be resolved");
  });
});
