import OpenAI from "openai"

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

export async function generateSEO(
  content: string,
  title: string,
  options: { targetKeyword?: string; maxTitleLength?: number; maxDescriptionLength?: number } = {}
): Promise<SEOData> {
  const { targetKeyword, maxTitleLength = 60, maxDescriptionLength = 160 } = options

  const response = await openai.chat.completions.create({
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
        content: `Titre: ${title}\n\nContenu:\n${content.substring(0, 3000)}${targetKeyword ? `\nMot-clé cible: ${targetKeyword}` : ""}`,
      },
    ],
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
  })

  const result = JSON.parse(response.choices[0].message.content || "{}")
  return {
    title: result.title?.substring(0, maxTitleLength) || title,
    description: result.description?.substring(0, maxDescriptionLength) || "",
    keywords: result.keywords || [],
  }
}

export async function generateAImage(prompt: string): Promise<string> {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    size: "1792x1024",
    quality: "standard",
    n: 1,
  })

  return response.data?.[0]?.url || ""
}

export async function improveContent(
  content: string,
  instructions: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Tu es un assistant de rédaction. Améliore le contenu selon les instructions données.",
      },
      {
        role: "user",
        content: `Instructions: ${instructions}\n\nContenu:\n${content}`,
      },
    ],
  })

  return response.choices[0].message.content || content
}

export async function findInterlinkingOpportunities(
  content: string,
  existingArticles: Array<{ title: string; url: string; excerpt: string }>,
  maxLinks: number = 3
): Promise<InterlinkingResult> {
  const articlesText = existingArticles
    .map((a, i) => `${i + 1}. ${a.title} - ${a.excerpt?.substring(0, 100)}`)
    .join("\n")

  const response = await openai.chat.completions.create({
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
        content: `Articles existants:\n${articlesText}\n\nContenu à analyser:\n${content.substring(0, 4000)}`,
      },
    ],
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
  })

  return JSON.parse(response.choices[0].message.content || '{"links": []}')
}

export async function generateExcerpt(content: string, maxLength: number = 160): Promise<string> {
  const plainText = content.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
  
  if (plainText.length <= maxLength) {
    return plainText
  }

  const response = await openai.chat.completions.create({
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
  })

  return (response.choices[0].message.content || plainText.substring(0, maxLength)).substring(0, maxLength)
}

export async function detectContentChanges(
  oldContent: string,
  newContent: string
): Promise<{ hasChanges: boolean; summary: string }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Compare deux versions d'un contenu et détermine s'il y a des changements significatifs. Réponds en JSON: { hasChanges: boolean, summary: string }",
      },
      {
        role: "user",
        content: `Ancienne version:\n${oldContent.substring(0, 2000)}\n\nNouvelle version:\n${newContent.substring(0, 2000)}`,
      },
    ],
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
  })

  return JSON.parse(response.choices[0].message.content || '{"hasChanges": false, "summary": ""}')
}