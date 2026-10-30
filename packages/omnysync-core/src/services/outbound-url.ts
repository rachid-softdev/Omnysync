import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard for user-supplied connector URLs.
 *
 * Connector credentials are stored per organization, so a malicious or
 * compromised account must not be able to make the server fetch its own
 * metadata service, localhost admin panels, or private-network hosts.
 *
 * `ALLOW_PRIVATE_CONNECTOR_HOSTS` is a comma-separated allowlist for local
 * development / self-hosted destinations (for example
 * `localhost,127.0.0.1,wordpress.internal`).
 */
export interface SafeOutboundUrlOptions {
  /**
   * Explicitly allow a private host. Only use this from trusted server code
   * with a value that did not come directly from the request body.
   */
  allowPrivate?: boolean;
}

export function normalizeHostname(hostname: string): string {
  return hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function privateHostAllowlist(): string[] {
  return (process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function isPrivateHostAllowlisted(hostname: string): boolean {
  return privateHostAllowlist().includes(normalizeHostname(hostname));
}

export function isBlockedHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "localhost.localdomain" ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata" ||
    hostname === "instance-data"
  );
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    // Unparseable IPv4-looking input is not safe to treat as public.
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10
    (a === 169 && b === 254) || // 169.254.0.0/16 (link-local / metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 0) || // 192.0.0.0/24
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15
    (a === 198 && b === 51) || // 198.51.100.0/24
    (a === 203 && b === 0) || // 203.0.113.0/24
    a >= 224 // multicast + reserved
  );
}

function isPrivateIPv6(address: string): boolean {
  const value = address.toLowerCase();

  if (value === "::" || value === "::1") return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1). `new URL` normalizes many forms, but
  // handle both dotted and hex forms defensively.
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    if (isIP(mapped) === 4) return isPrivateIPv4(mapped);

    const hexParts = mapped.split(":");
    if (hexParts.length === 2) {
      const high = Number.parseInt(hexParts[0], 16);
      const low = Number.parseInt(hexParts[1], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        const octets = [
          (high >> 8) & 0xff,
          high & 0xff,
          (low >> 8) & 0xff,
          low & 0xff,
        ];
        return isPrivateIPv4(octets.join("."));
      }
    }
  }

  // IPv4-compatible addresses (::a.b.c.d) are deprecated but some stacks
  // still route them to the embedded IPv4 address. Block the whole range;
  // public IPv4-mapped addresses were handled above.
  if (value.startsWith("::")) return true;

  return (
    value.startsWith("fc") || // fc00::/7 unique local
    value.startsWith("fd") ||
    value.startsWith("fe8") || // fe80::/10 link-local
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("fec") || // fec0::/10 site-local (deprecated)
    value.startsWith("fed") ||
    value.startsWith("fee") ||
    value.startsWith("fef") ||
    value.startsWith("ff") || // multicast
    value.startsWith("64:ff9b:") || // NAT64: can embed a private IPv4 address
    value.startsWith("2002:") || // 6to4: can embed a private IPv4 address
    value.startsWith("2001:0:") || // Teredo: can embed a private IPv4 address
    value.startsWith("2001:db8") // documentation range
  );
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true;
}

/**
 * Validate a connector base URL and return its parsed form.
 *
 * Rules:
 * - HTTPS only (connector credentials must never travel in clear text)
 * - no embedded username/password
 * - hostname must not be localhost / a private address / a private DNS result
 */
export async function assertSafeOutboundUrl(
  rawUrl: string,
  options: SafeOutboundUrlOptions = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Connector URL is not a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("Connector URL must use HTTPS");
  }

  if (url.username || url.password) {
    throw new Error("Connector URL must not contain credentials");
  }

  const hostname = normalizeHostname(url.hostname);
  const allowlisted = privateHostAllowlist().includes(hostname);

  if (options.allowPrivate || allowlisted) {
    return url;
  }

  if (
    isBlockedHostname(hostname) ||
    (isIP(hostname) !== 0 && isPrivateAddress(hostname))
  ) {
    throw new Error("Connector URL must point to a public host");
  }

  // Resolve DNS so a hostname that points at a private address is rejected
  // too. Tests skip DNS to stay hermetic; the literal checks above still run.
  if (process.env.NODE_ENV !== "test" && isIP(hostname) === 0) {
    let addresses: Array<{ address: string }>;
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new Error("Connector host could not be resolved");
    }

    if (addresses.length === 0) {
      throw new Error("Connector host could not be resolved");
    }

    if (addresses.some((record) => isPrivateAddress(record.address))) {
      throw new Error("Connector URL must point to a public host");
    }
  }

  return url;
}
