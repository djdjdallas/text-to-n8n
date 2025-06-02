// src/scripts/indexN8nPDF.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";

dotenv.config({ path: ".env.local" });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

async function indexN8nPDF() {
  try {
    console.log("📄 Loading n8n PDF...");

    // Load PDF
    const loader = new PDFLoader("docs/n8n/n8n-documentation.pdf");
    const docs = await loader.load();

    console.log(`📑 Loaded ${docs.length} pages from PDF`);

    // Split documents into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`✂️ Split into ${splitDocs.length} chunks`);

    // Process in batches to avoid rate limits
    const batchSize = 5;
    const documents = [];

    for (let i = 0; i < splitDocs.length; i += batchSize) {
      const batch = splitDocs.slice(i, i + batchSize);
      console.log(
        `\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          splitDocs.length / batchSize
        )}...`
      );

      // Generate embeddings for batch
      const batchDocuments = await Promise.all(
        batch.map(async (doc, batchIndex) => {
          const index = i + batchIndex;
          console.log(`  - Generating embedding for chunk ${index + 1}...`);

          try {
            const embedding = await embeddings.embedQuery(doc.pageContent);

            return {
              platform: "n8n",
              doc_type: classifyDocType(doc.pageContent),
              title:
                extractTitle(doc.pageContent) ||
                `n8n Documentation - Chunk ${index + 1}`,
              content: doc.pageContent,
              metadata: {
                page: doc.metadata.page || 0,
                source: "n8n-documentation.pdf",
                chunkIndex: index,
                totalChunks: splitDocs.length,
              },
              embedding: embedding,
              chunk_index: index,
            };
          } catch (error) {
            console.error(
              `  ❌ Error processing chunk ${index + 1}:`,
              error.message
            );
            return null;
          }
        })
      );

      // Filter out any failed chunks
      const validDocuments = batchDocuments.filter((doc) => doc !== null);

      if (validDocuments.length > 0) {
        // Insert batch into Supabase
        const { error } = await supabase
          .from("platform_docs")
          .insert(validDocuments);

        if (error) {
          console.error("  ❌ Error inserting batch:", error.message);
        } else {
          console.log(`  ✅ Inserted ${validDocuments.length} documents`);
          documents.push(...validDocuments);
        }
      }

      // Small delay to avoid rate limits
      if (i + batchSize < splitDocs.length) {
        console.log("  ⏳ Waiting 2 seconds before next batch...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(
      `\n✅ Successfully indexed ${documents.length} chunks from n8n documentation!`
    );

    // Test search functionality
    console.log("\n🔍 Testing search functionality...");
    const testQuery = "gmail trigger workflow";
    const queryEmbedding = await embeddings.embedQuery(testQuery);

    const { data: searchResults, error: searchError } = await supabase.rpc(
      "search_similar_docs",
      {
        query_embedding: queryEmbedding,
        match_platform: "n8n",
        match_threshold: 0.5,
        match_count: 3,
      }
    );

    if (searchError) {
      console.error("❌ Search error:", searchError.message);
    } else if (searchResults && searchResults.length > 0) {
      console.log(
        `\n📊 Found ${searchResults.length} results for "${testQuery}":\n`
      );
      searchResults.forEach((result, i) => {
        console.log(`${i + 1}. ${result.title}`);
        console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
        console.log(`   Preview: ${result.content.substring(0, 100)}...`);
        console.log("");
      });
    } else {
      console.log("No search results found");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    console.error("Stack:", error.stack);
  }
}

// Helper function to classify document type
function classifyDocType(content) {
  const lower = content.toLowerCase();

  // Check for specific node types
  if (
    lower.includes("trigger") &&
    (lower.includes("node") ||
      lower.includes("gmail") ||
      lower.includes("webhook"))
  ) {
    return "trigger";
  }
  if (lower.includes("action") && lower.includes("node")) {
    return "action";
  }

  // Check for content types
  if (lower.includes("example") || lower.includes("workflow")) {
    return "example";
  }
  if (
    lower.includes("best practice") ||
    lower.includes("guide") ||
    lower.includes("how to")
  ) {
    return "guide";
  }
  if (
    lower.includes("schema") ||
    lower.includes("structure") ||
    lower.includes("json")
  ) {
    return "schema";
  }
  if (
    lower.includes("api") ||
    lower.includes("reference") ||
    lower.includes("endpoint")
  ) {
    return "api";
  }

  // Check for specific n8n concepts
  if (lower.includes("expression") || lower.includes("variable")) {
    return "general";
  }
  if (lower.includes("credential") || lower.includes("authentication")) {
    return "general";
  }

  return "general";
}

// Helper function to extract title from content
function extractTitle(content) {
  const lines = content.split("\n").filter((line) => line.trim());

  // Look for markdown headers
  for (const line of lines) {
    if (line.startsWith("#") && line.length > 10 && line.length < 100) {
      return line.replace(/^#+\s*/, "").trim();
    }
  }

  // Look for lines that might be titles (capitalized, reasonable length)
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 10 &&
      trimmed.length < 100 &&
      /^[A-Z]/.test(trimmed) &&
      !trimmed.endsWith(".") &&
      !trimmed.endsWith(",")
    ) {
      return trimmed;
    }
  }

  // Fallback to first substantial line
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && trimmed.length < 100) {
      return trimmed;
    }
  }

  return null;
}

// Run the indexing
console.log("🚀 Starting n8n PDF indexing...\n");
indexN8nPDF();
