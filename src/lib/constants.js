/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  GENERATE: '/api/generate',
  VALIDATE: '/api/validate',
  DEPLOY: '/api/deploy',
};

/**
 * Supported platforms
 */
export const PLATFORMS = {
  N8N: 'n8n',
  ZAPIER: 'zapier',
  MAKE: 'make',
};

/**
 * Workflow complexity levels
 */
export const COMPLEXITY_LEVELS = {
  SIMPLE: 'simple',
  MODERATE: 'moderate',
  COMPLEX: 'complex',
};

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  THEME: 'flowforge-theme',
  HISTORY: 'flowforge-history',
  DRAFT: 'flowforge-draft',
  SETTINGS: 'flowforge-settings',
};

/**
 * Theme options
 */
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

/**
 * Default pagination limit
 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Max input length
 */
export const MAX_INPUT_LENGTH = 5000;

/**
 * Default generation parameters
 */
export const DEFAULT_PARAMS = {
  platform: PLATFORMS.N8N,
  complexity: COMPLEXITY_LEVELS.MODERATE,
  errorHandling: true,
  optimization: 50,
};

/**
 * Sample response for development
 */
export const SAMPLE_RESPONSE = {
  "workflow": {
    "name": "Gmail to Drive Workflow",
    "nodes": [
      {
        "id": "1",
        "type": "trigger",
        "name": "Gmail Trigger",
        "parameters": {
          "event": "new_email",
          "criteria": {
            "subject": "Monthly Report"
          }
        }
      },
      {
        "id": "2",
        "type": "action",
        "name": "Extract Attachments",
        "parameters": {
          "fileType": "pdf"
        }
      },
      {
        "id": "3",
        "type": "action",
        "name": "Google Drive Upload",
        "parameters": {
          "folder": "Monthly Reports",
          "createMissing": true
        }
      },
      {
        "id": "4",
        "type": "action",
        "name": "Slack Notification",
        "parameters": {
          "channel": "#reports",
          "message": "New report uploaded: {{$node[2].fileName}} - {{$node[2].fileUrl}}"
        }
      }
    ],
    "connections": [
      { "source": "1", "target": "2" },
      { "source": "2", "target": "3" },
      { "source": "3", "target": "4" }
    ]
  },
  "metadata": {
    "generationTime": 3.2,
    "tokens": 512,
    "complexity": 45,
    "estimatedCost": 0.0085
  }
};
