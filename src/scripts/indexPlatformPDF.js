// src/scripts/indexPlatformPDF.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs/promises";
import pdf from "pdf-parse/lib/pdf-parse.js";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple text splitter
function splitText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    const chunk = text.slice(start, end);
    chunks.push(chunk);
    start = end - overlap;
  }

  return chunks;
}

// Generate embedding using OpenAI
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      input: text,
      model: "text-embedding-ada-002",
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error.message);
    throw error;
  }
}

async function indexPlatformPDF(platform, pdfPath) {
  try {
    console.log(
      `\n📄 Loading ${platform.toUpperCase()} PDF from ${pdfPath}...`
    );

    // Check if file exists
    try {
      await fs.access(pdfPath);
    } catch {
      console.error(`❌ PDF file not found at: ${pdfPath}`);
      return;
    }

    // Read PDF file
    const pdfBuffer = await fs.readFile(pdfPath);

    // Parse PDF
    const data = await pdf(pdfBuffer);
    console.log(`📑 Loaded PDF with ${data.numpages} pages`);
    console.log(`📝 Total text length: ${data.text.length} characters`);

    // Split text into chunks
    const chunks = splitText(data.text, 1000, 200);
    console.log(`✂️ Split into ${chunks.length} chunks`);

    // Process in batches
    const batchSize = 5;
    const documents = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(
        `\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          chunks.length / batchSize
        )}...`
      );

      const batchDocuments = await Promise.all(
        batch.map(async (chunk, batchIndex) => {
          const index = i + batchIndex;
          console.log(`  - Generating embedding for chunk ${index + 1}...`);

          try {
            const embedding = await generateEmbedding(chunk);

            return {
              platform: platform,
              doc_type: classifyDocType(chunk, platform),
              title:
                extractTitle(chunk) ||
                `${platform} Documentation - Chunk ${index + 1}`,
              content: chunk,
              metadata: {
                source: pdfPath.split("/").pop(),
                chunkIndex: index,
                totalChunks: chunks.length,
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

      // Filter out failed chunks
      const validDocuments = batchDocuments.filter((doc) => doc !== null);

      if (validDocuments.length > 0) {
        // Insert into Supabase
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

      // Delay to avoid rate limits
      if (i + batchSize < chunks.length) {
        console.log("  ⏳ Waiting 2 seconds before next batch...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(
      `\n✅ Successfully indexed ${documents.length} chunks for ${platform}!`
    );

    // Test search
    console.log(`\n🔍 Testing search functionality for ${platform}...`);
    const testQueries = {
      n8n: "gmail trigger",
      zapier: "trigger action",
      make: "module scenario",
    };

    const testQuery = testQueries[platform] || "workflow automation";
    const queryEmbedding = await generateEmbedding(testQuery);

    const { data: searchResults, error: searchError } = await supabase.rpc(
      "search_similar_docs",
      {
        query_embedding: queryEmbedding,
        match_platform: platform,
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
    }
  } catch (error) {
    console.error(`❌ Error indexing ${platform}:`, error);
  }
}

// Platform-specific document classification
function classifyDocType(content, platform) {
  const lower = content.toLowerCase();

  // Platform-specific classifications
  if (platform === "zapier") {
    if (
      lower.includes("trigger") &&
      (lower.includes("zap") || lower.includes("event"))
    ) {
      return "trigger";
    }
    if (lower.includes("action") && lower.includes("zap")) {
      return "action";
    }
    if (lower.includes("filter") || lower.includes("formatter")) {
      return "action";
    }
  }

  if (platform === "make") {
    if (lower.includes("trigger") || lower.includes("webhook")) {
      return "trigger";
    }
    if (
      lower.includes("module") &&
      (lower.includes("action") || lower.includes("transform"))
    ) {
      return "action";
    }
    if (lower.includes("scenario") || lower.includes("blueprint")) {
      return "example";
    }
    if (lower.includes("router") || lower.includes("aggregator")) {
      return "action";
    }
  }

  // General classifications
  if (lower.includes("example") || lower.includes("workflow")) {
    return "example";
  }
  if (
    lower.includes("guide") ||
    lower.includes("how to") ||
    lower.includes("tutorial")
  ) {
    return "guide";
  }
  if (lower.includes("api") || lower.includes("reference")) {
    return "api";
  }
  if (lower.includes("best practice")) {
    return "guide";
  }

  return "general";
}

function extractTitle(content) {
  const lines = content.split("\n").filter((line) => line.trim());

  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && trimmed.length < 100) {
      return trimmed;
    }
  }

  return null;
}

// Process all platforms
async function indexAllPlatforms() {
  console.log("🚀 Starting platform documentation indexing...\n");

  const platforms = [
    // { platform: "n8n", path: "docs/n8n/n8n-documentation.pdf" }, // Already done
    { platform: "zapier", path: "docs/zapier/zapier-documentation.pdf" },
    { platform: "make", path: "docs/make/make-documentation.pdf" },
  ];

  for (const { platform, path } of platforms) {
    await indexPlatformPDF(platform, path);
    console.log("\n" + "=".repeat(60) + "\n");
  }

  // Show final statistics
  console.log("📊 Final Statistics:\n");

  const { data: stats, error } = await supabase
    .from("platform_docs")
    .select("platform, doc_type")
    .order("platform");

  if (!error && stats) {
    const summary = {};
    stats.forEach((doc) => {
      if (!summary[doc.platform]) {
        summary[doc.platform] = { total: 0, byType: {} };
      }
      summary[doc.platform].total++;
      summary[doc.platform].byType[doc.doc_type] =
        (summary[doc.platform].byType[doc.doc_type] || 0) + 1;
    });

    Object.entries(summary).forEach(([platform, data]) => {
      console.log(`${platform.toUpperCase()}:`);
      console.log(`  Total documents: ${data.total}`);
      Object.entries(data.byType).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });
      console.log("");
    });
  }
}

// Run based on command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  // Run all platforms
  indexAllPlatforms();
} else if (args.length === 2) {
  // Run specific platform
  const [platform, pdfPath] = args;
  indexPlatformPDF(platform, pdfPath);
} else {
  console.log("Usage:");
  console.log(
    "  node src/scripts/indexPlatformPDF.js                    # Index all platforms"
  );
  console.log(
    "  node src/scripts/indexPlatformPDF.js zapier path/to/pdf # Index specific platform"
  );
}
