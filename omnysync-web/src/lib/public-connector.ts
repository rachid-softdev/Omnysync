/**
 * Shared projection for connector data that crosses the server/client boundary.
 *
 * `Connector.credentials` stores encrypted provider secrets. It must never be
 * selected into a response or serialized into a client component payload.
 */
export const PUBLIC_CONNECTOR_SELECT = {
  id: true,
  type: true,
  name: true,
  status: true,
  config: true,
  createdAt: true,
  updatedAt: true,
} as const

export function stripConnectorCredentials(connector: unknown): Record<string, unknown> | null {
  if (!connector || typeof connector !== 'object') {
    return null
  }

  const safe = { ...(connector as Record<string, unknown>) }
  delete safe.credentials
  return safe
}

export function sanitizeDocumentConnectors<T extends object>(document: T): T {
  const record = document as Record<string, unknown>
  const safe: Record<string, unknown> = { ...record }

  // Preserve the shape for callers whose document was not loaded with
  // connector relations (e.g. a freshly-created document).
  if (Object.prototype.hasOwnProperty.call(record, 'sourceConnector')) {
    safe.sourceConnector = stripConnectorCredentials(record.sourceConnector)
  }
  if (Object.prototype.hasOwnProperty.call(record, 'destConnector')) {
    safe.destConnector = stripConnectorCredentials(record.destConnector)
  }

  return safe as T
}
