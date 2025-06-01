// src/scripts/verifyVectorSetup.js
// Run this script to verify your Supabase vector setup: node src/scripts/verifyVectorSetup.js

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // You'll need to add this to your .env.local
);

async function verifyVectorSetup() {
  console.log("🔍 Verifying Supabase Vector Setup...\n");

  try {
    // 1. Check if vector extension is enabled
    console.log("1. Checking vector extension...");
    const { data: extensions, error: extError } = await supabase
      .rpc("pg_available_extensions")
      .eq("name", "vector");

    if (extError) {
      console.error("❌ Error checking extensions:", extError);
    } else {
      console.log("✅ Vector extension is available");
    }

    // 2. Check if tables exist
    console.log("\n2. Checking tables...");
    const tables = [
      "platform_docs",
      "workflow_generations",
      "rag_usage",
      "workflow_cache",
      "user_workflows",
      "workflow_templates",
      "api_usage",
    ];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("id").limit(1);

      if (error && error.code === "42P01") {
        console.error(`❌ Table '${table}' does not exist`);
      } else if (error) {
        console.error(`❌ Error checking table '${table}':`, error.message);
      } else {
        console.log(`✅ Table '${table}' exists`);
      }
    }

    // 3. Test vector operations
    console.log("\n3. Testing vector operations...");

    // Create a test embedding (1536 dimensions for OpenAI)
    const testEmbedding = Array(1536)
      .fill(0)
      .map(() => Math.random());

    // Try to insert a test document
    const { data: insertData, error: insertError } = await supabase
      .from("platform_docs")
      .insert({
        platform: "n8n",
        doc_type: "test",
        title: "Test Document",
        content: "This is a test document for vector verification",
        embedding: testEmbedding,
        metadata: { test: true },
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Error inserting test document:", insertError);
    } else {
      console.log("✅ Successfully inserted test document with embedding");

      // Try similarity search
      const { data: searchData, error: searchError } = await supabase.rpc(
        "search_similar_docs",
        {
          query_embedding: testEmbedding,
          match_platform: "n8n",
          match_threshold: 0.5,
          match_count: 5,
        }
      );

      if (searchError) {
        console.error("❌ Error performing similarity search:", searchError);
      } else {
        console.log(
          `✅ Similarity search successful, found ${searchData.length} results`
        );
      }

      // Clean up test document
      if (insertData) {
        await supabase.from("platform_docs").delete().eq("id", insertData.id);
        console.log("🧹 Cleaned up test document");
      }
    }

    // 4. Check RLS policies
    console.log("\n4. Checking RLS policies...");
    const { data: policies, error: policyError } = await supabase
      .from("pg_policies")
      .select("*")
      .in("tablename", [
        "workflow_generations",
        "user_workflows",
        "rag_usage",
        "api_usage",
      ]);

    if (policyError) {
      console.error("❌ Error checking RLS policies:", policyError);
    } else {
      console.log(`✅ Found ${policies.length} RLS policies`);
      policies.forEach((policy) => {
        console.log(`   - ${policy.policyname} on ${policy.tablename}`);
      });
    }

    console.log("\n✨ Verification complete!");
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

// Run verification
verifyVectorSetup();

// src/lib/database/vectorStore.js
// Helper class for vector operations
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export class VectorStore {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text) {
    try {
      const embedding = await this.embeddings.embedQuery(text);
      return embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  /**
   * Store a document with its embedding
   */
  async storeDocument(document) {
    const {
      platform,
      docType,
      title,
      content,
      metadata = {},
      chunkIndex = 0,
      parentDocId = null,
    } = document;

    // Generate embedding
    const embedding = await this.generateEmbedding(content);

    // Store in database
    const { data, error } = await this.supabase
      .from("platform_docs")
      .insert({
        platform,
        doc_type: docType,
        title,
        content,
        metadata,
        embedding,
        chunk_index: chunkIndex,
        parent_doc_id: parentDocId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Search for similar documents
   */
  async searchSimilar(query, platform, options = {}) {
    const { limit = 10, threshold = 0.7, docTypes = null } = options;

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Search using the RPC function
    const { data, error } = await this.supabase.rpc("search_similar_docs", {
      query_embedding: queryEmbedding,
      match_platform: platform,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) throw error;

    // Filter by doc types if specified
    let results = data || [];
    if (docTypes && docTypes.length > 0) {
      results = results.filter((doc) => docTypes.includes(doc.doc_type));
    }

    return results;
  }

  /**
   * Bulk store documents with embeddings
   */
  async bulkStoreDocuments(documents, batchSize = 10) {
    const results = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);

      // Generate embeddings for batch
      const embeddings = await Promise.all(
        batch.map((doc) => this.generateEmbedding(doc.content))
      );

      // Prepare documents with embeddings
      const docsWithEmbeddings = batch.map((doc, index) => ({
        ...doc,
        embedding: embeddings[index],
      }));

      // Insert batch
      const { data, error } = await this.supabase
        .from("platform_docs")
        .insert(docsWithEmbeddings)
        .select();

      if (error) {
        console.error("Error inserting batch:", error);
        continue;
      }

      results.push(...(data || []));

      console.log(
        `Stored batch ${i / batchSize + 1} of ${Math.ceil(
          documents.length / batchSize
        )}`
      );
    }

    return results;
  }

  /**
   * Delete documents by platform
   */
  async deleteDocumentsByPlatform(platform) {
    const { error } = await this.supabase
      .from("platform_docs")
      .delete()
      .eq("platform", platform);

    if (error) throw error;
  }

  /**
   * Get document count by platform
   */
  async getDocumentStats() {
    const { data, error } = await this.supabase
      .from("platform_docs")
      .select("platform, doc_type")
      .order("platform");

    if (error) throw error;

    // Group by platform and doc_type
    const stats = {};
    data.forEach((doc) => {
      if (!stats[doc.platform]) {
        stats[doc.platform] = { total: 0, byType: {} };
      }
      stats[doc.platform].total++;
      stats[doc.platform].byType[doc.doc_type] =
        (stats[doc.platform].byType[doc.doc_type] || 0) + 1;
    });

    return stats;
  }
}

// src/app/api/admin/vector-stats/route.js
import { VectorStore } from "@/lib/database/vectorStore";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    // Add authentication check here
    const vectorStore = new VectorStore();
    const stats = await vectorStore.getDocumentStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error fetching vector stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
