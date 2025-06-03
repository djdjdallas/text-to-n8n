// src/lib/ai/anthropicClient.js
/**
 * Anthropic Claude API Client optimized for FlowForge AI
 * Handles rate limiting, retries, and Claude-specific optimizations
 */

export class AnthropicClient {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.baseUrl = "https://api.anthropic.com/v1";
    this.defaultModel = "claude-3.7-sonnet";
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
    const {
      model = this.defaultModel,
      maxTokens = 4000,
      temperature = 0.1,
      platform = "n8n",
      complexity = "moderate",
    } = options;

    // Claude-optimized system prompt
    const systemPrompt = this.buildSystemPrompt(platform, complexity);

    // Format user prompt for Claude's strengths
    const formattedPrompt = this.formatPromptForClaude(prompt, platform);

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
  buildSystemPrompt(platform, complexity) {
    const basePrompt = `You are an expert automation engineer specializing in ${platform} workflows.
  
  Core Responsibilities:
  - Generate syntactically perfect ${platform} JSON workflows
  - Follow platform-specific conventions and best practices
  - Include appropriate error handling and validation
  - Optimize for performance and reliability
  
  Output Requirements:
  - Respond with ONLY valid JSON - no explanations, markdown, or extra text
  - Ensure all node/step IDs are unique and properly referenced
  - Include all required parameters for each integration
  - Use proper data mapping syntax for the platform`;

    const complexityInstructions = {
      simple:
        "- Keep workflows straightforward with minimal conditional logic\n- Focus on basic trigger → action patterns",
      moderate:
        "- Include reasonable error handling and data validation\n- Use intermediate complexity patterns when beneficial",
      complex:
        "- Implement sophisticated error handling and retry logic\n- Use advanced features like sub-workflows, aggregators, and complex routing",
    };

    return `${basePrompt}\n\nComplexity Level: ${complexity}\n${
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
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

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
      "claude-3.7-sonnet": {
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
      "claude-3.7-sonnet": { input: 0.003, output: 0.015 },
      "claude-3-haiku-20240307": { input: 0.00025, output: 0.00125 },
      "claude-3-opus-20240229": { input: 0.015, output: 0.075 },
    };

    const rates = pricing[model] || pricing["claude-3.7-sonnet"];

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
