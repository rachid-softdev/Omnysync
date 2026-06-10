import { prisma } from "../prisma";
import { ERR_FETCH_CONTENT } from "../errors";
import { encrypt } from "../crypto";
import { fetchWithRetry } from "../http";
import type {
  NotionSearchResponse,
  NotionBlocksResponse,
  NotionBlock,
} from "./types";

const NOTION_API = "https://api.notion.com/v1";

export interface NotionPage {
  id: string;
  title: string;
  content: string;
  createdTime: string;
  lastEditedTime: string;
}

export async function listNotionPages(
  accessToken: string,
): Promise<NotionPage[]> {
  const data = await fetchWithRetry<NotionSearchResponse>(
    `${NOTION_API}/v1/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: {
          property: "object",
          value: "page",
        },
      }),
    },
  );

  return data.results
    .filter(
      (page) =>
        page.parent.type === "workspace" || page.parent.type === "database",
    )
    .map((page) => ({
      id: page.id,
      title: page.properties?.title?.title?.[0]?.plain_text || "Untitled",
      content: "",
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time,
    }));
}

export async function getNotionPageContent(
  pageId: string,
  accessToken: string,
): Promise<NotionPage> {
  const data = await fetchWithRetry<NotionBlocksResponse>(
    `${NOTION_API}/v1/blocks/${pageId}/children`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    },
  );

  let content = "";

  function extractText(block: NotionBlock): string {
    if (block.type === "paragraph") {
      return (
        block.paragraph?.rich_text?.map((t) => t.plain_text).join("") || ""
      );
    }
    if (block.type === "heading_1") {
      return `# ${block.heading_1?.rich_text?.map((t) => t.plain_text).join("")}\n\n`;
    }
    if (block.type === "heading_2") {
      return `## ${block.heading_2?.rich_text?.map((t) => t.plain_text).join("")}\n\n`;
    }
    if (block.type === "heading_3") {
      return `### ${block.heading_3?.rich_text?.map((t) => t.plain_text).join("")}\n\n`;
    }
    if (block.type === "bulleted_list_item") {
      return `- ${block.bulleted_list_item?.rich_text?.map((t) => t.plain_text).join("")}\n`;
    }
    if (block.type === "numbered_list_item") {
      return `1. ${block.numbered_list_item?.rich_text?.map((t) => t.plain_text).join("")}\n`;
    }
    if (block.type === "code") {
      return `\`\`\`${block.code?.language || ""}\n${block.code?.rich_text?.map((t) => t.plain_text).join("")}\n\`\`\`\n`;
    }
    if (block.type === "quote") {
      return `> ${block.quote?.rich_text?.map((t) => t.plain_text).join("")}\n\n`;
    }
    return "";
  }

  for (const block of data.results) {
    content += extractText(block);
  }

  const pageData = await fetchWithRetry<Record<string, unknown>>(
    `${NOTION_API}/v1/pages/${pageId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
      },
    },
  );
  const page = pageData as {
    properties?: { title?: { title?: Array<{ plain_text?: string }> } };
    created_time?: string;
    last_edited_time?: string;
  };
  const title = page.properties?.title?.title?.[0]?.plain_text || "Untitled";

  return {
    id: pageId,
    title,
    content,
    createdTime: page.created_time || "",
    lastEditedTime: page.last_edited_time || "",
  };
}

export async function saveNotionConnector(
  userId: string,
  organizationId: string,
  accessToken: string,
) {
  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: "NOTION",
      name: "Notion",
      status: "ACTIVE",
      credentials: encrypt(accessToken),
      config: {},
    },
  });
}
