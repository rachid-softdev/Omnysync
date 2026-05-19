import { z } from "zod";

// Sync operations
export const createSyncSchema = z.object({
  sourceConnectorId: z.string().uuid(),
  destConnectorId: z.string().uuid(),
  sourceDocumentId: z.string().min(1),
  title: z.string().optional(),
});

export const checkRemoteSchema = z.object({
  documentId: z.string().uuid(),
});

// Connectors
export const createConnectorSchema = z.object({
  type: z.enum([
    "GOOGLE_DOCS",
    "NOTION",
    "WORDPRESS",
    "GHOST",
    "WEBFLOW",
    "SHOPIFY",
    "AIRTABLE",
    "CONTENTFUL",
    "MEDIUM",
  ]),
  name: z.string().min(1).max(100),
  credentials: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
});

// Queue jobs
export const queueJobSchema = z.object({
  type: z.string(),
  payload: z.record(z.unknown()),
  documentId: z.string().uuid().optional(),
});

// Stripe
export const checkoutSchema = z.object({
  priceId: z.string().min(1),
});

// Common
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Type exports
export type CreateSyncInput = z.infer<typeof createSyncSchema>;
export type CheckRemoteInput = z.infer<typeof checkRemoteSchema>;
export type CreateConnectorInput = z.infer<typeof createConnectorSchema>;
export type QueueJobInput = z.infer<typeof queueJobSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
