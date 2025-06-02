// src/scripts/processN8nPDF.js
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { VectorStore } from "../lib/database/vectorStore.js";
import fs from "fs/promises";
import path from "path";

async function processN8nPDF() {
  const vectorStore = new VectorStore();

  // 1. Put your PDF here
  const pdfPath = "docs/n8n/n8n-documentation.pdf";

  console.log("📄 Loading PDF...");
  const loader = new PDFLoader(pdfPath);
  const rawDocs = await loader.load();

  console.log(`📑 Loaded ${rawDocs.length} pages`);

  // 2. Split into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await splitter.splitDocuments(rawDocs);

  console.log(`✂️ Split into ${chunks.length} chunks`);

  // 3. Process and store directly in vector database
  const documents = chunks.map((chunk, index) => ({
    platform: "n8n",
    docType: classifyDocType(chunk.pageContent),
    title: extractTitle(chunk.pageContent) || `n8n Doc Chunk ${index}`,
    content: chunk.pageContent,
    metadata: {
      page: chunk.metadata.page || 0,
      source: "n8n-documentation.pdf",
      chunk: index,
    },
    chunkIndex: index,
  }));

  // 4. Store with embeddings
  console.log("🔄 Generating embeddings and storing...");
  await vectorStore.bulkStoreDocuments(documents, 10); // Process in batches of 10

  console.log("✅ Successfully indexed n8n documentation!");
}

// Helper functions
function classifyDocType(content) {
  const lower = content.toLowerCase();
  if (lower.includes("trigger") && lower.includes("node")) return "trigger";
  if (lower.includes("action") && lower.includes("node")) return "action";
  if (lower.includes("example") || lower.includes("workflow")) return "example";
  if (lower.includes("best practice") || lower.includes("guide"))
    return "guide";
  if (lower.includes("schema") || lower.includes("structure")) return "schema";
  if (lower.includes("api") || lower.includes("reference")) return "api";
  return "general";
}

function extractTitle(content) {
  // Try to extract a title from the first line or heading
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.trim().length > 10 && line.trim().length < 100) {
      return line.trim();
    }
  }
  return null;
}

// Run it
processN8nPDF().catch(console.error);
