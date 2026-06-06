import { prisma } from "../prisma";
import { ERR_FETCH_CONTENT } from "../errors";
import { encrypt } from "../crypto";
import { fetchWithTimeout, fetchWithRetry } from "../http";
import type {
  GoogleDriveFilesResponse,
  GoogleDocBody,
  GoogleDocElement,
  GoogleDocTableRow,
} from "./types";

const GOOGLE_DOCS_API = "https://docs.googleapis.com/v1";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";

export interface GoogleDoc {
  id: string;
  title: string;
  content: string;
  createdTime?: string;
  modifiedTime?: string;
}

export async function listGoogleDocs(
  accessToken: string,
): Promise<GoogleDoc[]> {
  const data = await fetchWithRetry<GoogleDriveFilesResponse>(
    `${GOOGLE_DRIVE_API}/files?q=mimeType='application/vnd.google-apps.document'&fields=files(id,name,createdTime,modifiedTime)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return data.files.map((file) => ({
    id: file.id,
    title: file.name,
    content: "",
    createdTime: file.createdTime,
    modifiedTime: file.modifiedTime,
  }));
}

export async function getGoogleDocContent(
  documentId: string,
  accessToken: string,
): Promise<GoogleDoc> {
  const data = await fetchWithRetry<GoogleDocBody>(
    `${GOOGLE_DOCS_API}/documents/${documentId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  let content = "";
  if (data.body && data.body.content) {
    for (const element of data.body.content) {
      if (element.paragraph) {
        content +=
          element.paragraph.elements
            ?.map((e) => e.textRun?.content || "")
            .join("") || "";
        content += "\n";
      }
      if (element.table) {
        for (const row of element.table.tableRows || []) {
          for (const cell of row.tableCells || []) {
            content +=
              cell.content
                ?.map((c) =>
                  c.paragraph?.elements
                    ?.map((e) => e.textRun?.content || "")
                    .join(""),
                )
                .join(" ") || "";
            content += " | ";
          }
          content += "\n";
        }
      }
    }
  }

  return {
    id: data.documentId,
    title: data.title || "Untitled",
    content,
  };
}

export async function saveGoogleDocsConnector(
  userId: string,
  organizationId: string,
  accessToken: string,
  refreshToken: string,
) {
  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: "GOOGLE_DOCS",
      name: "Google Docs",
      status: "ACTIVE",
      credentials: encrypt(JSON.stringify({ accessToken, refreshToken })),
    },
  });
}

export async function updateConnectorCredentials(
  connectorId: string,
  accessToken: string,
  refreshToken: string,
) {
  return prisma.connector.update({
    where: { id: connectorId },
    data: {
      credentials: encrypt(JSON.stringify({ accessToken, refreshToken })),
    },
  });
}
