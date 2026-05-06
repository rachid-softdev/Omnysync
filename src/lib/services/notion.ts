import { prisma } from "@/lib/prisma"

const NOTION_API = "https://api.notion.com/v1"

export interface NotionPage {
  id: string
  title: string
  content: string
  createdTime: string
  lastEditedTime: string
}

export async function listNotionPages(accessToken: string): Promise<NotionPage[]> {
  const response = await fetch(`${NOTION_API}/v1/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        property: "object",
        value: "page",
      },
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to fetch Notion pages")
  }

  const data = await response.json()
  
  return data.results
    .filter((page: any) => page.parent.type === "workspace" || page.parent.type === "database")
    .map((page: any) => ({
      id: page.id,
      title: page.properties?.title?.title?.[0]?.plain_text || "Untitled",
      content: "",
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time,
    }))
}

export async function getNotionPageContent(
  pageId: string,
  accessToken: string
): Promise<NotionPage> {
  const response = await fetch(`${NOTION_API}/v1/blocks/${pageId}/children`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
    },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch Notion page content")
  }

  const data = await response.json()
  
  let content = ""
  
  function extractText(block: any): string {
    if (block.type === "paragraph") {
      return block.paragraph.rich_text
        ?.map((t: any) => t.plain_text)
        .join("") || ""
    }
    if (block.type === "heading_1") {
      return `# ${block.heading_1.rich_text?.map((t: any) => t.plain_text).join("")}\n\n`
    }
    if (block.type === "heading_2") {
      return `## ${block.heading_2.rich_text?.map((t: any) => t.plain_text).join("")}\n\n`
    }
    if (block.type === "heading_3") {
      return `### ${block.heading_3.rich_text?.map((t: any) => t.plain_text).join("")}\n\n`
    }
    if (block.type === "bulleted_list_item") {
      return `- ${block.bulleted_list_item.rich_text?.map((t: any) => t.plain_text).join("")}\n`
    }
    if (block.type === "numbered_list_item") {
      return `1. ${block.numbered_list_item.rich_text?.map((t: any) => t.plain_text).join("")}\n`
    }
    if (block.type === "code") {
      return `\`\`\`${block.code.language || ""}\n${block.code.rich_text?.map((t: any) => t.plain_text).join("")}\n\`\`\`\n`
    }
    if (block.type === "quote") {
      return `> ${block.quote.rich_text?.map((t: any) => t.plain_text).join("")}\n\n`
    }
    return ""
  }

  for (const block of data.results) {
    content += extractText(block)
  }

  const pageResponse = await fetch(`${NOTION_API}/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
    },
  })

  const pageData = await pageResponse.json()
  const title = pageData.properties?.title?.title?.[0]?.plain_text || "Untitled"

  return {
    id: pageId,
    title,
    content,
    createdTime: pageData.created_time,
    lastEditedTime: pageData.last_edited_time,
  }
}

export async function saveNotionConnector(
  userId: string,
  organizationId: string,
  accessToken: string
) {
  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: "NOTION",
      name: "Notion",
      status: "ACTIVE",
      config: { accessToken },
    },
  })
}