// Shared types for service API responses

export interface GoogleDriveFile {
  id: string
  name: string
  createdTime: string
  modifiedTime: string
}

export interface GoogleDriveFilesResponse {
  files: GoogleDriveFile[]
}

export interface GoogleDocBody {
  body?: {
    content?: GoogleDocElement[]
  }
  documentId: string
  title: string
}

export interface GoogleDocElement {
  paragraph?: {
    elements?: GoogleDocTextElement[]
  }
  table?: {
    tableRows?: GoogleDocTableRow[]
  }
}

export interface GoogleDocTextElement {
  textRun?: {
    content: string
  }
}

export interface GoogleDocTableRow {
  tableCells?: GoogleDocTableCell[]
}

export interface GoogleDocTableCell {
  content?: GoogleDocElement[]
}

export interface NotionSearchResult {
  id: string
  title?: { title?: { plain_text?: string }[] }
  properties?: {
    title?: { title?: { plain_text?: string }[] }
  }
  created_time: string
  last_edited_time: string
  parent: {
    type: string
  }
}

export interface NotionSearchResponse {
  results: NotionSearchResult[]
}

export interface NotionBlock {
  type: string
  paragraph?: { rich_text?: NotionRichText[] }
  heading_1?: { rich_text?: NotionRichText[] }
  heading_2?: { rich_text?: NotionRichText[] }
  heading_3?: { rich_text?: NotionRichText[] }
  bulleted_list_item?: { rich_text?: NotionRichText[] }
  numbered_list_item?: { rich_text?: NotionRichText[] }
  code?: {
    language?: string
    rich_text?: NotionRichText[]
  }
  quote?: { rich_text?: NotionRichText[] }
}

export interface NotionRichText {
  plain_text: string
}

export interface NotionBlocksResponse {
  results: NotionBlock[]
}

export interface WordPressErrorResponse {
  message?: string
}

export interface GhostErrorResponse {
  errors?: Array<{ message: string }>
}

export interface WebflowErrorResponse {
  message?: string
}

export interface ShopifyErrorResponse {
  errors?: Array<{ message: string }> | string
}

// Connector JSON config shapes
export interface ConnectorConfig {
  siteUrl?: string
  siteId?: string
  shopDomain?: string
  collectionId?: string
  accessToken?: string
}
