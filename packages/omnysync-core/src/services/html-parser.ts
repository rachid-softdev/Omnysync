import type { GoogleDocElement } from "./types";

interface TextStyleProps {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  link?: { url?: string };
  baselineOffset?: string;
  fontSize?: { magnitude: number; unit: string };
  weightedFontFamily?: { fontFamily: string };
  foregroundColor?: { color?: { rgbColor?: { rgbColor: string } } };
}

interface TextElement {
  textRun?: {
    content?: string;
    textStyle?: TextStyleProps;
  };
}

interface ParagraphElement {
  paragraph?: {
    elements?: TextElement[];
    paragraphStyle?: { namedStyleType?: string };
  };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: ParagraphElement[];
      }>;
    }>;
  };
  tableOfContents?: Record<string, unknown>;
  sectionBreak?: Record<string, unknown>;
}

export interface ParsedContent {
  title: string;
  html: string;
  excerpt?: string;
  featuredImage?: string;
  wordCount: number;
}

export function parseGoogleDocToHtml(
  documentData: {
    title?: string;
    body?: { content?: GoogleDocElement[] };
    inlineObjects?: Record<string, unknown>;
  },
  options: { cleanStyles?: boolean; addHeadingIds?: boolean } = {},
): ParsedContent {
  const { cleanStyles = true, addHeadingIds = true } = options;

  let title = "";
  let html = "";
  let wordCount = 0;

  if (documentData.title) {
    title = documentData.title;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function processElement(element: any): string {
    if (!element) return "";

    if (element.paragraph) {
      const paragraph = element.paragraph;
      let text = "";

      if (paragraph.elements) {
        for (const textElement of paragraph.elements) {
          if (textElement.textRun) {
            let runText = textElement.textRun.content || "";

            if (textElement.textRun.textStyle) {
              const style = textElement.textRun.textStyle;

              if (style.bold) {
                runText = `<strong>${runText}</strong>`;
              }
              if (style.italic) {
                runText = `<em>${runText}</em>`;
              }
              if (style.underline) {
                runText = `<u>${runText}</u>`;
              }
              if (style.strikethrough) {
                runText = `<del>${runText}</del>`;
              }
              if (style.link?.url) {
                runText = `<a href="${style.link.url}" target="_blank" rel="noopener">${runText}</a>`;
              }

              const fonts = [];
              if (style.baselineOffset === "SUPERSCRIPT") {
                runText = `<sup>${runText}</sup>`;
              }
              if (style.baselineOffset === "SUBSCRIPT") {
                runText = `<sub>${runText}</sub>`;
              }
            }

            text += runText;
          }
        }
      }

      const paragraphStyle = paragraph.paragraphStyle;
      let tag = "p";
      let attributes = "";

      if (paragraphStyle?.namedStyleType) {
        switch (paragraphStyle.namedStyleType) {
          case "HEADING_1":
            tag = "h1";
            break;
          case "HEADING_2":
            tag = "h2";
            break;
          case "HEADING_3":
            tag = "h3";
            break;
          case "TITLE":
            tag = "h1";
            break;
          case "SUBTITLE":
            tag = "h2";
            break;
          case "NORMAL_TEXT":
          default:
            tag = "p";
        }
      }

      if (addHeadingIds && (tag === "h1" || tag === "h2" || tag === "h3")) {
        const slug = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        attributes = ` id="${slug}"`;
      }

      wordCount += text.split(/\s+/).filter(Boolean).length;

      return text.trim() ? `<${tag}${attributes}>${text}</${tag}>` : "";
    }

    if (element.table) {
      let tableHtml = "<table>";
      for (const row of element.table.tableRows || []) {
        tableHtml += "<tr>";
        for (const cell of row.tableCells || []) {
          tableHtml += "<td>";
          if (cell.content) {
            for (const content of cell.content) {
              tableHtml += processElement(content);
            }
          }
          tableHtml += "</td>";
        }
        tableHtml += "</tr>";
      }
      tableHtml += "</table>";
      return tableHtml;
    }

    if (element.tableOfContents) {
      return "";
    }

    if (element.sectionBreak) {
      return "<hr/>";
    }

    if (element.header || element.footer) {
      return "";
    }

    return "";
  }

  if (documentData.body && documentData.body.content) {
    for (const element of documentData.body.content) {
      html += processElement(element);
    }
  }

  if (cleanStyles) {
    html = html.replace(/\s+style="[^"]*"/g, "");
  }

  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<h1>\s*<\/h1>/g, "");
  html = html.replace(/<h2>\s*<\/h2>/g, "");
  html = html.replace(/<h3>\s*<\/h3>/g, "");

  let excerpt = html.replace(/<[^>]+>/g, "").substring(0, 160);
  if (excerpt.length === 160) {
    excerpt = excerpt.substring(0, 157) + "...";
  }

  return {
    title,
    html,
    excerpt: excerpt || undefined,
    wordCount,
  };
}

export function parseMarkdownToHtml(markdown: string): string {
  let html = markdown;

  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  html = html.replace(/^(\d+)\. (.*)$/gm, "<li>$2</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ol>$&</ol>");

  html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );

  html = html.replace(/^> (.*)$/gm, "<blockquote>$1</blockquote>");

  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    '<pre><code class="language-$1">$2</code></pre>',
  );

  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

export function cleanHtml(html: string): string {
  let cleaned = html;

  cleaned = cleaned.replace(/\s+/g, " ");
  cleaned = cleaned.replace(/>\s+</g, "><");

  cleaned = cleaned.replace(/class="[^"]*"/g, "");

  cleaned = cleaned.replace(/style="[^"]*"/g, "");

  cleaned = cleaned.replace(/data-[a-z-]+="[^"]*"/g, "");

  cleaned = cleaned.replace(/<span>\s*<\/span>/g, "");

  cleaned = cleaned.replace(/<p>\s*<\/p>/g, "");

  cleaned = cleaned.replace(/<br\s*\/?>\s*<br\s*\/?>/g, "<br/>");

  return cleaned.trim();
}
