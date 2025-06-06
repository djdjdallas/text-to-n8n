// src/lib/documentation/processor.js
import { RAGSystem } from "@/lib/rag/ragSystem";

/**
 * Documentation Processor
 * Handles retrieval and processing of platform-specific documentation
 */
class DocumentationProcessor {
  constructor() {
    this.ragSystem = new RAGSystem();
  }

  /**
   * Get relevant documentation for a platform and query
   * @param {string} platform - The target platform (n8n, zapier, make)
   * @param {string} query - The user's input/query
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Processed documentation context
   */
  async getRelevantDocs(platform, query, options = {}) {
    try {
      const { maxResults = 5, minScore = 0.7 } = options;

      // Search for relevant documentation
      const results = await this.ragSystem.getRelevantDocs(query, platform, {
        limit: maxResults,
        minRelevance: minScore,
      });

      // Process and format results
      const processedDocs = (results.documents || []).map((doc) => ({
        content: doc.content,
        score: doc.relevance || 0,
        metadata: doc.metadata || {},
        type: doc.type || "general",
      }));

      return {
        docs: processedDocs,
        totalFound: processedDocs.length,
        platform,
        query,
      };
    } catch (error) {
      console.error("Error retrieving documentation:", error);
      return {
        docs: [],
        totalFound: 0,
        platform,
        query,
        error: error.message,
      };
    }
  }

  /**
   * Get platform-specific examples
   * @param {string} platform - The target platform
   * @param {string} type - Type of examples to retrieve
   * @returns {Promise<Array>} Array of examples
   */
  async getExamples(platform, type = "general") {
    try {
      const exampleQuery = `${platform} ${type} workflow example`;
      const results = await this.ragSystem.getRelevantDocs(exampleQuery, platform, {
        limit: 3,
        docTypes: ["example"],
      });

      return (results.documents || []).map((doc) => doc.content);
    } catch (error) {
      console.error("Error retrieving examples:", error);
      return [];
    }
  }

  /**
   * Get node-specific documentation
   * @param {string} platform - The target platform
   * @param {string} nodeName - Name of the node/action
   * @returns {Promise<Object>} Node documentation
   */
  async getNodeDocs(platform, nodeName) {
    try {
      const nodeQuery = `${platform} ${nodeName} node documentation`;
      const results = await this.ragSystem.getRelevantDocs(nodeQuery, platform, {
        limit: 1,
        docTypes: ["node"],
      });

      const docs = results.documents || [];
      if (docs.length > 0) {
        return {
          found: true,
          documentation: docs[0].content,
          metadata: docs[0].metadata || {},
        };
      }

      return {
        found: false,
        documentation: null,
        metadata: null,
      };
    } catch (error) {
      console.error("Error retrieving node documentation:", error);
      return {
        found: false,
        documentation: null,
        metadata: null,
        error: error.message,
      };
    }
  }

  /**
   * Format documentation for prompt inclusion
   * @param {Array} docs - Array of documentation objects
   * @returns {string} Formatted documentation string
   */
  formatDocsForPrompt(docs) {
    if (!docs || docs.length === 0) {
      return "";
    }

    const formatted = docs
      .map((doc, index) => {
        const score = doc.score || doc.relevance || 0;
        return `### Reference ${index + 1} (Relevance: ${(score * 100).toFixed(1)}%)
${doc.content}
`;
      })
      .join("\n");

    return `## Relevant Documentation
${formatted}`;
  }

  /**
   * Get platform capabilities and constraints
   * @param {string} platform - The target platform
   * @returns {Promise<Object>} Platform capabilities
   */
  async getPlatformCapabilities(platform) {
    try {
      const capabilityQuery = `${platform} capabilities features limitations`;
      const results = await this.ragSystem.getRelevantDocs(capabilityQuery, platform, {
        limit: 3,
        docTypes: ["guide"],
      });

      const capabilities = {
        features: [],
        limitations: [],
        bestPractices: [],
      };

      // Extract capabilities from results
      (results.documents || []).forEach((result) => {
        const content = result.content.toLowerCase();
        if (content.includes("feature") || content.includes("capability")) {
          capabilities.features.push(result.content);
        }
        if (content.includes("limitation") || content.includes("constraint")) {
          capabilities.limitations.push(result.content);
        }
        if (content.includes("best practice") || content.includes("recommended")) {
          capabilities.bestPractices.push(result.content);
        }
      });

      return capabilities;
    } catch (error) {
      console.error("Error retrieving platform capabilities:", error);
      return {
        features: [],
        limitations: [],
        bestPractices: [],
        error: error.message,
      };
    }
  }

  /**
   * Search for similar workflows
   * @param {string} platform - The target platform
   * @param {string} description - Workflow description
   * @returns {Promise<Array>} Similar workflow examples
   */
  async findSimilarWorkflows(platform, description) {
    try {
      const workflowQuery = `${description} workflow example`;
      const results = await this.ragSystem.getRelevantDocs(workflowQuery, platform, {
        limit: 3,
        docTypes: ["example"],
      });

      return (results.documents || []).map((doc) => ({
        workflow: doc.content,
        similarity: doc.relevance || 0,
        metadata: doc.metadata || {},
      }));
    } catch (error) {
      console.error("Error finding similar workflows:", error);
      return [];
    }
  }
}

// Export singleton instance
export const docProcessor = new DocumentationProcessor();