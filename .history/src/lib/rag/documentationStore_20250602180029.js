// src/lib/rag/documentationStore.js
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";

export class DocumentationStore {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async initializeStore() {
    // Tables are already created via SQL script
    // Just verify they exist
    try {
      const { data, error } = await this.supabase
        .from("platform_docs")
        .select("id")
        .limit(1);

      if (error && error.code === "42P01") {
        throw new Error(
          "platform_docs table does not exist. Please run the vector setup SQL script."
        );
      }

      return true;
    } catch (error) {
      console.error("DocumentationStore initialization error:", error);
      throw error;
    }
  }

  async indexDocumentation(platform, documents) {
    try {
      // Process documents in batches
      const batchSize = 10;
      const results = [];

      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);

        // Generate embeddings for batch
        const embeddings = await Promise.all(
          batch.map((doc) =>
            this.embeddings.embedQuery(doc.pageContent || doc.content)
          )
        );

        // Prepare documents with embeddings
        const docsWithEmbeddings = batch.map((doc, idx) => ({
          platform,
          doc_type: doc.metadata?.docType || "general",
          title: doc.metadata?.title || `${platform} Document`,
          content: doc.pageContent || doc.content,
          metadata: doc.metadata || {},
          embedding: embeddings[idx],
          chunk_index: i + idx,
        }));

        // Insert batch
        const { data, error } = await this.supabase
          .from("platform_docs")
          .insert(docsWithEmbeddings)
          .select();

        if (error) {
          console.error("Error inserting batch:", error);
        } else {
          results.push(...(data || []));
        }
      }

      return results;
    } catch (error) {
      console.error("Error indexing documentation:", error);
      throw error;
    }
  }

  async queryRelevantDocs(query, platform, limit = 10) {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Use the RPC function to search similar documents
      const { data, error } = await this.supabase.rpc("search_similar_docs", {
        query_embedding: queryEmbedding,
        match_platform: platform,
        match_threshold: 0.7,
        match_count: limit,
      });

      if (error) {
        console.error("Error searching documents:", error);
        return [];
      }

      // Map results to expected format
      return (data || []).map((doc) => ({
        content: doc.content,
        metadata: {
          ...doc.metadata,
          docType: doc.doc_type,
          title: doc.title,
          platform: doc.platform,
        },
        score: doc.similarity,
      }));
    } catch (error) {
      console.error("Error querying relevant docs:", error);
      return [];
    }
  }
}

// Export VectorStore class for compatibility
export class VectorStore {
  constructor() {
    this.store = new DocumentationStore();
  }

  async searchSimilar(query, platform, options = {}) {
    const { limit = 10, threshold = 0.7 } = options;

    try {
      // Generate embedding
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      const queryEmbedding = await embeddings.embedQuery(query);

      // Search using RPC
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { data, error } = await supabase.rpc("search_similar_docs", {
        query_embedding: queryEmbedding,
        match_platform: platform,
        match_threshold: threshold,
        match_count: limit,
      });

      if (error) {
        console.error("Vector search error:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Search similar error:", error);
      return [];
    }
  }
}
