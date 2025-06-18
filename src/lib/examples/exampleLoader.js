import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ExampleLoader {
  constructor() {
    this.examples = null;
    this.categorizedExamples = null;
  }

  async loadExamples() {
    if (this.examples) return this.examples;

    try {
      const examplesPath = path.join(__dirname, '../../../n8n-examples.json');
      const content = await fs.readFile(examplesPath, 'utf8');
      
      // Parse the JSON content properly - it contains multiple workflow objects
      const lines = content.split('\n');
      const workflows = [];
      let currentWorkflow = '';
      let inWorkflow = false;
      
      for (const line of lines) {
        if (line.trim().startsWith('//')) continue; // Skip comments
        
        if (line.trim() === '{') {
          inWorkflow = true;
          currentWorkflow = '{';
        } else if (inWorkflow) {
          currentWorkflow += '\n' + line;
          if (line.trim() === '}') {
            try {
              workflows.push(JSON.parse(currentWorkflow));
            } catch (e) {
              console.error('Failed to parse workflow:', e);
            }
            currentWorkflow = '';
            inWorkflow = false;
          }
        }
      }
      
      this.examples = workflows;
      this.categorizeExamples();
      return this.examples;
    } catch (error) {
      console.error('Failed to load examples:', error);
      return [];
    }
  }

  categorizeExamples() {
    this.categorizedExamples = {
      singleNodes: [],
      commonPairs: [],
      aiPatterns: [],
      complexPatterns: [],
      integrationPatterns: [],
      notificationPatterns: [],
      dataTransformation: [],
      databasePatterns: [],
      monitoringPatterns: [],
      fileProcessing: [],
      workflowOrchestration: [],
      socialMedia: [],
      dataValidation: [],
      batchProcessing: []
    };

    for (const example of this.examples) {
      const nodeCount = example.nodes?.length || 0;
      const hasConnections = Object.keys(example.connections || {}).length > 0;
      
      // Categorize based on nodes and patterns
      if (nodeCount === 1) {
        this.categorizedExamples.singleNodes.push(example);
      } else if (nodeCount === 2 && hasConnections) {
        this.categorizedExamples.commonPairs.push(example);
      } else {
        // Categorize by node types and patterns
        const nodeTypes = example.nodes?.map(n => n.type) || [];
        const nodeNames = example.nodes?.map(n => n.name.toLowerCase()) || [];
        
        if (nodeTypes.some(t => t.includes('openAi') || t.includes('langchain'))) {
          this.categorizedExamples.aiPatterns.push(example);
        } else if (nodeNames.some(n => n.includes('error') || n.includes('retry'))) {
          this.categorizedExamples.complexPatterns.push(example);
        } else if (nodeTypes.some(t => t.includes('stripe') || t.includes('shopify') || t.includes('hubspot'))) {
          this.categorizedExamples.integrationPatterns.push(example);
        } else if (nodeTypes.some(t => t.includes('slack') || t.includes('email') || t.includes('telegram'))) {
          this.categorizedExamples.notificationPatterns.push(example);
        } else if (nodeTypes.some(t => t.includes('merge') || t.includes('aggregate') || t.includes('convertToFile'))) {
          this.categorizedExamples.dataTransformation.push(example);
        } else if (nodeTypes.some(t => t.includes('postgres') || t.includes('mongoDb') || t.includes('redis'))) {
          this.categorizedExamples.databasePatterns.push(example);
        } else if (nodeTypes.some(t => t.includes('interval') || nodeNames.includes('monitor'))) {
          this.categorizedExamples.monitoringPatterns.push(example);
        } else if (nodeTypes.some(t => t.includes('readBinaryFiles') || t.includes('writeBinaryFile'))) {
          this.categorizedExamples.fileProcessing.push(example);
        } else if (nodeTypes.some(t => t.includes('executeWorkflow'))) {
          this.categorizedExamples.workflowOrchestration.push(example);
        } else if (nodeTypes.some(t => t.includes('twitter') || t.includes('facebook') || t.includes('linkedIn'))) {
          this.categorizedExamples.socialMedia.push(example);
        } else if (nodeNames.some(n => n.includes('validate') || n.includes('validation'))) {
          this.categorizedExamples.dataValidation.push(example);
        } else if (nodeTypes.some(t => t.includes('splitInBatches'))) {
          this.categorizedExamples.batchProcessing.push(example);
        }
      }
    }
  }

  async getExamplesByNodeType(nodeType) {
    await this.loadExamples();
    return this.examples.filter(example => 
      example.nodes?.some(node => node.type === nodeType)
    );
  }

  async getExamplesByPattern(pattern) {
    await this.loadExamples();
    return this.categorizedExamples[pattern] || [];
  }

  async getExampleByNodes(nodeTypes) {
    await this.loadExamples();
    return this.examples.find(example => {
      const exampleNodeTypes = example.nodes?.map(n => n.type) || [];
      return nodeTypes.every(type => exampleNodeTypes.includes(type));
    });
  }

  async getSingleNodeExample(nodeType) {
    await this.loadExamples();
    return this.categorizedExamples.singleNodes.find(example => 
      example.nodes?.[0]?.type === nodeType
    );
  }

  async getNodePairExample(sourceType, targetType) {
    await this.loadExamples();
    return this.categorizedExamples.commonPairs.find(example => {
      const nodes = example.nodes || [];
      if (nodes.length !== 2) return false;
      
      const connections = example.connections || {};
      const sourceNode = nodes.find(n => n.type === sourceType);
      const targetNode = nodes.find(n => n.type === targetType);
      
      if (!sourceNode || !targetNode) return false;
      
      // Check if there's a connection from source to target
      const sourceConnections = connections[sourceNode.name];
      if (!sourceConnections?.main?.[0]) return false;
      
      return sourceConnections.main[0].some(conn => conn.node === targetNode.name);
    });
  }

  async getRelevantExamples(workflow) {
    await this.loadExamples();
    const relevantExamples = [];
    
    // Get node types from the workflow
    const nodeTypes = workflow.nodes?.map(n => n.type) || [];
    
    // Find examples that use similar nodes
    for (const example of this.examples) {
      const exampleNodeTypes = example.nodes?.map(n => n.type) || [];
      const commonNodes = nodeTypes.filter(type => exampleNodeTypes.includes(type));
      
      if (commonNodes.length > 0) {
        relevantExamples.push({
          example,
          relevance: commonNodes.length / Math.max(nodeTypes.length, exampleNodeTypes.length),
          commonNodes
        });
      }
    }
    
    // Sort by relevance
    return relevantExamples
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5)
      .map(r => r.example);
  }
}

export default new ExampleLoader();