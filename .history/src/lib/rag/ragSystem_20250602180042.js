// src/lib/rag/ragSystem.js
import { DocumentationStore } from "./documentationStore.js";

export class RAGSystem {
  constructor() {
    this.store = new DocumentationStore();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.store.initializeStore();
      this.initialized = true;
    } catch (error) {
      console.error("RAGSystem initialization error:", error);
      // Don't throw - allow system to work without RAG
      this.initialized = false;
    }
  }

  async getRelevantContext(query, platform, options = {}) {
    // Alias for getRelevantDocs for compatibility
    return this.getRelevantDocs(query, platform, options);
  }

  async getRelevantDocs(query, platform, options = {}) {
    try {
      // Ensure initialized
      await this.initialize();

      const {
        limit = 10,
        maxDocuments = limit,
        minRelevance = 0.7,
        docTypes = ["all"],
        includeExamples = true,
      } = options;

      // If not initialized or error, return empty results
      if (!this.initialized) {
        console.warn("RAG system not initialized, returning empty results");
        return {
          documents: [],
          avgRelevance: 0,
          searchQueries: [query],
        };
      }

      // Create enhanced query with context
      const enhancedQuery = this.enhanceQuery(query, platform);

      // Get relevant documents
      let docs = await this.store.queryRelevantDocs(
        enhancedQuery,
        platform,
        maxDocuments
      );

      // Filter by relevance score
      docs = docs.filter((doc) => doc.score >= minRelevance);

      // Filter by document type if specified
      if (!docTypes.includes("all")) {
        docs = docs.filter((doc) =>
          docTypes.includes(doc.metadata?.docType || "general")
        );
      }

      // Include examples if requested
      if (includeExamples) {
        const examples = await this.getRelevantExamples(query, platform);
        docs = [...docs, ...examples];
      }

      // Rank and deduplicate
      const rankedDocs = this.rankDocuments(docs, query);

      // Calculate average relevance
      const avgRelevance =
        rankedDocs.length > 0
          ? rankedDocs.reduce((sum, doc) => sum + (doc.score || 0), 0) /
            rankedDocs.length
          : 0;

      return {
        documents: rankedDocs,
        avgRelevance,
        searchQueries: [query, enhancedQuery],
      };
    } catch (error) {
      console.error("Error getting relevant docs:", error);
      return {
        documents: [],
        avgRelevance: 0,
        searchQueries: [query],
        error: error.message,
      };
    }
  }

  enhanceQuery(query, platform) {
    // Add platform-specific context to improve retrieval
    const platformContext = {
      n8n: "workflow nodes connections triggers actions n8n-nodes-base",
      zapier: "zap trigger action filter formatter zapier integration",
      make: "scenario module router aggregator iterator make integromat",
    };

    return `${query} ${platformContext[platform] || ""}`.trim();
  }

  async getRelevantExamples(query, platform) {
    try {
      // Specifically search for workflow examples
      const exampleQuery = `example workflow ${query}`;
      const examples = await this.store.queryRelevantDocs(
        exampleQuery,
        platform,
        5
      );

      return examples.filter(
        (doc) =>
          doc.metadata?.docType === "example" ||
          doc.content?.includes("example")
      );
    } catch (error) {
      console.error("Error getting examples:", error);
      return [];
    }
  }

  rankDocuments(docs, query) {
    // Remove duplicates based on content
    const seen = new Set();
    const unique = docs.filter((doc) => {
      const key = doc.content.substring(0, 100); // Use first 100 chars as key
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Implement custom ranking logic
    return unique.sort((a, b) => {
      // Prioritize examples
      const aIsExample = a.metadata?.docType === "example";
      const bIsExample = b.metadata?.docType === "example";
      if (aIsExample && !bIsExample) return -1;
      if (!aIsExample && bIsExample) return 1;

      // Then sort by score
      return (b.score || 0) - (a.score || 0);
    });
  }

  // Helper method to check if documents exist for a platform
  async checkDocumentationStatus(platform) {
    try {
      const docs = await this.store.queryRelevantDocs(
        "test query",
        platform,
        1
      );
      return {
        hasDocumentation: docs.length > 0,
        documentCount: docs.length,
      };
    } catch (error) {
      return {
        hasDocumentation: false,
        documentCount: 0,
        error: error.message,
      };
    }
  }
}
