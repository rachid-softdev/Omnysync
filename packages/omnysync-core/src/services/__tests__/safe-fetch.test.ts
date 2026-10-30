import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLookup = vi.hoisted(() => vi.fn());
const mockHttpsRequest = vi.hoisted(() => vi.fn());
const mockHttpRequest = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({ lookup: mockLookup }));
vi.mock("node:https", () => ({ request: mockHttpsRequest }));
vi.mock("node:http", () => ({ request: mockHttpRequest }));

import {
  createPinnedLookup,
  postJsonWithPinnedDns,
  resolveSafeOutboundTarget,
  UnsafeOutboundUrlError,
} from "../safe-fetch";

describe("resolveSafeOutboundTarget", () => {
  const originalAllowlist = process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS;
  });

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS;
    } else {
      process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS = originalAllowlist;
    }
  });

  it("rejects malformed and non-HTTP URLs", async () => {
    await expect(resolveSafeOutboundTarget("not-a-url")).rejects.toBeInstanceOf(
      UnsafeOutboundUrlError,
    );
    await expect(
      resolveSafeOutboundTarget("file:///etc/passwd"),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
  });

  it("rejects URLs with embedded credentials", async () => {
    await expect(
      resolveSafeOutboundTarget("https://user:pass@example.com/hook"),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
  });

  it("rejects blocked hostnames and private literals without DNS", async () => {
    await expect(
      resolveSafeOutboundTarget("http://localhost/hook"),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
    await expect(
      resolveSafeOutboundTarget("http://127.0.0.1/hook"),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
    await expect(
      resolveSafeOutboundTarget("http://[::1]/hook"),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
    await expect(
      resolveSafeOutboundTarget("http://[fec0::1]/hook"),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
    await expect(
      resolveSafeOutboundTarget(
        "http://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/hook",
      ),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);

    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects a public hostname that resolves to a private address", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

    await expect(
      resolveSafeOutboundTarget("https://example.com/hook"),
    ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
  });

  it("returns the resolved public address to pin", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    const target = await resolveSafeOutboundTarget("https://example.com/hook");

    expect(target.address).toBe("93.184.216.34");
    expect(target.family).toBe(4);
    expect(mockLookup).toHaveBeenCalledWith("example.com", {
      all: true,
      verbatim: true,
    });
  });

  it("keeps a public IPv6 literal and its family", async () => {
    const target = await resolveSafeOutboundTarget(
      "https://[2606:4700:4700::1111]/hook",
    );

    expect(target.address).toBe("2606:4700:4700::1111");
    expect(target.family).toBe(6);
  });

  it("allows an explicitly allowlisted private host", async () => {
    process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS = "localhost";
    mockLookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    const target = await resolveSafeOutboundTarget(
      "http://localhost:8080/hook",
    );

    expect(target.address).toBe("127.0.0.1");
    expect(target.family).toBe(4);
  });
});

describe("createPinnedLookup", () => {
  it("always returns the pinned address and family", () => {
    const lookup = createPinnedLookup("93.184.216.34", 4);
    const callback = vi.fn();

    lookup("example.com", {}, callback);

    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
  });

  it("returns an address array when autoSelectFamily requests all addresses", () => {
    const lookup = createPinnedLookup("93.184.216.34", 4);
    const callback = vi.fn();

    lookup("example.com", { all: true }, callback);

    expect(callback).toHaveBeenCalledWith(null, [
      { address: "93.184.216.34", family: 4 },
    ]);
  });
});

describe("postJsonWithPinnedDns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("posts JSON with the validated address pinned in the lookup", async () => {
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      headers: Record<string, string>;
    };
    response.statusCode = 200;
    response.headers = { "content-type": "application/json" };

    const request = {
      setTimeout: vi.fn(),
      on: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    };

    mockHttpsRequest.mockImplementation((_url, _options, callback) => {
      callback(response);
      process.nextTick(() => {
        response.emit("data", Buffer.from('{"ok":true}'));
        response.emit("end");
      });
      return request;
    });

    const result = await postJsonWithPinnedDns(
      "https://example.com/hook",
      '{"hello":"world"}',
      { "X-Test": "1" },
    );

    expect(result).toMatchObject({
      status: 200,
      ok: true,
      body: '{"ok":true}',
    });

    const options = mockHttpsRequest.mock.calls[0][1];
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Test": "1",
    });
    expect(options.lookup).toBeTypeOf("function");

    const lookupCallback = vi.fn();
    options.lookup("example.com", {}, lookupCallback);
    expect(lookupCallback).toHaveBeenCalledWith(null, "93.184.216.34", 4);

    expect(request.end).toHaveBeenCalledWith('{"hello":"world"}');
  });

  it("uses the HTTP transport for http URLs", async () => {
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);

    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      headers: Record<string, string>;
    };
    response.statusCode = 204;
    response.headers = {};

    const request = {
      setTimeout: vi.fn(),
      on: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    };

    mockHttpRequest.mockImplementation((_url, _options, callback) => {
      callback(response);
      process.nextTick(() => response.emit("end"));
      return request;
    });

    const result = await postJsonWithPinnedDns("http://example.com/hook", "{}");

    expect(result.status).toBe(204);
    expect(result.ok).toBe(true);
    expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    expect(mockHttpsRequest).not.toHaveBeenCalled();
  });

  it("does not follow redirects", async () => {
    const response = new EventEmitter() as EventEmitter & {
      statusCode: number;
      headers: Record<string, string>;
    };
    response.statusCode = 302;
    response.headers = { location: "http://127.0.0.1/hook" };

    const request = {
      setTimeout: vi.fn(),
      on: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    };

    mockHttpsRequest.mockImplementation((_url, _options, callback) => {
      callback(response);
      process.nextTick(() => response.emit("end"));
      return request;
    });

    const result = await postJsonWithPinnedDns(
      "https://example.com/hook",
      "{}",
    );

    expect(result.status).toBe(302);
    expect(result.ok).toBe(false);
    expect(mockHttpsRequest).toHaveBeenCalledTimes(1);
  });
});
