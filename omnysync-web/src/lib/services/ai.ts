import OpenAI from "openai"
import { z } from "zod"
import { logAIUsage } from "./ai-usage"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface SEOData {
  title: string
  description: string
  keywords: string[]
}

export interface InterlinkingResult {
  links: Array<{ url: string; text: string; position: number }>
}

// Zod schemas for validation
const seoSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
})

const interlinkingSchema = z.object({
  links: z.array(z.object({
    url: z.string(),
    text: z.string(),
    position: z.number(),
  })),
})

const changesSchema = z.object({
  hasChanges: z.boolean(),
  summary: z.string(),
})

// Sanitize function to prevent prompt injection
function sanitizePrompt(input: string): string {
  if (!input) return ""
  return input
    .replace(/Ignore previous instructions/gi, "")
    .replace(/You are now/gi, "")
    .replace(/Previous behavior/gi, "")
    .replace(/System:/gi, "")
    .replace(/\\[SYSTEM\\]/gi, "")
    .substring(0, 10000)
}

// Retry with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | unknown
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

// Safe JSON parsing with Zod validation
function safeParseJSON<T>(data: unknown, schema: z.ZodSchema<T>, fallback: T): T {
  try {
    const parsed = JSON.parse(data as string || "{}")
    return schema.parse(parsed)
  } catch (error) {
    console.error("JSON parsing failed:", error)
    return fallback
  }
}

export async function generateSEO(
  content: string,
  title: string,
  options: { targetKeyword?: string; maxTitleLength?: number; maxDescriptionLength?: number } = {}
): Promise<SEOData> {
  try {
    const { targetKeyword, maxTitleLength = 60, maxDescriptionLength = 160 } = options

    const sanitizedContent = sanitizePrompt(content)

    const response = await withRetry(() => openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Tu es un expert SEO. Génère un titre, une description et des mots-clés optimisés pour le référencement. 
Titre: max ${maxTitleLength} caractères.
Description: max ${maxDescriptionLength} caractères.
Mots-clés: 5-10 mots-clés pertinents.`,
        },
        {
          role: "user",
          content: `Titre: ${title}\n\nContenu:\n${sanitizedContent.substring(0, 3000)}${targetKeyword ? `\nMot-clé cible: ${targetKeyword}` : ""}`,
        },
      ],
      max_tokens: 2000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "seo_data",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              keywords: { type: "array", items: { type: "string" } },
            },
            required: ["title", "description", "keywords"],
          },
        },
      },
    }))

    const usage = response.usage
    if (usage) {
      logAIUsage({
        userId: null,
        model: "gpt-4o",
        feature: "generateSEO",
        tokens: usage.total_tokens,
        costEstimate: (usage.total_tokens / 1000) * 0.005,
      })
    }

    const result = safeParseJSON(response.choices[0].message.content || "{}", seoSchema, {
      title: title,
      description: "",
      keywords: [],
    })

    return {
      title: result.title?.substring(0, maxTitleLength) || title,
      description: result.description?.substring(0, maxDescriptionLength) || "",
      keywords: result.keywords || [],
    }
  } catch (error) {
    console.error("AI SEO generation failed:", error)
    throw new Error("AI generation failed. Please try again.")
  }
}

export async function generateAImage(prompt: string): Promise<string> {
  try {
    const sanitizedPrompt = sanitizePrompt(prompt)

    const response = await withRetry(() => openai.images.generate({
      model: "dall-e-3",
      prompt: sanitizedPrompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    }))

    logAIUsage({
      userId: null,
      model: "dall-e-3",
      feature: "generateImage",
      tokens: 0,
      costEstimate: 0.04,
    })

    return response.data?.[0]?.url || ""
  } catch (error) {
    console.error("AI image generation failed:", error)
    throw new Error("AI image generation failed. Please try again.")
  }
}

export async function improveContent(
  content: string,
  instructions: string
): Promise<string> {
  try {
    const sanitizedContent = sanitizePrompt(content)
    const sanitizedInstructions = sanitizePrompt(instructions)

    const response = await withRetry(() => openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Tu es un assistant de rédaction. Améliore le contenu selon les instructions données.",
        },
        {
          role: "user",
          content: `Instructions: ${sanitizedInstructions}\n\nContenu:\n${sanitizedContent}`,
        },
      ],
      max_tokens: 2000,
    }))

    const usage = response.usage
    if (usage) {
      logAIUsage({
        userId: null,
        model: "gpt-4o",
        feature: "improveContent",
        tokens: usage.total_tokens,
        costEstimate: (usage.total_tokens / 1000) * 0.005,
      })
    }

    return response.choices[0].message.content || content
  } catch (error) {
    console.error("AI content improvement failed:", error)
    throw new Error("AI content improvement failed. Please try again.")
  }
}

export async function findInterlinkingOpportunities(
  content: string,
  existingArticles: Array<{ title: string; url: string; excerpt: string }>,
  maxLinks: number = 3
): Promise<InterlinkingResult> {
  try {
    const sanitizedContent = sanitizePrompt(content)

    const articlesText = existingArticles
      .map((a, i) => `${i + 1}. ${a.title} - ${a.excerpt?.substring(0, 100)}`)
      .join("\n")

    const response = await withRetry(() => openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Tu es un expert en SEO et maillage interne. Trouve les meilleures opportunités de liens internes dans le contenu pour les articles existants.
.max ${maxLinks} liens.
Renvoie un JSON avec la structure: { links: [{ url: string, text: string, position: number }] }`,
        },
        {
          role: "user",
          content: `Articles existants:\n${articlesText}\n\nContenu à analyser:\n${sanitizedContent.substring(0, 4000)}`,
        },
      ],
      max_tokens: 2000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "interlinking",
          schema: {
            type: "object",
            properties: {
              links: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    text: { type: "string" },
                    position: { type: "number" },
                  },
                  required: ["url", "text", "position"],
                },
              },
            },
            required: ["links"],
          },
        },
      },
    }))

    const usage = response.usage
    if (usage) {
      logAIUsage({
        userId: null,
        model: "gpt-4o",
        feature: "findInterlinkingOpportunities",
        tokens: usage.total_tokens,
        costEstimate: (usage.total_tokens / 1000) * 0.005,
      })
    }

    return safeParseJSON(response.choices[0].message.content || '{"links": []}', interlinkingSchema, {
      links: [],
    })
  } catch (error) {
    console.error("AI interlinking opportunities failed:", error)
    throw new Error("AI interlinking failed. Please try again.")
  }
}

export async function generateExcerpt(content: string, maxLength: number = 160): Promise<string> {
  try {
    const plainText = content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()

    if (plainText.length <= maxLength) {
      return plainText
    }

    const response = await withRetry(() => openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Tu génères des résumés. Crée un résumé de max ${maxLength} caractères qui capture l'essence du contenu.`,
        },
        {
          role: "user",
          content: plainText.substring(0, 2000),
        },
      ],
      max_tokens: 2000,
    }))

    const usage = response.usage
    if (usage) {
      logAIUsage({
        userId: null,
        model: "gpt-4o",
        feature: "generateExcerpt",
        tokens: usage.total_tokens,
        costEstimate: (usage.total_tokens / 1000) * 0.005,
      })
    }

    return (response.choices[0].message.content || plainText.substring(0, maxLength)).substring(0, maxLength)
  } catch (error) {
    console.error("AI excerpt generation failed:", error)
    throw new Error("AI excerpt generation failed. Please try again.")
  }
}

export async function detectContentChanges(
  oldContent: string,
  newContent: string
): Promise<{ hasChanges: boolean; summary: string }> {
  try {
    const sanitizedOldContent = sanitizePrompt(oldContent)
    const sanitizedNewContent = sanitizePrompt(newContent)

    const response = await withRetry(() => openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Compare deux versions d'un contenu et détermine s'il y a des changements significatifs. Réponds en JSON: { hasChanges: boolean, summary: string }",
        },
        {
          role: "user",
          content: `Ancienne version:\n${sanitizedOldContent.substring(0, 2000)}\n\nNouvelle version:\n${sanitizedNewContent.substring(0, 2000)}`,
        },
      ],
      max_tokens: 2000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "changes",
          schema: {
            type: "object",
            properties: {
              hasChanges: { type: "boolean" },
              summary: { type: "string" },
            },
            required: ["hasChanges", "summary"],
          },
        },
      },
    }))

    const usage = response.usage
    if (usage) {
      logAIUsage({
        userId: null,
        model: "gpt-4o",
        feature: "detectContentChanges",
        tokens: usage.total_tokens,
        costEstimate: (usage.total_tokens / 1000) * 0.005,
      })
    }

    return safeParseJSON(response.choices[0].message.content || '{"hasChanges": false, "summary": ""}', changesSchema, {
      hasChanges: false,
      summary: "",
    })
  } catch (error) {
    console.error("AI content change detection failed:", error)
    throw new Error("AI content change detection failed. Please try again.")
  }
}