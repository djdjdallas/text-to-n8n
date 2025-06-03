// src/lib/rag/documentationStore.js
import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";

export class DocumentationStore {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async initializeStore() {
    // Create vector extension and table if not exists
    await this.supabase.rpc("create_vector_extension");

    await this.supabase.sql`
      CREATE TABLE IF NOT EXISTS platform_docs (
        id SERIAL PRIMARY KEY,
        platform VARCHAR(50) NOT NULL,
        doc_type VARCHAR(50) NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS platform_docs_embedding_idx 
      ON platform_docs USING ivfflat (embedding vector_cosine_ops);
    `;
  }

  async indexDocumentation(platform, documents) {
    const vectorStore = await SupabaseVectorStore.fromDocuments(
      documents,
      this.embeddings,
      {
        client: this.supabase,
        tableName: "platform_docs",
        filter: { platform },
      }
    );

    return vectorStore;
  }

  async queryRelevantDocs(query, platform, limit = 10) {
    const vectorStore = new SupabaseVectorStore(this.embeddings, {
      client: this.supabase,
      tableName: "platform_docs",
      filter: { platform },
    });

    const results = await vectorStore.similaritySearchWithScore(query, limit);

    // Filter by relevance score
    return results
      .filter(([doc, score]) => score > 0.7)
      .map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        score,
      }));
  }
}
