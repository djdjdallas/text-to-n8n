// src/lib/rag/documentationLoader.js
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export class DocumentationLoader {
  constructor() {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  async loadPlatformDocs(platform) {
    const docsPath = `./docs/${platform}`;
    const loaders = {
      n8n: await this.loadN8nDocs(docsPath),
      zapier: await this.loadZapierDocs(docsPath),
      make: await this.loadMakeDocs(docsPath),
    };

    return loaders[platform] || [];
  }

  async loadN8nDocs(basePath) {
    const documents = [];

    // Load node documentation
    const nodeDocsLoader = new JSONLoader(`${basePath}/nodes.json`, [
      "name",
      "description",
      "properties",
      "examples",
    ]);
    const nodeDocs = await nodeDocsLoader.load();

    // Load workflow examples
    const examplesLoader = new JSONLoader(`${basePath}/examples.json`);
    const examples = await examplesLoader.load();

    // Load API documentation
    const apiLoader = new TextLoader(`${basePath}/api-reference.md`);
    const apiDocs = await apiLoader.load();

    // Split documents into chunks
    const allDocs = [...nodeDocs, ...examples, ...apiDocs];
    const splitDocs = await this.splitter.splitDocuments(allDocs);

    // Add metadata
    return splitDocs.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        platform: "n8n",
        docType: this.classifyDocType(doc),
      },
    }));
  }

  async loadZapierDocs(basePath) {
    // Similar structure for Zapier docs
    // Focus on Zap structure, triggers, actions, filters
  }

  async loadMakeDocs(basePath) {
    // Similar structure for Make (Integromat) docs
    // Focus on scenarios, modules, routers, tools
  }

  classifyDocType(doc) {
    const content = doc.pageContent.toLowerCase();
    if (content.includes("trigger")) return "trigger";
    if (content.includes("action")) return "action";
    if (content.includes("example")) return "example";
    if (content.includes("api")) return "api";
    return "general";
  }
}
