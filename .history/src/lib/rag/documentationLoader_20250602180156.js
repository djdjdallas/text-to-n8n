// src/lib/rag/documentationLoader.js
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// src/lib/rag/documentationLoader.js
export class DocumentationLoader {
  constructor() {
    this.chunkSize = 1000;
    this.chunkOverlap = 200;
  }

  async loadPlatformDocs(platform) {
    // This is a placeholder since you'll be loading docs via the scripts
    // In production, this would load from your indexed database
    console.log(`Loading docs for platform: ${platform}`);
    return [];
  }

  // Simple text splitter
  splitText(text, chunkSize = this.chunkSize, overlap = this.chunkOverlap) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = start + chunkSize;
      const chunk = text.slice(start, end);
      chunks.push({
        pageContent: chunk,
        metadata: {
          start,
          end: Math.min(end, text.length),
        },
      });
      start = end - overlap;
    }

    return chunks;
  }

  classifyDocType(content) {
    const lower = content.toLowerCase();

    if (
      lower.includes("trigger") &&
      (lower.includes("node") || lower.includes("event"))
    ) {
      return "trigger";
    }
    if (lower.includes("action") && lower.includes("node")) {
      return "action";
    }
    if (lower.includes("example") || lower.includes("workflow")) {
      return "example";
    }
    if (lower.includes("best practice") || lower.includes("guide")) {
      return "guide";
    }
    if (lower.includes("schema") || lower.includes("structure")) {
      return "schema";
    }
    if (lower.includes("api") || lower.includes("reference")) {
      return "api";
    }

    return "general";
  }
}
