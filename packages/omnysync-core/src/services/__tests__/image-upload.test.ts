/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  document: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({
  decrypt: vi.fn((s) => s.replace("enc_", "")),
}));
vi.mock("../authz", () => ({
  requireDocumentAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../wordpress", () => ({
  createWordPressClient: vi.fn(() => ({
    uploadMedia: vi
      .fn()
      .mockResolvedValue({ source_url: "https://cdn.example.com/wp-img.png" }),
  })),
}));

vi.mock("../ghost", () => ({
  createGhostClient: vi.fn(() => ({
    uploadImage: vi.fn().mockResolvedValue({
      images: [{ url: "https://cdn.example.com/ghost-img.png" }],
    }),
  })),
}));

vi.mock("../shopify", () => ({
  createShopifyClient: vi.fn(() => ({
    uploadImage: vi.fn().mockResolvedValue({
      asset: { src: "https://cdn.example.com/shop-img.png" },
    }),
  })),
}));

vi.mock("../webflow", () => ({
  createWebflowClient: vi.fn(() => ({
    uploadMedia: vi
      .fn()
      .mockResolvedValue({ url: "https://cdn.example.com/wf-img.png" }),
  })),
}));

import { prisma } from "../../prisma";
import { uploadImageToDestination, uploadAllImages } from "../image-upload";
import { createWordPressClient } from "../wordpress";
import { createGhostClient } from "../ghost";
import { createWebflowClient } from "../webflow";
import { createShopifyClient } from "../shopify";

describe("Image Upload Service", () => {
  const documentId = "doc-1";
  const userId = "user-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadImageToDestination", () => {
    it("should return null when destination connector is missing", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: null,
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/image.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });

    it("should throw for invalid image URL (private IP)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      await expect(
        uploadImageToDestination(
          "http://192.168.1.1/image.png",
          documentId,
          userId,
        ),
      ).rejects.toThrow("private network");
    });

    it("should return null when image fetch fails", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      global.fetch = vi.fn().mockResolvedValue({ ok: false } as any);

      const result = await uploadImageToDestination(
        "https://example.com/image.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });

    it("should return null for wrong content-type", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Map([["content-type", "image/svg+xml"]]),
        headers: { get: vi.fn().mockReturnValue("image/svg+xml") },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/image.svg",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });

    it("should return null for oversized images", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((name: string) => {
            if (name === "content-type") return "image/png";
            if (name === "content-length") return String(20 * 1024 * 1024);
            return null;
          }),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/large.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });
  });

  describe("Image URL validation (SSRF protection)", () => {
    // On teste la fonction validateImageUrl via uploadImageToDestination

    it("should reject HTTP (non-HTTPS) URLs", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      await expect(
        uploadImageToDestination(
          "http://example.com/image.png",
          documentId,
          userId,
        ),
      ).rejects.toThrow("Only HTTPS");
    });

    it("should reject localhost URLs", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      await expect(
        uploadImageToDestination(
          "https://localhost/image.png",
          documentId,
          userId,
        ),
      ).rejects.toThrow("private network");
    });

    it("should reject IPv6 local addresses (fc00::)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      await expect(
        uploadImageToDestination(
          "https://[fc00::1]/image.png",
          documentId,
          userId,
        ),
      ).rejects.toThrow("private network");
    });

    it("should reject link-local IPv6 (fe80::)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      // new URL() ne supporte pas les zone IDs avec notation standard — il lance une erreur
      await expect(
        uploadImageToDestination(
          "https://[fe80::1%25eth0]/image.png",
          documentId,
          userId,
        ),
      ).rejects.toThrow("Invalid image URL");
    });

    it("should reject link-local IPv6 without zone ID (fe80::)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      await expect(
        uploadImageToDestination(
          "https://[fe80::1]/image.png",
          documentId,
          userId,
        ),
      ).rejects.toThrow("private network");
    });

    it("should reject IPv6 unique local (fd00::)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      await expect(
        uploadImageToDestination(
          "https://[fd12::1]/image.png",
          documentId,
          userId,
        ),
      ).rejects.toThrow("private network");
    });

    it("should reject IPv6 loopback (::1)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      await expect(
        uploadImageToDestination("https://[::1]/image.png", documentId, userId),
      ).rejects.toThrow("private network");
    });

    it("should reject 0.0.0.0", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      await expect(
        uploadImageToDestination(
          "https://0.0.0.0/image.png",
          documentId,
          userId,
        ),
      ).rejects.toThrow("private network");
    });

    it("should reject URLs without a valid protocol", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      // URL sans protocole — new URL() lèvera une erreur
      await expect(
        uploadImageToDestination(
          "ftp://example.com/image.png",
          documentId,
          userId,
        ),
      ).rejects.toThrow("Only HTTPS");
    });
  });

  describe("Content-type edge cases", () => {
    beforeEach(() => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);
    });

    it("should reject when content-type is missing", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/image.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });

    it("should accept image/webp content-type", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((name: string) => {
            if (name === "content-type") return "image/webp";
            if (name === "content-length") return "5000";
            return null;
          }),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5000)),
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/image.webp",
        documentId,
        userId,
      );

      // Avec le mock du client WordPress, l'upload réussit
      expect(result).toBe("https://cdn.example.com/wp-img.png");
    });

    it("should handle missing content-length header", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((name: string) => {
            if (name === "content-type") return "image/png";
            return null; // content-length absent
          }),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/image.png",
        documentId,
        userId,
      );

      // Avec le mock du client WordPress, l'upload réussit
      expect(result).toBe("https://cdn.example.com/wp-img.png");
    });
  });

  describe("Connector-specific upload paths", () => {
    it("should upload to WordPress and return source_url", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((name: string) => {
            if (name === "content-type") return "image/png";
            if (name === "content-length") return "5000";
            return null;
          }),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5000)),
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/image.png",
        documentId,
        userId,
      );

      expect(result).toBe("https://cdn.example.com/wp-img.png");
    });

    it("should upload to Ghost and return image URL", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-2",
          type: "GHOST",
          credentials: "enc_ghost_token",
          config: { siteUrl: "https://example.ghost.io" },
        },
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((name: string) => {
            if (name === "content-type") return "image/png";
            if (name === "content-length") return "5000";
            return null;
          }),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5000)),
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/ghost-image.png",
        documentId,
        userId,
      );

      expect(result).toBe("https://cdn.example.com/ghost-img.png");
    });

    it("should upload to Webflow and return URL", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-3",
          type: "WEBFLOW",
          credentials: "enc_wf_token",
          config: { siteId: "site-abc" },
        },
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((name: string) => {
            if (name === "content-type") return "image/png";
            if (name === "content-length") return "5000";
            return null;
          }),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5000)),
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/wf-image.png",
        documentId,
        userId,
      );

      expect(result).toBe("https://cdn.example.com/wf-img.png");
    });

    it("should upload to Shopify and return asset.src", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-4",
          type: "SHOPIFY",
          credentials: "enc_shop_token",
          config: { shopDomain: "test.myshopify.com" },
        },
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((name: string) => {
            if (name === "content-type") return "image/png";
            if (name === "content-length") return "5000";
            return null;
          }),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5000)),
      } as any);

      const result = await uploadImageToDestination(
        "https://example.com/shop-image.png",
        documentId,
        userId,
      );

      expect(result).toBe("https://cdn.example.com/shop-img.png");
    });
  });

  describe("Connector upload errors (catch block coverage)", () => {
    const commonFetchMock = {
      ok: true,
      headers: { get: vi.fn().mockReturnValue("image/png") },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5000)),
    } as any;

    it("should catch WordPress upload errors and return null", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: { siteUrl: "https://example.com" },
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createWordPressClient).mockReturnValueOnce({
        uploadMedia: vi.fn().mockRejectedValue(new Error("WP upload error")),
      });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Image upload failed for WORDPRESS:"),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should catch Ghost upload errors and return null", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-2",
          type: "GHOST",
          credentials: "enc_ghost_token",
          config: { siteUrl: "https://example.ghost.io" },
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createGhostClient).mockReturnValueOnce({
        uploadImage: vi.fn().mockRejectedValue(new Error("Ghost upload error")),
      });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Image upload failed for GHOST:"),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should catch Webflow upload errors and return null", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-3",
          type: "WEBFLOW",
          credentials: "enc_wf_token",
          config: { siteId: "site-abc" },
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createWebflowClient).mockReturnValueOnce({
        uploadMedia: vi
          .fn()
          .mockRejectedValue(new Error("Webflow upload error")),
      });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Image upload failed for WEBFLOW:"),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should catch Shopify upload errors and return null", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-4",
          type: "SHOPIFY",
          credentials: "enc_shop_token",
          config: { shopDomain: "test.myshopify.com" },
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createShopifyClient).mockReturnValueOnce({
        uploadImage: vi
          .fn()
          .mockRejectedValue(new Error("Shopify upload error")),
      });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Image upload failed for SHOPIFY:"),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("Ghost and Shopify null fallback branches", () => {
    const commonFetchMock = {
      ok: true,
      headers: { get: vi.fn().mockReturnValue("image/png") },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5000)),
    } as any;

    it("should return null when Ghost returns empty images array", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-2",
          type: "GHOST",
          credentials: "enc_ghost_token",
          config: { siteUrl: "https://example.ghost.io" },
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createGhostClient).mockReturnValueOnce({
        uploadImage: vi.fn().mockResolvedValue({ images: [] }),
      });

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });

    it("should return null when Ghost returns images with null url", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-2",
          type: "GHOST",
          credentials: "enc_ghost_token",
          config: { siteUrl: "https://example.ghost.io" },
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createGhostClient).mockReturnValueOnce({
        uploadImage: vi.fn().mockResolvedValue({ images: [{ url: null }] }),
      });

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });

    it("should return null when Shopify returns no asset", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-4",
          type: "SHOPIFY",
          credentials: "enc_shop_token",
          config: { shopDomain: "test.myshopify.com" },
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createShopifyClient).mockReturnValueOnce({
        uploadImage: vi.fn().mockResolvedValue({}),
      });

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });

    it("should return null when Shopify returns asset with null src", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-4",
          type: "SHOPIFY",
          credentials: "enc_shop_token",
          config: { shopDomain: "test.myshopify.com" },
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createShopifyClient).mockReturnValueOnce({
        uploadImage: vi.fn().mockResolvedValue({ asset: { src: null } }),
      });

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });
  });

  describe("Edge cases — missing credentials, config, and unknown connector type", () => {
    const commonFetchMock = {
      ok: true,
      headers: { get: vi.fn().mockReturnValue("image/png") },
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5000)),
    } as any;

    it("should handle missing credentials (nullish fallback)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: null,
          config: { siteUrl: "https://example.com" },
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createWordPressClient).mockReturnValueOnce({
        uploadMedia: vi.fn().mockRejectedValue(new Error("No creds")),
      });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Image upload failed for WORDPRESS:"),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should handle missing config (nullish fallback)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-1",
          type: "WORDPRESS",
          credentials: "enc_creds",
          config: null,
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);
      vi.mocked(createWordPressClient).mockReturnValueOnce({
        uploadMedia: vi.fn().mockRejectedValue(new Error("No config")),
      });
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Image upload failed for WORDPRESS:"),
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should handle unknown connector type (falls through all ifs)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        destConnector: {
          id: "dc-unknown",
          type: "MEDIUM",
          credentials: "enc_token",
          config: {},
        },
      } as any);
      global.fetch = vi.fn().mockResolvedValue(commonFetchMock);

      const result = await uploadImageToDestination(
        "https://example.com/img.png",
        documentId,
        userId,
      );

      expect(result).toBeNull();
    });
  });

  describe("uploadAllImages", () => {
    it("should return empty array when no featuredImage", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        featuredImage: null,
      } as any);

      const result = await uploadAllImages(documentId, userId);

      expect(result).toEqual([]);
    });

    it("should upload featured image and update document record", async () => {
      // First call from uploadAllImages (without destConnector)
      // Second call from uploadImageToDestination (with destConnector)
      vi.mocked(prisma.document.findUnique)
        .mockResolvedValueOnce({
          id: documentId,
          featuredImage: "https://example.com/featured.png",
        } as any)
        .mockResolvedValueOnce({
          id: documentId,
          destConnector: {
            id: "dc-1",
            type: "WORDPRESS",
            credentials: "enc_creds",
            config: { siteUrl: "https://example.com" },
          },
        } as any);

      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((name: string) => {
            if (name === "content-type") return "image/png";
            if (name === "content-length") return "5000";
            return null;
          }),
        },
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(5000)),
      } as any);

      const result = await uploadAllImages(documentId, userId);

      expect(result).toEqual(["https://cdn.example.com/wp-img.png"]);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: documentId },
        data: { featuredImage: "https://cdn.example.com/wp-img.png" },
      });
    });

    it("should return empty array when uploadImageToDestination returns null", async () => {
      vi.mocked(prisma.document.findUnique)
        .mockResolvedValueOnce({
          id: documentId,
          featuredImage: "https://example.com/featured.png",
        } as any)
        .mockResolvedValueOnce({
          id: documentId,
          destConnector: {
            id: "dc-1",
            type: "WORDPRESS",
            credentials: "enc_creds",
            config: { siteUrl: "https://example.com" },
          },
        } as any);

      // Simulate fetch failure → uploadImageToDestination returns null
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      } as any);

      const result = await uploadAllImages(documentId, userId);

      expect(result).toEqual([]);
      expect(prisma.document.update).not.toHaveBeenCalled();
    });
  });
});
