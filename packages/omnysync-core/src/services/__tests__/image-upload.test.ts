/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  document: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));
vi.mock("../../crypto", () => ({ decrypt: vi.fn((s) => s.replace("enc_", "")) }));
vi.mock("../authz", () => ({ requireDocumentAccess: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "../../prisma";
import {
  uploadImageToDestination,
  uploadAllImages,
} from "../image-upload";

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
        destConnector: { id: "dc-1", type: "WORDPRESS", credentials: "enc_creds", config: { siteUrl: "https://example.com" } },
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
        destConnector: { id: "dc-1", type: "WORDPRESS", credentials: "enc_creds", config: { siteUrl: "https://example.com" } },
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
        destConnector: { id: "dc-1", type: "WORDPRESS", credentials: "enc_creds", config: { siteUrl: "https://example.com" } },
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
        destConnector: { id: "dc-1", type: "WORDPRESS", credentials: "enc_creds", config: { siteUrl: "https://example.com" } },
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: vi.fn().mockImplementation((name: string) => {
          if (name === "content-type") return "image/png";
          if (name === "content-length") return String(20 * 1024 * 1024);
          return null;
        })},
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

  describe("uploadAllImages", () => {
    it("should return empty array when no featuredImage", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        featuredImage: null,
      } as any);

      const result = await uploadAllImages(documentId, userId);

      expect(result).toEqual([]);
    });
  });
});
