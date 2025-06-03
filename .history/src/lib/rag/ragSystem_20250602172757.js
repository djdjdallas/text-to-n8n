// src/lib/rag/ragSystem.js
export class RAGSystem {
  constructor() {
    this.store = new DocumentationStore();
    this.loader = new DocumentationLoader();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    await this.store.initializeStore();

    // Load and index documentation for each platform
    for (const platform of ["n8n", "zapier", "make"]) {
      const docs = await this.loader.loadPlatformDocs(platform);
      await this.store.indexDocumentation(platform, docs);
    }

    this.initialized = true;
  }

  async getRelevantDocs(query, platform, options = {}) {
    await this.initialize();

    const { limit = 10, docTypes = ["all"], includeExamples = true } = options;

    // Create enhanced query with context
    const enhancedQuery = this.enhanceQuery(query, platform);

    // Get relevant documents
    let docs = await this.store.queryRelevantDocs(
      enhancedQuery,
      platform,
      limit
    );

    // Filter by document type if specified
    if (!docTypes.includes("all")) {
      docs = docs.filter((doc) => docTypes.includes(doc.metadata.docType));
    }

    // Include examples if requested
    if (includeExamples) {
      const examples = await this.getRelevantExamples(query, platform);
      docs = [...docs, ...examples];
    }

    // Rank and deduplicate
    return this.rankDocuments(docs, query);
  }

  enhanceQuery(query, platform) {
    // Add platform-specific context to improve retrieval
    const platformContext = {
      n8n: "workflow nodes connections triggers actions",
      zapier: "zap trigger action filter formatter",
      make: "scenario module router aggregator iterator",
    };

    return `${query} ${platformContext[platform]}`;
  }

  async getRelevantExamples(query, platform) {
    // Specifically search for workflow examples
    const exampleQuery = `example workflow ${query}`;
    const examples = await this.store.queryRelevantDocs(
      exampleQuery,
      platform,
      5
    );

    return examples.filter((doc) => doc.metadata.docType === "example");
  }

  rankDocuments(docs, query) {
    // Implement custom ranking logic
    // Consider: relevance score, doc type, recency, etc.
    return docs.sort((a, b) => {
      // Prioritize examples
      if (a.metadata.docType === "example" && b.metadata.docType !== "example")
        return -1;
      if (b.metadata.docType === "example" && a.metadata.docType !== "example")
        return 1;

      // Then sort by score
      return b.score - a.score;
    });
  }
}
