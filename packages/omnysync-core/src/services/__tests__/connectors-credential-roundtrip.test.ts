/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Connector Credential Round-Trip Tests (TAE #4 — P1 Connectors)
 *
 * The other connector test files mock `../crypto` as a pass-through
 * (`enc_${s}`), which means the REAL encrypt → decrypt contract that
 * `services/sync.ts → publishToDestination` relies on is never exercised.
 *
 * This file uses the REAL crypto module (AES-256-GCM, env-provided key) and
 * asserts that every connector's `save*Connector` stores credentials that
 * survive a real encrypt → decrypt cycle matching what the publish path
 * expects:
 *   - WORDPRESS : credentials are `base64(username:password)`
 *   - GHOST/WEBFLOW/SHOPIFY/NOTION/MEDIUM/CONTENTFUL : credentials are the raw token
 *   - GOOGLE_DOCS: credentials are `JSON.stringify({ accessToken, refreshToken })`
 *   - AIRTABLE   : credentials are the raw api key
 *
 * It also asserts the connector record shape (type, status, config.siteUrl).
 *
 * External deps (prisma, http) are mocked. The `@/` alias resolves to src, and
 * crypto/errors are real (proven to run locally via crypto/credentials.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  connector: {
    create: vi.fn(async (args: any) => args.data),
  },
}));

// fetchWithRetry is mocked; its return shape is branched by URL so the
// save-time validation calls (Medium /me, Contentful /spaces, Airtable /meta/bases)
// get the payload each connector expects.
const mockFetch = vi.hoisted(() =>
  vi.fn(async (url: string) => {
    if (url.includes("/me")) {
      return {
        data: {
          id: "medium-u1",
          username: "alice",
          name: "Alice",
          url: "https://medium.com/@alice",
          imageUrl: "",
        },
      };
    }
    if (url.includes("/spaces")) {
      return { items: [{ id: "space-1", name: "Space" }] };
    }
    if (url.includes("/meta/bases")) {
      return [{ id: "base-1", name: "Base" }];
    }
    return {};
  }),
);

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../http", () => ({
  fetchWithRetry: mockFetch,
  fetchWithTimeout: vi.fn(),
}));

// NOTE: ../crypto is intentionally NOT mocked → real AES-256-GCM round-trip.
import { prisma } from "../../prisma";
import { decrypt } from "../../crypto";

import { saveWordPressConnector } from "../wordpress";
import { saveGhostConnector } from "../ghost";
import { saveWebflowConnector } from "../webflow";
import { saveShopifyConnector } from "../shopify";
import { saveGoogleDocsConnector } from "../google-docs";
import { saveNotionConnector } from "../notion";
import { saveMediumConnector } from "../medium";
import { saveContentfulConnector } from "../contentful";
import { saveAirtableConnector } from "../airtable";

function lastCreated(): any {
  return vi.mocked(prisma.connector.create).mock.calls.at(-1)![0].data;
}

describe("Connector credential encrypt → decrypt round-trip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("WordPress", () => {
    it("encrypts base64(username:password) and stores siteUrl hostname", async () => {
      const created = await saveWordPressConnector(
        "user-1",
        "org-1",
        "https://wp.example.com",
        "bob",
        "s3cr3t",
      );

      expect(created.type).toBe("WORDPRESS");
      expect(created.status).toBe("ACTIVE");
      expect(created.config).toEqual({ siteUrl: "https://wp.example.com" });
      expect(created.name).toContain("wp.example.com");

      const decrypted = decrypt(created.credentials);
      expect(Buffer.from(decrypted, "base64").toString()).toBe("bob:s3cr3t");
    });
  });

  describe("Ghost", () => {
    it("encrypts the admin API key and stores siteUrl hostname", async () => {
      const created = await saveGhostConnector(
        "user-1",
        "org-1",
        "https://ghost.example.com",
        "id123:secret-key",
      );

      expect(created.type).toBe("GHOST");
      expect(created.status).toBe("ACTIVE");
      expect(decrypt(created.credentials)).toBe("id123:secret-key");
      expect(created.name).toContain("ghost.example.com");
    });
  });

  describe("Webflow", () => {
    it("encrypts the access token and stores siteId", async () => {
      const created = await saveWebflowConnector(
        "user-1",
        "org-1",
        "site-abc",
        "wf-token",
      );

      expect(created.type).toBe("WEBFLOW");
      expect(created.config).toEqual({ siteId: "site-abc" });
      expect(decrypt(created.credentials)).toBe("wf-token");
    });
  });

  describe("Shopify", () => {
    it("encrypts the access token and stores shopDomain", async () => {
      const created = await saveShopifyConnector(
        "user-1",
        "org-1",
        "my-store.myshopify.com",
        "shpat-token",
      );

      expect(created.type).toBe("SHOPIFY");
      expect(created.config).toEqual({
        shopDomain: "my-store.myshopify.com",
      });
      expect(decrypt(created.credentials)).toBe("shpat-token");
    });
  });

  describe("Google Docs", () => {
    it("encrypts JSON of access + refresh tokens", async () => {
      const created = await saveGoogleDocsConnector(
        "user-1",
        "org-1",
        "ya29.access",
        "rt-refresh",
      );

      expect(created.type).toBe("GOOGLE_DOCS");
      const decrypted = JSON.parse(decrypt(created.credentials));
      expect(decrypted).toEqual({
        accessToken: "ya29.access",
        refreshToken: "rt-refresh",
      });
    });
  });

  describe("Notion", () => {
    it("encrypts the access token", async () => {
      const created = await saveNotionConnector("user-1", "org-1", "secret_nt");

      expect(created.type).toBe("NOTION");
      expect(decrypt(created.credentials)).toBe("secret_nt");
    });
  });

  describe("Medium", () => {
    it("validates the token, encrypts it, and embeds user info in config", async () => {
      const created = await saveMediumConnector(
        "user-1",
        "org-1",
        "medium-token",
        { publicationId: "pub-9" },
      );

      expect(created.type).toBe("MEDIUM");
      expect(decrypt(created.credentials)).toBe("medium-token");
      const cfg = JSON.parse(created.config as unknown as string);
      expect(cfg).toMatchObject({
        userId: "medium-u1",
        username: "alice",
        publicationId: "pub-9",
      });
    });

    it("works without an optional publication config", async () => {
      const created = await saveMediumConnector(
        "user-1",
        "org-1",
        "medium-token",
      );
      expect(decrypt(created.credentials)).toBe("medium-token");
      const cfg = JSON.parse(created.config as unknown as string);
      expect(cfg.userId).toBe("medium-u1");
    });
  });

  describe("Contentful", () => {
    it("validates the token then encrypts it", async () => {
      const created = await saveContentfulConnector(
        "user-1",
        "org-1",
        "cf-token",
        { spaceId: "space-1", contentTypeId: "article" },
      );

      expect(created.type).toBe("CONTENTFUL");
      expect(decrypt(created.credentials)).toBe("cf-token");
      expect(JSON.parse(created.config as unknown as string)).toMatchObject({
        spaceId: "space-1",
        contentTypeId: "article",
      });
    });
  });

  describe("Airtable", () => {
    it("validates the api key then encrypts it", async () => {
      const created = await saveAirtableConnector(
        "user-1",
        "org-1",
        "pat-airtable",
        { baseId: "base-1", tableId: "tbl-1" },
      );

      expect(created.type).toBe("AIRTABLE");
      expect(decrypt(created.credentials)).toBe("pat-airtable");
      expect(JSON.parse(created.config as unknown as string)).toMatchObject({
        baseId: "base-1",
        tableId: "tbl-1",
      });
    });
  });

  describe("malformed URL handling at save time", () => {
    it("WordPress save throws on an invalid siteUrl (new URL fails)", async () => {
      await expect(
        saveWordPressConnector("u", "o", "not a url", "bob", "pw"),
      ).rejects.toThrow();
    });

    it("Ghost save throws on an invalid siteUrl (new URL fails)", async () => {
      await expect(
        saveGhostConnector("u", "o", "::not a url::", "id:secret"),
      ).rejects.toThrow();
    });
  });
});
