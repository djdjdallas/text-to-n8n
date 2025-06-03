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
