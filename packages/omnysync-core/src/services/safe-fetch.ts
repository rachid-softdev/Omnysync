import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";
import {
  isBlockedHostname,
  isPrivateAddress,
  isPrivateHostAllowlisted,
  normalizeHostname,
} from "./outbound-url";

/**
 * A user-supplied URL was rejected before any request was made.
 * Routes should translate this into a 400, not a 500.
 */
export class UnsafeOutboundUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeOutboundUrlError";
  }
}

export interface SafeOutboundTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

export interface SafeFetchResponse {
  status: number;
  ok: boolean;
  body: string;
  headers: IncomingHttpHeaders;
}

/**
 * Validate a webhook URL and resolve it exactly once. The resolved address is
 * then pinned for the outbound request, so a DNS rebinding response between
 * validation and connection cannot redirect the request to an internal host.
 */
export async function resolveSafeOutboundTarget(
  rawUrl: string,
): Promise<SafeOutboundTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeOutboundUrlError("Webhook URL is not a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeOutboundUrlError("Webhook URL must use HTTP or HTTPS");
  }

  if (url.username || url.password) {
    throw new UnsafeOutboundUrlError(
      "Webhook URL must not contain credentials",
    );
  }

  const hostname = normalizeHostname(url.hostname);
  const allowlisted = isPrivateHostAllowlisted(hostname);

  if (!allowlisted && isBlockedHostname(hostname)) {
    throw new UnsafeOutboundUrlError("Webhook URL must point to a public host");
  }

  const literalFamily = isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    if (!allowlisted && isPrivateAddress(hostname)) {
      throw new UnsafeOutboundUrlError(
        "Webhook URL must point to a public host",
      );
    }

    return {
      url,
      address: hostname,
      family: literalFamily === 6 ? 6 : 4,
    };
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeOutboundUrlError("Webhook host could not be resolved");
  }

  if (records.length === 0) {
    throw new UnsafeOutboundUrlError("Webhook host could not be resolved");
  }

  if (
    !allowlisted &&
    records.some((record) => isPrivateAddress(record.address))
  ) {
    throw new UnsafeOutboundUrlError("Webhook URL must point to a public host");
  }

  const first = records[0]!;
  const family = isIP(first.address) === 6 ? 6 : 4;

  return { url, address: first.address, family };
}

export function createPinnedLookup(
  address: string,
  family: 4 | 6,
): LookupFunction {
  return (_hostname, _options, callback) => {
    callback(null, address, family);
  };
}

/**
 * POST JSON to a validated URL while pinning DNS to the address that was
 * checked. Redirects are never followed: a public endpoint must not be able to
 * bounce the request to an internal address.
 */
export async function postJsonWithPinnedDns(
  rawUrl: string,
  body: string,
  headers: Record<string, string> = {},
  timeoutMs = 10_000,
): Promise<SafeFetchResponse> {
  const target = await resolveSafeOutboundTarget(rawUrl);
  const requestFn =
    target.url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<SafeFetchResponse>((resolve, reject) => {
    const req = requestFn(
      target.url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(body)),
          ...headers,
        },
        lookup: createPinnedLookup(target.address, target.family),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;

        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          // Keep only the first 64 KiB of a response; webhook receivers should
          // not be able to exhaust the sender's memory with a huge body.
          if (size <= 64 * 1024) {
            chunks.push(chunk);
          }
        });
        res.on("error", reject);
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            body: Buffer.concat(chunks).toString("utf8"),
            headers: res.headers,
          });
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Webhook request timed out"));
    });
    req.on("error", reject);
    req.end(body);
  });
}
