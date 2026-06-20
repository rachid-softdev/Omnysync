/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Import all schemas and helpers from the validations module
import {
  // Common schemas
  paginationSchema,
  uuidSchema,
  nonEmptyString,
  emailSchema,
  urlSchema,

  // Connector schemas
  connectorTypes,
  createConnectorSchema,
  updateConnectorSchema,
  testConnectionSchema,
  wordpressConfigSchema,
  ghostConfigSchema,
  webflowConfigSchema,
  shopifyConfigSchema,
  airtableConfigSchema,
  contentfulConfigSchema,
  mediumConfigSchema,

  // Document schemas
  createDocumentSchema,
  updateDocumentSchema,
  documentQuerySchema,

  // Sync schemas
  createSyncSchema,
  scheduleSyncSchema,
  checkRemoteSchema,
  resolveConflictSchema,
  createApprovalRequestSchema,
  approvalResponseSchema,

  // Team schemas
  inviteMemberSchema,
  updateMemberRoleSchema,
  createOrganizationSchema,
  updateOrganizationSchema,

  // Stripe schemas
  createCheckoutSchema,
  createPortalSchema,

  // Analytics schemas
  analyticsQuerySchema,

  // Helpers
  validate,
  withValidation,
  validateQuery,
} from "../index";

describe("Validations module", () => {
  // ============================================================
  // COMMON SCHEMAS
  // ============================================================
  describe("paginationSchema", () => {
    it("parses valid page and limit", () => {
      const result = paginationSchema.parse({ page: "2", limit: "50" });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });

    it("applies defaults when values are missing", () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("rejects page < 1", () => {
      expect(() => paginationSchema.parse({ page: "0" })).toThrow();
    });

    it("rejects limit > 100", () => {
      expect(() => paginationSchema.parse({ limit: "101" })).toThrow();
    });

    it("rejects non-numeric input", () => {
      expect(() => paginationSchema.parse({ page: "abc" })).toThrow();
    });
  });

  describe("uuidSchema", () => {
    it("accepts valid UUID", () => {
      const result = uuidSchema.parse("550e8400-e29b-41d4-a716-446655440000");
      expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("rejects invalid UUID", () => {
      expect(() => uuidSchema.parse("not-a-uuid")).toThrow();
    });

    it("rejects empty string", () => {
      expect(() => uuidSchema.parse("")).toThrow();
    });
  });

  describe("nonEmptyString", () => {
    it("accepts non-empty string", () => {
      expect(nonEmptyString.parse("hello")).toBe("hello");
    });

    it("rejects empty string", () => {
      expect(() => nonEmptyString.parse("")).toThrow();
    });
  });

  describe("emailSchema", () => {
    it("accepts valid email", () => {
      const result = emailSchema.parse("user@example.com");
      expect(result).toBe("user@example.com");
    });

    it("rejects invalid email", () => {
      expect(() => emailSchema.parse("not-an-email")).toThrow();
    });

    it("rejects empty string", () => {
      expect(() => emailSchema.parse("")).toThrow();
    });
  });

  describe("urlSchema", () => {
    it("accepts valid URL", () => {
      const result = urlSchema.parse("https://example.com");
      expect(result).toBe("https://example.com");
    });

    it("accepts undefined (optional)", () => {
      const result = urlSchema.parse(undefined);
      expect(result).toBeUndefined();
    });

    it("rejects invalid URL", () => {
      expect(() => urlSchema.parse("not-a-url")).toThrow();
    });
  });

  // ============================================================
  // CONNECTOR SCHEMAS
  // ============================================================
  describe("connectorTypes", () => {
    it("includes expected connector types", () => {
      expect(connectorTypes).toContain("GOOGLE_DOCS");
      expect(connectorTypes).toContain("NOTION");
      expect(connectorTypes).toContain("WORDPRESS");
      expect(connectorTypes).toContain("AIRTABLE");
      expect(connectorTypes).toContain("CONTENTFUL");
      expect(connectorTypes).toContain("MEDIUM");
    });
  });

  describe("createConnectorSchema", () => {
    const validConnector = {
      type: "AIRTABLE",
      name: "My Airtable Connector",
    };

    it("accepts valid connector data", () => {
      const result = createConnectorSchema.parse(validConnector);
      expect(result.type).toBe("AIRTABLE");
      expect(result.name).toBe("My Airtable Connector");
    });

    it("rejects invalid type", () => {
      expect(() =>
        createConnectorSchema.parse({ ...validConnector, type: "INVALID" }),
      ).toThrow();
    });

    it("rejects empty name", () => {
      expect(() =>
        createConnectorSchema.parse({ ...validConnector, name: "" }),
      ).toThrow();
    });

    it("rejects name longer than 100 chars", () => {
      expect(() =>
        createConnectorSchema.parse({
          ...validConnector,
          name: "A".repeat(101),
        }),
      ).toThrow();
    });

    it("accepts optional credentials and config", () => {
      const result = createConnectorSchema.parse({
        ...validConnector,
        credentials: { apiKey: "secret" },
        config: { baseId: "abc" },
      });
      expect(result.credentials).toEqual({ apiKey: "secret" });
      expect(result.config).toEqual({ baseId: "abc" });
    });
  });

  describe("updateConnectorSchema", () => {
    it("accepts partial update with name", () => {
      const result = updateConnectorSchema.parse({ name: "New Name" });
      expect(result.name).toBe("New Name");
    });

    it("accepts status update", () => {
      const result = updateConnectorSchema.parse({ status: "ACTIVE" });
      expect(result.status).toBe("ACTIVE");
    });

    it("rejects invalid status", () => {
      expect(() =>
        updateConnectorSchema.parse({ status: "UNKNOWN" }),
      ).toThrow();
    });

    it("accepts empty object (no required fields)", () => {
      const result = updateConnectorSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("testConnectionSchema", () => {
    it("accepts valid test connection data", () => {
      const result = testConnectionSchema.parse({
        type: "WORDPRESS",
        config: { siteUrl: "https://example.com" },
        credentials: { username: "admin", password: "pass" },
      });
      expect(result.type).toBe("WORDPRESS");
    });
  });

  describe("provider-specific config schemas", () => {
    it("wordpressConfigSchema accepts valid data", () => {
      const result = wordpressConfigSchema.parse({
        siteUrl: "https://example.com",
        username: "admin",
        password: "pass",
      });
      expect(result.siteUrl).toBe("https://example.com");
    });

    it("wordpressConfigSchema rejects missing fields", () => {
      expect(() =>
        wordpressConfigSchema.parse({ siteUrl: "https://example.com" }),
      ).toThrow();
    });

    it("ghostConfigSchema accepts valid data", () => {
      const result = ghostConfigSchema.parse({
        siteUrl: "https://ghost.example.com",
        adminApiKey: "key123",
      });
      expect(result.adminApiKey).toBe("key123");
    });

    it("webflowConfigSchema accepts valid data", () => {
      const result = webflowConfigSchema.parse({
        siteId: "site-123",
        accessToken: "token-456",
      });
      expect(result.siteId).toBe("site-123");
    });

    it("shopifyConfigSchema accepts valid data", () => {
      const result = shopifyConfigSchema.parse({
        shopDomain: "my-store.myshopify.com",
        accessToken: "shpat_abc",
      });
      expect(result.shopDomain).toBe("my-store.myshopify.com");
    });

    it("airtableConfigSchema accepts valid data", () => {
      const result = airtableConfigSchema.parse({
        apiKey: "key_abc",
        baseId: "base-1",
      });
      expect(result.apiKey).toBe("key_abc");
    });

    it("contentfulConfigSchema accepts valid data", () => {
      const result = contentfulConfigSchema.parse({
        accessToken: "cf_token",
        spaceId: "space-1",
      });
      expect(result.accessToken).toBe("cf_token");
    });

    it("mediumConfigSchema accepts valid data", () => {
      const result = mediumConfigSchema.parse({
        accessToken: "mdm_token",
        publicationId: "pub-1",
      });
      expect(result.accessToken).toBe("mdm_token");
    });
  });

  // ============================================================
  // DOCUMENT SCHEMAS
  // ============================================================
  describe("createDocumentSchema", () => {
    const validDoc = { title: "My Document" };

    it("accepts valid document with defaults", () => {
      const result = createDocumentSchema.parse(validDoc);
      expect(result.title).toBe("My Document");
      expect(result.status).toBe("DRAFT");
      expect(result.categories).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.seoKeywords).toEqual([]);
    });

    it("rejects empty title", () => {
      expect(() => createDocumentSchema.parse({ title: "" })).toThrow();
    });

    it("rejects title longer than 200 chars", () => {
      expect(() =>
        createDocumentSchema.parse({ title: "A".repeat(201) }),
      ).toThrow();
    });

    it("accepts optional SEO fields", () => {
      const result = createDocumentSchema.parse({
        ...validDoc,
        seoTitle: "My SEO Title",
        seoDescription: "Short description",
        seoKeywords: ["kw1", "kw2"],
      });
      expect(result.seoTitle).toBe("My SEO Title");
      expect(result.seoDescription).toBe("Short description");
    });

    it("rejects seoTitle longer than 60 chars", () => {
      expect(() =>
        createDocumentSchema.parse({
          title: "Doc",
          seoTitle: "A".repeat(61),
        }),
      ).toThrow();
    });

    it("rejects seoDescription longer than 160 chars", () => {
      expect(() =>
        createDocumentSchema.parse({
          title: "Doc",
          seoDescription: "A".repeat(161),
        }),
      ).toThrow();
    });

    it("rejects invalid document status", () => {
      expect(() =>
        createDocumentSchema.parse({ title: "Doc", status: "DELETED" }),
      ).toThrow();
    });

    it("accepts featuredImage as URL", () => {
      const result = createDocumentSchema.parse({
        ...validDoc,
        featuredImage: "https://example.com/image.png",
      });
      expect(result.featuredImage).toBe("https://example.com/image.png");
    });
  });

  describe("updateDocumentSchema", () => {
    it("accepts partial update", () => {
      const result = updateDocumentSchema.parse({ title: "Updated" });
      expect(result.title).toBe("Updated");
    });

    it("accepts sync status update", () => {
      const result = updateDocumentSchema.parse({ syncStatus: "SYNCED" });
      expect(result.syncStatus).toBe("SYNCED");
    });

    it("rejects invalid syncStatus", () => {
      expect(() =>
        updateDocumentSchema.parse({ syncStatus: "INVALID" }),
      ).toThrow();
    });

    it("accepts autoSyncEnabled boolean", () => {
      const result = updateDocumentSchema.parse({ autoSyncEnabled: true });
      expect(result.autoSyncEnabled).toBe(true);
    });
  });

  describe("documentQuerySchema", () => {
    it("applies pagination defaults", () => {
      const result = documentQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("accepts optional filters", () => {
      const result = documentQuerySchema.parse({
        status: "PUBLISHED",
        syncStatus: "SYNCED",
        search: "keyword",
      });
      expect(result.status).toBe("PUBLISHED");
      expect(result.syncStatus).toBe("SYNCED");
    });
  });

  // ============================================================
  // SYNC SCHEMAS
  // ============================================================
  describe("createSyncSchema", () => {
    const validSync = {
      sourceConnectorId: "550e8400-e29b-41d4-a716-446655440000",
      destConnectorId: "550e8400-e29b-41d4-a716-446655440001",
      sourceDocumentId: "doc-123",
    };

    it("accepts valid sync data", () => {
      const result = createSyncSchema.parse(validSync);
      expect(result.sourceDocumentId).toBe("doc-123");
    });

    it("rejects invalid sourceConnectorId", () => {
      expect(() =>
        createSyncSchema.parse({ ...validSync, sourceConnectorId: "bad" }),
      ).toThrow();
    });

    it("rejects empty sourceDocumentId", () => {
      expect(() =>
        createSyncSchema.parse({ ...validSync, sourceDocumentId: "" }),
      ).toThrow();
    });
  });

  describe("scheduleSyncSchema", () => {
    it("accepts valid schedule", () => {
      const result = scheduleSyncSchema.parse({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
        frequency: "DAILY",
      });
      expect(result.frequency).toBe("DAILY");
    });

    it("rejects invalid frequency", () => {
      expect(() =>
        scheduleSyncSchema.parse({
          documentId: "550e8400-e29b-41d4-a716-446655440000",
          frequency: "HOURLY",
        }),
      ).toThrow();
    });
  });

  describe("checkRemoteSchema", () => {
    it("accepts valid documentId", () => {
      const result = checkRemoteSchema.parse({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.documentId).toBeDefined();
    });
  });

  describe("resolveConflictSchema", () => {
    it("accepts valid resolution", () => {
      const result = resolveConflictSchema.parse({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
        direction: "source-wins",
      });
      expect(result.direction).toBe("source-wins");
    });

    it("rejects invalid direction", () => {
      expect(() =>
        resolveConflictSchema.parse({
          documentId: "550e8400-e29b-41d4-a716-446655440000",
          direction: "both-wins",
        }),
      ).toThrow();
    });
  });

  describe("createApprovalRequestSchema", () => {
    it("applies default expiry and accepts comments", () => {
      const result = createApprovalRequestSchema.parse({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
        comments: "Please review",
      });
      expect(result.expiresIn).toBe(7);
      expect(result.comments).toBe("Please review");
    });

    it("rejects expiresIn < 1", () => {
      expect(() =>
        createApprovalRequestSchema.parse({
          documentId: "550e8400-e29b-41d4-a716-446655440000",
          expiresIn: 0,
        }),
      ).toThrow();
    });
  });

  describe("approvalResponseSchema", () => {
    it("accepts approved action", () => {
      const result = approvalResponseSchema.parse({ action: "APPROVED" });
      expect(result.action).toBe("APPROVED");
    });

    it("accepts rejected action with comments", () => {
      const result = approvalResponseSchema.parse({
        action: "REJECTED",
        comments: "Needs revision",
      });
      expect(result.comments).toBe("Needs revision");
    });
  });

  // ============================================================
  // TEAM SCHEMAS
  // ============================================================
  describe("inviteMemberSchema", () => {
    it("accepts valid invite with default role", () => {
      const result = inviteMemberSchema.parse({ email: "user@example.com" });
      expect(result.role).toBe("MEMBER");
    });

    it("accepts admin role", () => {
      const result = inviteMemberSchema.parse({
        email: "admin@example.com",
        role: "ADMIN",
      });
      expect(result.role).toBe("ADMIN");
    });
  });

  describe("updateMemberRoleSchema", () => {
    it("accepts valid role update", () => {
      const result = updateMemberRoleSchema.parse({
        memberId: "550e8400-e29b-41d4-a716-446655440000",
        role: "ADMIN",
      });
      expect(result.role).toBe("ADMIN");
    });
  });

  describe("createOrganizationSchema", () => {
    it("accepts valid org data", () => {
      const result = createOrganizationSchema.parse({ name: "My Org" });
      expect(result.name).toBe("My Org");
    });

    it("rejects empty name", () => {
      expect(() => createOrganizationSchema.parse({ name: "" })).toThrow();
    });

    it("rejects name longer than 100 chars", () => {
      expect(() =>
        createOrganizationSchema.parse({ name: "A".repeat(101) }),
      ).toThrow();
    });

    it("accepts optional description", () => {
      const result = createOrganizationSchema.parse({
        name: "Org",
        description: "A description",
      });
      expect(result.description).toBe("A description");
    });
  });

  describe("updateOrganizationSchema", () => {
    it("accepts partial update with settings", () => {
      const result = updateOrganizationSchema.parse({
        name: "New Name",
        settings: { theme: "dark" },
      });
      expect(result.settings).toEqual({ theme: "dark" });
    });
  });

  // ============================================================
  // STRIPE SCHEMAS
  // ============================================================
  describe("createCheckoutSchema", () => {
    it("accepts valid checkout data", () => {
      const result = createCheckoutSchema.parse({ priceId: "price_123" });
      expect(result.priceId).toBe("price_123");
    });

    it("rejects empty priceId", () => {
      expect(() => createCheckoutSchema.parse({ priceId: "" })).toThrow();
    });
  });

  describe("createPortalSchema", () => {
    it("accepts valid return URL", () => {
      const result = createPortalSchema.parse({
        returnUrl: "https://app.omnysync.com/settings",
      });
      expect(result.returnUrl).toBe("https://app.omnysync.com/settings");
    });

    it("accepts undefined returnUrl", () => {
      const result = createPortalSchema.parse({});
      expect(result.returnUrl).toBeUndefined();
    });
  });

  // ============================================================
  // ANALYTICS SCHEMAS
  // ============================================================
  describe("analyticsQuerySchema", () => {
    it("applies default period", () => {
      const result = analyticsQuerySchema.parse({});
      expect(result.period).toBe(30);
    });

    it("accepts valid period and documentId", () => {
      const result = analyticsQuerySchema.parse({
        period: "7",
        documentId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.period).toBe(7);
    });

    it("rejects period > 365", () => {
      expect(() => analyticsQuerySchema.parse({ period: "366" })).toThrow();
    });
  });

  // ============================================================
  // VALIDATION HELPERS
  // ============================================================
  describe("validate()", () => {
    const testSchema = z.object({ name: z.string() });

    it("returns success with parsed data", () => {
      const result = validate(testSchema, { name: "Test" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Test");
      }
    });

    it("returns error for invalid data", () => {
      const result = validate(testSchema, { name: 123 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("name");
      }
    });
  });

  describe("validateQuery()", () => {
    it("parses query params from URL", () => {
      const result = validateQuery(
        z.object({ page: z.coerce.number() }),
        "https://example.com?page=5",
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
      }
    });

    it("returns error for invalid query params", () => {
      const result = validateQuery(
        z.object({ page: z.coerce.number().positive() }),
        "https://example.com?page=-1",
      );
      expect(result.success).toBe(false);
    });
  });

  describe("withValidation()", () => {
    it("calls handler when validation passes", async () => {
      const handler = vi.fn().mockResolvedValue(new Response("ok"));
      const wrapped = withValidation(z.object({ name: z.string() }), handler);

      const request = new Request("https://example.com", {
        method: "POST",
        body: JSON.stringify({ name: "Test" }),
      });
      const response = await wrapped(request);
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledWith({ name: "Test" });
    });

    it("returns 400 when validation fails", async () => {
      const handler = vi.fn();
      const wrapped = withValidation(z.object({ name: z.string() }), handler);

      const request = new Request("https://example.com", {
        method: "POST",
        body: JSON.stringify({ name: 123 }),
      });
      const response = await wrapped(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Validation failed");
      expect(handler).not.toHaveBeenCalled();
    });

    it("handles invalid JSON body", async () => {
      const handler = vi.fn();
      const wrapped = withValidation(z.object({ name: z.string() }), handler);

      const request = new Request("https://example.com", {
        method: "POST",
        body: "not-json",
      });
      const response = await wrapped(request);
      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // TYPE EXPORTS
  // ============================================================
  describe("Type exports", () => {
    it("exports expected types", () => {
      // TypeScript will catch type mismatches at compile time.
      // At runtime we verify the schemas exist.
      expect(createConnectorSchema).toBeDefined();
      expect(createDocumentSchema).toBeDefined();
      expect(createSyncSchema).toBeDefined();
      expect(inviteMemberSchema).toBeDefined();
      expect(createOrganizationSchema).toBeDefined();
      expect(createCheckoutSchema).toBeDefined();
      expect(analyticsQuerySchema).toBeDefined();
    });
  });
});
