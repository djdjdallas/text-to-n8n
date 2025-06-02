// src/scripts/indexN8nPDF.js
import { createClient } from "@supabase/supabase-js";
import { VectorStore } from "../lib/database/vectorStore.js";
import dotenv from "dotenv";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

dotenv.config({ path: ".env.local" });

async function indexN8nPDF() {
  try {
    // Initialize vector store
    const vectorStore = new VectorStore();

    // Load PDF
    const loader = new PDFLoader("docs/n8n/n8n-documentation.pdf");
    const docs = await loader.load();

    // Split documents
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await splitter.splitDocuments(docs);

    // Process each chunk
    for (let i = 0; i < splitDocs.length; i++) {
      const doc = splitDocs[i];

      await vectorStore.storeDocument({
        platform: "n8n",
        docType: "general",
        title: `n8n Documentation - Part ${i + 1}`,
        content: doc.pageContent,
        metadata: {
          ...doc.metadata,
          chunkIndex: i,
          totalChunks: splitDocs.length,
        },
        chunkIndex: i,
      });

      if (i % 10 === 0) {
        console.log(`Processed ${i + 1}/${splitDocs.length} chunks`);
      }
    }

    console.log("✅ Finished indexing n8n documentation!");

    // Test search
    const results = await vectorStore.searchSimilar(
      "how to create gmail trigger",
      "n8n",
      { limit: 3 }
    );

    console.log("\n🔍 Test search results:");
    results.forEach((r, i) => {
      console.log(
        `${i + 1}. ${r.title} (similarity: ${r.similarity.toFixed(3)})`
      );
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

indexN8nPDF();
