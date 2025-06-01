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

// src/lib/rag/documentationLoader.js
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
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

// src/lib/rag/contextBuilder.js
export class ContextBuilder {
  constructor(ragSystem) {
    this.ragSystem = ragSystem;
  }

  async buildContext(userInput, platform, workflowPlan) {
    // Get relevant documentation
    const relevantDocs = await this.ragSystem.getRelevantDocs(
      userInput,
      platform,
      {
        limit: 15,
        includeExamples: true,
      }
    );

    // Extract key information
    const nodeInfo = this.extractNodeInformation(relevantDocs);
    const examples = this.extractExamples(relevantDocs);
    const bestPractices = this.extractBestPractices(relevantDocs);

    // Build structured context
    return {
      platform,
      nodes: nodeInfo,
      examples: examples,
      bestPractices: bestPractices,
      relevantDocumentation: relevantDocs.slice(0, 5), // Top 5 most relevant
      workflowContext: this.analyzeWorkflowContext(workflowPlan, nodeInfo),
    };
  }

  extractNodeInformation(docs) {
    const nodeInfo = {};

    docs.forEach((doc) => {
      if (doc.metadata.docType === "node" || doc.content.includes("node:")) {
        const nodeName = this.extractNodeName(doc.content);
        if (nodeName) {
          nodeInfo[nodeName] = {
            description: doc.metadata.description || "",
            properties: doc.metadata.properties || {},
            examples: doc.metadata.examples || [],
          };
        }
      }
    });

    return nodeInfo;
  }

  extractExamples(docs) {
    return docs
      .filter((doc) => doc.metadata.docType === "example")
      .map((doc) => ({
        title: doc.metadata.title,
        workflow: doc.metadata.workflow,
        description: doc.metadata.description,
        relevance: doc.score,
      }));
  }

  extractBestPractices(docs) {
    const practices = [];

    docs.forEach((doc) => {
      if (
        doc.content.includes("best practice") ||
        doc.content.includes("recommended") ||
        doc.content.includes("avoid")
      ) {
        practices.push({
          practice: this.extractPractice(doc.content),
          source: doc.metadata.title,
        });
      }
    });

    return practices;
  }

  analyzeWorkflowContext(workflowPlan, nodeInfo) {
    // Analyze which nodes are needed based on the workflow plan
    const requiredNodes = [];
    const missingNodes = [];

    // Check if all required nodes are documented
    workflowPlan.nodes?.forEach((node) => {
      if (nodeInfo[node.type]) {
        requiredNodes.push(node.type);
      } else {
        missingNodes.push(node.type);
      }
    });

    return {
      requiredNodes,
      missingNodes,
      suggestions: this.generateSuggestions(workflowPlan, nodeInfo),
    };
  }
}
