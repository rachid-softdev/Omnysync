import { Client } from "@upstash/qstash"

const qstash = new Client({
  url: process.env.QSTASH_URL!,
  token: process.env.QSTASH_TOKEN!,
})

export type JobType = 
  | "sync_document"
  | "upload_image"
  | "generate_ai_image"
  | "process_seo"
  | "detect_changes"

export interface Job {
  id: string
  type: JobType
  payload: Record<string, any>
  retries?: number
  priority?: number
}

export async function enqueueJob(job: Job, delayInSeconds?: number) {
  const jobId = `${job.type}-${Date.now()}-${Math.random().toString(36).substring(7)}`

  const body = JSON.stringify({
    jobId,
    ...job,
  })

  if (delayInSeconds) {
    const scheduledTime = Math.floor(Date.now() / 1000) + delayInSeconds
    await qstash.publish({
      url: `${process.env.NEXTAUTH_URL}/api/queue`,
      body,
      scheduledAt: scheduledTime,
    })
  } else {
    await qstash.publish({
      url: `${process.env.NEXTAUTH_URL}/api/queue`,
      body,
    })
  }

  return jobId
}

export async function enqueueSyncJob(
  documentId: string,
  sourceConnectorId: string,
  destConnectorId: string,
  options?: { delay?: number; priority?: number }
) {
  return enqueueJob(
    {
      id: "",
      type: "sync_document",
      payload: {
        documentId,
        sourceConnectorId,
        destConnectorId,
      },
      priority: options?.priority,
    },
    options?.delay
  )
}

export async function enqueueImageUpload(
  documentId: string,
  imageUrl: string,
  destConnectorId: string
) {
  return enqueueJob({
    id: "",
    type: "upload_image",
    payload: {
      documentId,
      imageUrl,
      destConnectorId,
    },
  })
}

export async function enqueueAIImageGeneration(
  documentId: string,
  prompt: string
) {
  return enqueueJob({
    id: "",
    type: "generate_ai_image",
    payload: {
      documentId,
      prompt,
    },
  })
}

export async function enqueueSEOProcessing(documentId: string) {
  return enqueueJob({
    id: "",
    type: "process_seo",
    payload: {
      documentId,
    },
  })
}

export async function enqueueChangeDetection(documentId: string) {
  return enqueueJob({
    id: "",
    type: "detect_changes",
    payload: {
      documentId,
    },
  })
}

export interface QueueMessage {
  jobId: string
  type: JobType
  payload: Record<string, any>
}

export async function receiveMessage(): Promise<QueueMessage | null> {
  try {
    const messages = await qstash.receive({
      url: `${process.env.NEXTAUTH_URL}/api/queue`,
      batchSize: 1,
    })

    if (messages.messages && messages.messages.length > 0) {
      const message = messages.messages[0]
      return JSON.parse(message.body as string) as QueueMessage
    }

    return null
  } catch (error) {
    console.error("Error receiving message:", error)
    return null
  }
}

export async function acknowledgeMessage(messageId: string) {
  await qstash.acknowledge(messageId)
}