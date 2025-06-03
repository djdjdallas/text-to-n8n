// src/lib/validators/requestValidator.js
import {
  PLATFORMS,
  COMPLEXITY_LEVELS,
  MAX_INPUT_LENGTH,
} from "@/lib/constants";

/**
 * Validate incoming request for workflow generation
 */
export function validateRequest(body) {
  const errors = [];

  // Check required fields
  if (!body.input) {
    errors.push({ field: "input", message: "Input text is required" });
  } else if (typeof body.input !== "string") {
    errors.push({ field: "input", message: "Input must be a string" });
  } else if (body.input.trim().length === 0) {
    errors.push({ field: "input", message: "Input cannot be empty" });
  } else if (body.input.length > MAX_INPUT_LENGTH) {
    errors.push({
      field: "input",
      message: `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
    });
  }

  // Validate platform
  if (!body.platform) {
    errors.push({ field: "platform", message: "Platform is required" });
  } else if (!Object.values(PLATFORMS).includes(body.platform)) {
    errors.push({
      field: "platform",
      message: `Invalid platform. Must be one of: ${Object.values(
        PLATFORMS
      ).join(", ")}`,
    });
  }

  // Validate complexity (optional)
  if (
    body.complexity &&
    !Object.values(COMPLEXITY_LEVELS).includes(body.complexity)
  ) {
    errors.push({
      field: "complexity",
      message: `Invalid complexity level. Must be one of: ${Object.values(
        COMPLEXITY_LEVELS
      ).join(", ")}`,
    });
  }

  // Validate errorHandling (optional boolean)
  if (
    body.errorHandling !== undefined &&
    typeof body.errorHandling !== "boolean"
  ) {
    errors.push({
      field: "errorHandling",
      message: "Error handling must be a boolean value",
    });
  }

  // Validate optimization (optional number)
  if (body.optimization !== undefined) {
    if (typeof body.optimization !== "number") {
      errors.push({
        field: "optimization",
        message: "Optimization must be a number",
      });
    } else if (body.optimization < 0 || body.optimization > 100) {
      errors.push({
        field: "optimization",
        message: "Optimization must be between 0 and 100",
      });
    }
  }

  // Validate provider (optional)
  if (
    body.provider &&
    !["claude", "openai", "existing"].includes(body.provider)
  ) {
    errors.push({
      field: "provider",
      message: "Invalid provider. Must be one of: claude, openai, existing",
    });
  }

  // Validate useRAG (optional boolean)
  if (body.useRAG !== undefined && typeof body.useRAG !== "boolean") {
    errors.push({
      field: "useRAG",
      message: "useRAG must be a boolean value",
    });
  }

  // Validate validateOutput (optional boolean)
  if (
    body.validateOutput !== undefined &&
    typeof body.validateOutput !== "boolean"
  ) {
    errors.push({
      field: "validateOutput",
      message: "validateOutput must be a boolean value",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input) {
  if (typeof input !== "string") return input;

  // Remove any potential script tags or malicious content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/**
 * Validate workflow JSON structure
 */
export function validateWorkflowStructure(workflow, platform) {
  if (!workflow || typeof workflow !== "object") {
    return { valid: false, error: "Workflow must be an object" };
  }

  // Platform-specific validation
  switch (platform) {
    case PLATFORMS.N8N:
      if (!Array.isArray(workflow.nodes)) {
        return { valid: false, error: "n8n workflow must have nodes array" };
      }
      if (!workflow.connections || typeof workflow.connections !== "object") {
        return {
          valid: false,
          error: "n8n workflow must have connections object",
        };
      }
      break;

    case PLATFORMS.ZAPIER:
      if (!workflow.trigger || typeof workflow.trigger !== "object") {
        return { valid: false, error: "Zapier workflow must have a trigger" };
      }
      if (!Array.isArray(workflow.actions)) {
        return {
          valid: false,
          error: "Zapier workflow must have actions array",
        };
      }
      break;

    case PLATFORMS.MAKE:
      if (!Array.isArray(workflow.modules)) {
        return { valid: false, error: "Make scenario must have modules array" };
      }
      break;

    default:
      return { valid: false, error: "Unknown platform" };
  }

  return { valid: true };
}

/**
 * Extract mentioned apps/services from user input
 */
export function extractAppsFromInput(input) {
  const apps = [];
  const appPatterns = {
    gmail: /gmail|google mail/gi,
    slack: /slack/gi,
    "google-drive": /google drive|gdrive/gi,
    salesforce: /salesforce|sfdc/gi,
    hubspot: /hubspot/gi,
    trello: /trello/gi,
    asana: /asana/gi,
    notion: /notion/gi,
    discord: /discord/gi,
    shopify: /shopify/gi,
    stripe: /stripe/gi,
    mailchimp: /mailchimp/gi,
    zendesk: /zendesk/gi,
    "google-sheets": /google sheets|gsheets/gi,
    dropbox: /dropbox/gi,
    twitter: /twitter|x\.com/gi,
    facebook: /facebook|fb/gi,
    instagram: /instagram|insta/gi,
    typeform: /typeform/gi,
    airtable: /airtable/gi,
    monday: /monday\.com|monday/gi,
    clickup: /clickup/gi,
    jira: /jira/gi,
    todoist: /todoist/gi,
    zoom: /zoom/gi,
    teams: /microsoft teams|ms teams/gi,
    outlook: /outlook|microsoft mail/gi,
    office365: /office 365|o365/gi,
    quickbooks: /quickbooks/gi,
    xero: /xero/gi,
    paypal: /paypal/gi,
    twilio: /twilio/gi,
    sendgrid: /sendgrid/gi,
    github: /github/gi,
    gitlab: /gitlab/gi,
    bitbucket: /bitbucket/gi,
  };

  Object.entries(appPatterns).forEach(([app, pattern]) => {
    if (pattern.test(input)) {
      apps.push(app);
    }
  });

  return [...new Set(apps)]; // Remove duplicates
}

/**
 * Estimate workflow complexity from input
 */
export function estimateComplexity(input) {
  const complexityIndicators = {
    simple: [
      /^(send|create|add|save|post)/i,
      /\b(to|in|from)\b.*\b(to|in|from)\b/i, // Single transfer
    ],
    moderate: [
      /\b(if|when|filter|condition)\b/i,
      /\b(transform|format|convert|parse)\b/i,
      /\b(multiple|batch|bulk)\b/i,
    ],
    complex: [
      /\b(loop|iterate|for each|recursiv)\b/i,
      /\b(branch|split|merge|parallel)\b/i,
      /\b(retry|error|fail|catch)\b/i,
      /\b(and then.*and then|multiple steps)\b/i,
    ],
  };

  let score = 0;

  // Check for complexity indicators
  Object.entries(complexityIndicators).forEach(([level, patterns]) => {
    patterns.forEach((pattern) => {
      if (pattern.test(input)) {
        score += level === "simple" ? 1 : level === "moderate" ? 2 : 3;
      }
    });
  });

  // Count mentioned apps
  const appCount = extractAppsFromInput(input).length;
  score += appCount > 3 ? 2 : appCount > 1 ? 1 : 0;

  // Estimate based on score
  if (score >= 5) return COMPLEXITY_LEVELS.COMPLEX;
  if (score >= 2) return COMPLEXITY_LEVELS.MODERATE;
  return COMPLEXITY_LEVELS.SIMPLE;
}
