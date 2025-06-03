// src/lib/ai/workflowGenerator.js
import { OpenAI } from "openai";
// import { validateWorkflowSchema } from "./validators";
import { validateWorkflowStructure } from "../validators/requestValidator";
import { getRelevantDocs } from "./ragSystem";

export class WorkflowGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateWorkflow(input, platform, options) {
    try {
      // Step 1: Parse and understand the request
      const understanding = await this.parseIntent(input, platform);

      // Step 2: Retrieve relevant documentation
      const relevantDocs = await getRelevantDocs(understanding, platform);

      // Step 3: Plan the workflow structure
      const workflowPlan = await this.planWorkflow(
        understanding,
        relevantDocs,
        platform
      );

      // Step 4: Generate platform-specific JSON
      const workflowJson = await this.generateJson(
        workflowPlan,
        platform,
        relevantDocs
      );

      // Step 5: Validate and optimize
      const validatedWorkflow = await this.validateAndOptimize(
        workflowJson,
        platform
      );

      return {
        workflow: validatedWorkflow,
        metadata: {
          understanding,
          plan: workflowPlan,
          confidence: this.calculateConfidence(validatedWorkflow),
        },
      };
    } catch (error) {
      console.error("Workflow generation error:", error);
      throw error;
    }
  }

  async parseIntent(input, platform) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are an expert at understanding workflow automation requests. 
          Extract the following from the user's description:
          1. Trigger events
          2. Required actions
          3. Data transformations
          4. Conditions/logic
          5. Required integrations/apps
          Format as structured JSON.`,
        },
        {
          role: "user",
          content: `Platform: ${platform}\nDescription: ${input}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async planWorkflow(understanding, relevantDocs, platform) {
    const docsContext = relevantDocs.map((doc) => doc.content).join("\n\n");

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a ${platform} workflow architect. 
          Based on the user's requirements and platform documentation, 
          create a detailed workflow plan including:
          1. Node sequence
          2. Required configurations
          3. Data flow between nodes
          4. Error handling approach
          
          Platform Documentation:
          ${docsContext}`,
        },
        {
          role: "user",
          content: JSON.stringify(understanding),
        },
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async generateJson(plan, platform, relevantDocs) {
    const schemas = {
      n8n: await import("./schemas/n8n.schema.json"),
      zapier: await import("./schemas/zapier.schema.json"),
      make: await import("./schemas/make.schema.json"),
    };

    const platformSchema = schemas[platform];
    const docsContext = relevantDocs.map((doc) => doc.content).join("\n\n");

    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a ${platform} JSON generation expert.
          Generate valid ${platform} workflow JSON that exactly matches this schema:
          ${JSON.stringify(platformSchema, null, 2)}
          
          Use these documentation examples:
          ${docsContext}
          
          Ensure all node IDs, connections, and parameters are valid.`,
        },
        {
          role: "user",
          content: `Generate JSON for this workflow plan: ${JSON.stringify(
            plan
          )}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async validateAndOptimize(workflow, platform) {
    // Platform-specific validation
    const isValid = await validateWorkflowStructure(workflow, platform);

    if (!isValid.valid) {
      // Attempt to fix validation errors
      const fixedWorkflow = await this.fixValidationErrors(
        workflow,
        isValid.errors,
        platform
      );
      return fixedWorkflow;
    }

    // Optimize the workflow
    const optimized = await this.optimizeWorkflow(workflow, platform);
    return optimized;
  }

  async fixValidationErrors(workflow, errors, platform) {
    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `Fix these validation errors in the ${platform} workflow JSON.
          Return only the corrected JSON.`,
        },
        {
          role: "user",
          content: `Workflow: ${JSON.stringify(workflow)}
          Errors: ${JSON.stringify(errors)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async optimizeWorkflow(workflow, platform) {
    // Platform-specific optimizations
    const optimizations = {
      n8n: this.optimizeN8n,
      zapier: this.optimizeZapier,
      make: this.optimizeMake,
    };

    return optimizations[platform]?.call(this, workflow) || workflow;
  }

  calculateConfidence(workflow) {
    // Calculate confidence score based on:
    // - Validation success
    // - Complexity
    // - Number of nodes
    // - Documentation coverage
    return 0.85; // Placeholder
  }
}

// src/lib/ai/agents/intentParser.js
export class IntentParserAgent {
  constructor(llm) {
    this.llm = llm;
  }

  async parse(input) {
    // Specialized parsing logic
    const prompt = this.buildParsingPrompt(input);
    const response = await this.llm.complete(prompt);
    return this.extractStructuredData(response);
  }

  buildParsingPrompt(input) {
    return `Extract workflow components from: "${input}"
    
    Identify:
    - Trigger: What starts the workflow?
    - Actions: What steps need to happen?
    - Conditions: Any if/then logic?
    - Data: What information flows through?
    - Apps: Which services are involved?`;
  }
}

// src/lib/ai/agents/workflowPlanner.js
export class WorkflowPlannerAgent {
  constructor(llm, knowledgeBase) {
    this.llm = llm;
    this.knowledgeBase = knowledgeBase;
  }

  async plan(parsedIntent, platform) {
    // Retrieve platform-specific patterns
    const patterns = await this.knowledgeBase.getWorkflowPatterns(platform);

    // Match intent to patterns
    const matchedPatterns = this.findMatchingPatterns(parsedIntent, patterns);

    // Create workflow plan
    return this.createPlan(parsedIntent, matchedPatterns, platform);
  }
}

// src/lib/ai/agents/jsonGenerator.js
export class JsonGeneratorAgent {
  constructor(llm, schemaValidator) {
    this.llm = llm;
    this.validator = schemaValidator;
  }

  async generate(plan, platform) {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const json = await this.attemptGeneration(plan, platform);
      const validation = await this.validator.validate(json, platform);

      if (validation.valid) {
        return json;
      }

      // Learn from errors and retry
      plan = await this.refineBasedOnErrors(plan, validation.errors);
      attempts++;
    }

    throw new Error("Failed to generate valid JSON after multiple attempts");
  }
}
