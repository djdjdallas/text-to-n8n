// src/lib/ai/anthropicClient.js
/**
 * Anthropic Claude API Client optimized for FlowForge AI
 * Handles rate limiting, retries, and Claude-specific optimizations
 */

export class AnthropicClient {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.baseUrl = "https://api.anthropic.com/v1";
    this.defaultModel = "claude-3-7-sonnet-20250219";
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second

    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
  }

  /**
   * Generate workflow JSON using Claude
   */
  async generateWorkflow(prompt, options = {}) {
    // Handle both string prompts and enhanced prompt objects
    const enhancedPromptData = typeof prompt === 'object' && prompt.enhanced 
      ? prompt 
      : { enhanced: prompt, template: null };
    
    const {
      model = this.defaultModel,
      maxTokens = 4000,
      temperature = 0.1,
      platform = "n8n",
      complexity = "moderate",
    } = options;

    // Claude-optimized system prompt with template injection
    const systemPrompt = this.buildSystemPrompt(platform, complexity, enhancedPromptData.template);

    // Format user prompt for Claude's strengths
    const formattedPrompt = this.formatPromptForClaude(enhancedPromptData.enhanced || prompt, platform);

    const requestBody = {
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: formattedPrompt,
        },
      ],
    };

    return await this.makeRequestWithRetry("/messages", requestBody);
  }

  /**
   * Build system prompt optimized for Claude
   */
  buildSystemPrompt(platform, complexity, template = null) {
    const basePrompt = `You are an expert automation engineer specializing in ${platform} workflows.
  
  CRITICAL REQUIREMENTS:
  - You MUST generate a COMPLETE workflow JSON, not just node parameters
  - The response MUST include nodes array, connections object, and settings
  - NEVER return partial structures or single node configurations
  
  Core Responsibilities:
  - Generate syntactically perfect ${platform} JSON workflows
  - Follow platform-specific conventions and best practices
  - Include appropriate error handling and validation
  - Optimize for performance and reliability
  
  Output Requirements:
  - Respond with ONLY valid JSON - no explanations, markdown, or extra text
  - Ensure all node/step IDs are unique and properly referenced
  - Include all required parameters for each integration
  - Use proper data mapping syntax for the platform
  - The workflow MUST have this structure:
    {
      "name": "workflow name",
      "nodes": [array of node objects],
      "connections": {object mapping node connections},
      "settings": {workflow settings}
    }`;

    // Add template reference if available
    const templateSection = template
      ? `\n\nREFERENCE TEMPLATE:\nFor this type of workflow, here's a working example structure:\n${JSON.stringify(template.template, null, 2)}\n\nIMPORTANT: Use this as a reference but adapt it to the specific requirements.\n`
      : '';

    // Add platform-specific critical rules
    const n8nCriticalRules = platform === 'n8n' 
      ? `\n\nCRITICAL N8N-SPECIFIC RULES:
  1. Slack nodes: ALWAYS prefix channels with '#' (e.g., "#general", NOT "general")
  2. Gmail nodes: Use "gmailOAuth2" for credentials, NOT "gmailOAuth2Api"
  3. Google Drive nodes: MUST include the __rl resource locator structure:
     {
       "driveId": {
         "__rl": true,
         "mode": "list",
         "value": "My Drive"
       },
       "folderId": {
         "__rl": true,
         "mode": "list",
         "value": "root",
         "cachedResultName": "/ (Root folder)"
       },
       "options": {}
     }
  4. Schedule triggers: MUST include timezone parameter (e.g., "America/Los_Angeles")
  5. Expressions: Use {{$json["field"]}} or {{$json.field}}, NOT {{$json[\"field\"]}}
  6. Gmail trigger outputs: Use {{$json["headers"]["from"]}} NOT {{$json.from}}
  7. IF nodes: Use proper operations (equal, contains, largerThan) not complex expressions
  8. Set nodes: Don't use keepOnlySet parameter
  9. Webhook nodes: Don't include webhookId field
  10. All Google Drive nodes MUST have an options field (even if empty: options: {})\n`
      : '';

    const complexityInstructions = {
      simple:
        "- Keep workflows straightforward with minimal conditional logic\n- Focus on basic trigger → action patterns",
      moderate:
        "- Include reasonable error handling and data validation\n- Use intermediate complexity patterns when beneficial",
      complex:
        "- Implement sophisticated error handling and retry logic\n- Use advanced features like sub-workflows, aggregators, and complex routing",
    };

    return `${basePrompt}${templateSection}${n8nCriticalRules}\n\nComplexity Level: ${complexity}\n${
      complexityInstructions[complexity] || complexityInstructions.moderate
    }`;
  }

  /**
   * Format prompt to leverage Claude's strengths
   */
  formatPromptForClaude(prompt, platform) {
    // Claude responds better to structured, XML-like formatting
    return `<workflow_request>
  <platform>${platform}</platform>
  <description>
  ${prompt}
  </description>
  </workflow_request>
  
  Generate the complete ${platform} workflow JSON that accomplishes this automation:`;
  }

  /**
   * Make API request with retry logic
   */
  async makeRequestWithRetry(endpoint, body, attempt = 1) {
    console.log(`🌐 [ANTHROPIC] Making request to ${endpoint}, attempt ${attempt}`);
    
    try {
      // Add timeout wrapper
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log(`🌐 [ANTHROPIC] Response received: ${response.status}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));

        // Handle rate limiting
        if (response.status === 429 && attempt <= this.maxRetries) {
          const retryAfter = response.headers.get("retry-after");
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : this.retryDelay * attempt;

          console.log(
            `Rate limited. Retrying after ${delay}ms (attempt ${attempt})`
          );
          await this.sleep(delay);
          return this.makeRequestWithRetry(endpoint, body, attempt + 1);
        }

        // Handle other retryable errors
        if (response.status >= 500 && attempt <= this.maxRetries) {
          console.log(
            `Server error ${response.status}. Retrying (attempt ${attempt})`
          );
          await this.sleep(this.retryDelay * attempt);
          return this.makeRequestWithRetry(endpoint, body, attempt + 1);
        }

        throw new Error(
          `Anthropic API error: ${response.status} - ${
            error.error?.message || response.statusText
          }`
        );
      }

      const data = await response.json();

      // Extract content from Claude's response format
      const content = data.content?.[0]?.text || "";

      if (!content) {
        throw new Error("Empty response from Anthropic API");
      }

      return {
        content,
        usage: data.usage,
        model: data.model,
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ [ANTHROPIC] Request timed out');
        throw new Error('Claude API request timed out after 2 minutes');
      }
      
      if (attempt <= this.maxRetries && this.isRetryableError(error)) {
        console.log(
          `Request failed: ${error.message}. Retrying (attempt ${attempt})`
        );
        await this.sleep(this.retryDelay * attempt);
        return this.makeRequestWithRetry(endpoint, body, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
      return true;
    }

    if (error.message.includes("fetch")) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility for delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey) {
    if (!apiKey) return false;
    return apiKey.startsWith("sk-ant-") && apiKey.length > 20;
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return {
      "claude-3-7-sonnet-20250219": {
        name: "Claude 3.5 Sonnet",
        contextWindow: 200000,
        outputTokens: 8192,
        recommended: true,
        useCase: "Best overall performance for workflow generation",
      },
      "claude-3-haiku-20240307": {
        name: "Claude 3 Haiku",
        contextWindow: 200000,
        outputTokens: 4096,
        recommended: false,
        useCase: "Faster and cheaper for simple workflows",
      },
      "claude-3-opus-20240229": {
        name: "Claude 3 Opus",
        contextWindow: 200000,
        outputTokens: 4096,
        recommended: false,
        useCase: "Most capable but slower and more expensive",
      },
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text) {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost estimate
   */
  calculateCost(inputTokens, outputTokens, model = this.defaultModel) {
    const pricing = {
      "claude-3-7-sonnet-20250219": { input: 0.003, output: 0.015 },
      "claude-3-haiku-20240307": { input: 0.00025, output: 0.00125 },
      "claude-3-opus-20240229": { input: 0.015, output: 0.075 },
    };

    const rates = pricing[model] || pricing["claude-3-7-sonnet-20250219"];

    return {
      inputCost: (inputTokens / 1000) * rates.input,
      outputCost: (outputTokens / 1000) * rates.output,
      totalCost:
        (inputTokens / 1000) * rates.input +
        (outputTokens / 1000) * rates.output,
    };
  }
}

// Export singleton instance
export const anthropicClient = new AnthropicClient();
