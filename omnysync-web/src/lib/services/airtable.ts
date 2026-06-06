import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'
import { fetchWithRetry } from '@/lib/http-client'
import { ERR_FETCH_CONTENT } from '@/lib/errors'

class APIError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

const AIRTABLE_API = 'https://api.airtable.com/v0'

export interface AirtableBase {
  id: string
  name: string
}

export interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
  createdTime: string
  lastEditedTime: string
}

export interface AirtableTable {
  id: string
  name: string
}

/**
 * Liste les bases Airtable accessibles
 */
export async function listAirtableBases(apiKey: string): Promise<AirtableBase[]> {
  try {
    const data = await fetchWithRetry<AirtableBase[]>(`${AIRTABLE_API}/meta/bases`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    return data
  } catch {
    throw new APIError(ERR_FETCH_CONTENT, 'Failed to fetch Airtable bases')
  }
}

/**
 * Liste les tables d'une base
 */
export async function listAirtableTables(apiKey: string, baseId: string): Promise<AirtableTable[]> {
  try {
    const data = await fetchWithRetry<{ tables: AirtableTable[] }>(
      `${AIRTABLE_API}/meta/bases/${baseId}/tables`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )
    return data.tables || []
  } catch {
    throw new APIError(ERR_FETCH_CONTENT, 'Failed to fetch Airtable tables')
  }
}

/**
 * Récupère les enregistrements d'une table
 */
export async function getAirtableRecords(
  apiKey: string,
  baseId: string,
  tableId: string,
  options: {
    maxRecords?: number
    view?: string
    filterByFormula?: string
  } = {}
): Promise<AirtableRecord[]> {
  const params = new URLSearchParams()

  if (options.maxRecords) {
    params.set('maxRecords', options.maxRecords.toString())
  }
  if (options.view) {
    params.set('view', options.view)
  }
  if (options.filterByFormula) {
    params.set('filterByFormula', options.filterByFormula)
  }

  const queryString = params.toString()
  const url = `${AIRTABLE_API}/${baseId}/${tableId}${queryString ? `?${queryString}` : ''}`

  try {
    const data = await fetchWithRetry<{ records: AirtableRecord[] }>(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    return data.records || []
  } catch {
    throw new APIError(ERR_FETCH_CONTENT, 'Failed to fetch Airtable records')
  }
}

/**
 * Convertit un enregistrement Airtable en format document
 */
export function airtableRecordToDocument(record: AirtableRecord): {
  title: string
  content: string
  metadata: Record<string, unknown>
} {
  // Essayer de trouver le titre dans les champs
  const titleField =
    record.fields['Title'] ||
    record.fields['title'] ||
    record.fields['Name'] ||
    record.fields['name'] ||
    Object.values(record.fields).find((v) => typeof v === 'string')

  const title = String(titleField || 'Untitled')

  // Convertir tous les champs en contenu
  const content = Object.entries(record.fields)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `## ${key}\n${value}`
      }
      if (Array.isArray(value)) {
        return `## ${key}\n${value.join(', ')}`
      }
      if (typeof value === 'object') {
        return `## ${key}\n${JSON.stringify(value, null, 2)}`
      }
      return `## ${key}\n${String(value)}`
    })
    .join('\n\n')

  return {
    title,
    content,
    metadata: {
      airtableId: record.id,
      createdTime: record.createdTime,
      lastEditedTime: record.lastEditedTime,
      fields: record.fields,
    },
  }
}

/**
 * Sauvegarde un connecteur Airtable
 */
export async function saveAirtableConnector(
  userId: string,
  organizationId: string,
  apiKey: string,
  config: {
    baseId: string
    tableId?: string
  }
) {
  // Vérifier que l'API key est valide
  await listAirtableBases(apiKey)

  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: 'AIRTABLE',
      name: 'Airtable',
      status: 'ACTIVE',
      credentials: encrypt(apiKey),
      config: JSON.stringify(config),
    },
  })
}

/**
 * Liste les documents disponibles depuis Airtable
 */
export async function listAirtableDocuments(
  connectorId: string
): Promise<Array<{ id: string; title: string }>> {
  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
  })

  if (!connector || connector.type !== 'AIRTABLE') {
    throw new Error('Invalid Airtable connector')
  }

  const apiKey = decrypt(connector.credentials || '')
  const config = JSON.parse(decrypt(connector.config || '{}'))

  if (!config.baseId) {
    return []
  }

  // Si pas de table spécifiée, lister toutes les tables
  if (!config.tableId) {
    const tables = await listAirtableTables(apiKey, config.baseId)

    // Pour chaque table, récupérer les enregistrements
    const documents: Array<{ id: string; title: string }> = []

    for (const table of tables) {
      const records = await getAirtableRecords(apiKey, config.baseId, table.id, {
        maxRecords: 10,
      })

      for (const record of records) {
        const doc = airtableRecordToDocument(record)
        documents.push({
          id: `${table.id}:${record.id}`,
          title: `${table.name} - ${doc.title}`,
        })
      }
    }

    return documents
  }

  // Sinon, récupérer les enregistrements de la table spécifiée
  const records = await getAirtableRecords(apiKey, config.baseId, config.tableId)

  return records.map((record) => {
    const doc = airtableRecordToDocument(record)
    return {
      id: record.id,
      title: doc.title,
    }
  })
}

/**
 * Récupère le contenu complet d'un enregistrement
 */
export async function getAirtableRecordContent(
  connectorId: string,
  recordId: string
): Promise<{ id: string; title: string; content: string; metadata: Record<string, unknown> }> {
  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
  })

  if (!connector || connector.type !== 'AIRTABLE') {
    throw new Error('Invalid Airtable connector')
  }

  const apiKey = decrypt(connector.credentials || '')
  const config = JSON.parse(decrypt(connector.config || '{}'))

  // Parse recordId (peut être tableId:recordId ou juste recordId)
  const [tableId, actualRecordId] = recordId.includes(':')
    ? recordId.split(':')
    : [config.tableId, recordId]

  if (!tableId || !actualRecordId || !config.baseId) {
    throw new Error('Invalid record ID')
  }

  const records = await getAirtableRecords(apiKey, config.baseId, tableId, {
    filterByFormula: `RECORD_ID() = "${actualRecordId}"`,
  })

  if (records.length === 0) {
    throw new Error('Record not found')
  }

  const doc = airtableRecordToDocument(records[0]!)

  return {
    id: actualRecordId,
    title: doc.title,
    content: doc.content,
    metadata: doc.metadata,
  }
}

/**
 * Teste la connexion à Airtable
 */
export async function testAirtableConnection(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await listAirtableBases(apiKey)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

/**
 * Crée un nouvel enregistrement dans Airtable
 */
export async function createAirtableRecord(
  apiKey: string,
  baseId: string,
  tableId: string,
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  try {
    const data = await fetchWithRetry<{ id: string }>(`${AIRTABLE_API}/${baseId}/${tableId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    })
    return { id: data.id }
  } catch {
    throw new APIError(ERR_FETCH_CONTENT, 'Failed to create Airtable record')
  }
}

/**
 * Met à jour un enregistrement existant
 */
export async function updateAirtableRecord(
  apiKey: string,
  baseId: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  try {
    const data = await fetchWithRetry<{ id: string }>(
      `${AIRTABLE_API}/${baseId}/${tableId}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    )
    return { id: data.id }
  } catch {
    throw new APIError(ERR_FETCH_CONTENT, 'Failed to update Airtable record')
  }
}

/**
 * Supprime un enregistrement
 */
export async function deleteAirtableRecord(
  apiKey: string,
  baseId: string,
  tableId: string,
  recordId: string
): Promise<{ id: string }> {
  try {
    await fetchWithRetry(`${AIRTABLE_API}/${baseId}/${tableId}/${recordId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    return { id: recordId }
  } catch {
    throw new APIError(ERR_FETCH_CONTENT, 'Failed to delete Airtable record')
  }
}
