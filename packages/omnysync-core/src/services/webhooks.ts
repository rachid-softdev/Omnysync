import { createHmac, randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { postJsonWithPinnedDns, UnsafeOutboundUrlError } from "./safe-fetch";

export type SyncWebhookEvent = "sync.completed" | "sync.failed";

export interface DispatchSyncWebhooksInput {
  organizationId: string;
  connectorId: string;
  documentId: string;
  documentTitle: string;
  userId: string;
  success: boolean;
  error?: string;
}

interface WebhookEndpointRecord {
  id: string;
  url: string;
  secret: string | null;
  type: string;
}

function appOrigin(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message.slice(0, 500);
}

async function writeDeliveryLog(input: {
  organizationId: string;
  userId: string;
  documentId: string;
  webhookId: string;
  event: SyncWebhookEvent;
  success: boolean;
  message: string;
  details: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.syncLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        documentId: input.documentId,
        action: input.success ? "webhook_delivered" : "webhook_failed",
        status: input.success ? "SUCCESS" : "ERROR",
        message: input.message,
        details: {
          webhookId: input.webhookId,
          event: input.event,
          ...input.details,
        },
      },
    });
  } catch (logError) {
    console.error("Failed to write webhook delivery log:", logError);
  }
}

/**
 * Deliver a sync event to every active webhook endpoint attached to the
 * destination connector. Delivery is best-effort: a failing endpoint must never
 * turn a successful sync into a failure, and each endpoint gets its own log row.
 */
export async function dispatchSyncWebhooks(
  input: DispatchSyncWebhooksInput,
): Promise<void> {
  const event: SyncWebhookEvent = input.success
    ? "sync.completed"
    : "sync.failed";

  let endpoints: WebhookEndpointRecord[];
  try {
    endpoints = (await prisma.webhookEndpoint.findMany({
      where: {
        organizationId: input.organizationId,
        connectorId: input.connectorId,
        isActive: true,
      },
      select: {
        id: true,
        url: true,
        secret: true,
        type: true,
      },
    })) as WebhookEndpointRecord[];
  } catch (error) {
    console.error("Failed to load webhook endpoints:", error);
    return;
  }

  if (endpoints.length === 0) {
    return;
  }

  const documentUrl = `${appOrigin()}/dashboard/documents/${input.documentId}`;

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const deliveryId = randomUUID();
      const timestamp = new Date().toISOString();
      const payload = {
        event,
        timestamp,
        deliveryId,
        organizationId: input.organizationId,
        document: {
          id: input.documentId,
          title: input.documentTitle,
          url: documentUrl,
        },
        ...(input.error ? { error: input.error } : {}),
      };
      const body = JSON.stringify(payload);

      const headers: Record<string, string> = {
        "User-Agent": "Omnysync-Webhook/1.0",
        "X-Omnysync-Event": event,
        "X-Omnysync-Delivery": deliveryId,
        "X-Omnysync-Timestamp": timestamp,
      };

      if (endpoint.secret) {
        const signature = createHmac("sha256", endpoint.secret)
          .update(`${timestamp}.${body}`)
          .digest("hex");
        headers["X-Omnysync-Signature"] = `sha256=${signature}`;
      }

      try {
        const response = await postJsonWithPinnedDns(
          endpoint.url,
          body,
          headers,
        );

        await writeDeliveryLog({
          organizationId: input.organizationId,
          userId: input.userId,
          documentId: input.documentId,
          webhookId: endpoint.id,
          event,
          success: response.ok,
          message: response.ok
            ? `Webhook delivered to ${endpoint.type}`
            : `Webhook returned HTTP ${response.status}`,
          details: {
            responseStatus: response.status,
            signed: Boolean(endpoint.secret),
          },
        });
      } catch (error) {
        const message =
          error instanceof UnsafeOutboundUrlError
            ? `Webhook URL rejected: ${error.message}`
            : errorMessage(error);

        await writeDeliveryLog({
          organizationId: input.organizationId,
          userId: input.userId,
          documentId: input.documentId,
          webhookId: endpoint.id,
          event,
          success: false,
          message: `Webhook delivery failed: ${message}`,
          details: {
            error: message,
            signed: Boolean(endpoint.secret),
          },
        });
      }
    }),
  );
}
