# Development Logging System

This project includes a comprehensive logging system that captures all terminal output and application logs to the `dev.log` file.

## Features

- **Automatic Console Capture**: All `console.log`, `console.error`, and `console.warn` outputs are automatically written to `dev.log`
- **Structured Logging**: Custom logger with timestamps and log levels
- **Real-time Monitoring**: Multiple ways to view and monitor logs
- **API Access**: REST endpoints to view and manage logs

## Quick Start

### Running with Logging

```bash
# Start development with logging (recommended)
npm run dev

# Start with clean logs
npm run dev:clean

# Append to existing logs
npm run dev:log
```

### Viewing Logs

```bash
# View all logs
npm run logs:view

# Follow logs in real-time
npm run logs

# Clear logs
npm run logs:clear
```

### API Endpoints

#### Get Recent Logs
```bash
# Get last 100 log entries as JSON
curl http://localhost:3000/api/logs

# Get last 50 log entries
curl http://localhost:3000/api/logs?lines=50

# Get logs as plain text
curl http://localhost:3000/api/logs?format=text
```

#### Clear Logs
```bash
curl -X DELETE http://localhost:3000/api/logs
```

## Using the Logger in Code

### Import the Logger
```javascript
import { logger } from '@/lib/utils/logger';
```

### Basic Usage
```javascript
// Different log levels
logger.info('Information message', { data: 'example' });
logger.error('Error message', error);
logger.warn('Warning message');
logger.debug('Debug information');

// Custom log level
logger.log('custom', 'Custom level message');
```

### Automatic Console Logging
All standard console methods are automatically captured:
```javascript
console.log('This will appear in both terminal and dev.log');
console.error('Errors are captured too');
console.warn('Warnings as well');
```

## Log Format

Logs are formatted with timestamps and log levels:
```
[2025-06-07T21:50:58.120Z] [INFO] 🚀 Application starting...
[2025-06-07T21:50:58.121Z] [ERROR] ❌ Validation failed: Invalid input
[2025-06-07T21:50:58.122Z] [DEBUG] 🔧 Processing workflow...
```

## Configuration

### Environment Variables
```bash
# Enable file logging (default: enabled in development)
ENABLE_FILE_LOGGING=true

# Clear logs on startup
CLEAR_LOGS_ON_START=true
```

### File Location
- **Log File**: `/Users/dominickhill/ai-automation/dev.log`
- **Logger Module**: `src/lib/utils/logger.js`

## Integration Points

The logging system is automatically integrated into:

- **API Routes**: Major API endpoints use structured logging
- **FormatFixer**: Detailed logging of workflow fixes and transformations
- **Validation**: Error and success logging for n8n validation
- **Workflow Generation**: Step-by-step logging of the generation process

## Debugging Workflow Issues

When debugging workflow generation issues, look for these log patterns:

### FormatFixer Logs
```
🔧 formatFixer.fixN8nWorkflow called!
🔧 Fixing IF node: Check Rating
✅ Fixed IF leftValue: ={{$json["headers"]["from"]}} → ={{$json["rating"]}}
✅ formatFixer.fixN8nWorkflow completed!
```

### API Generation Logs
```
🚀 [GENERATE V2] Request received
📝 [GENERATE V2] Body parsed: {...}
✅ [GENERATE V2] Request validated
🔧 [GENERATE V2] Starting format fixes...
```

### Validation Logs
```
🔍 Starting n8n validation and auto-fix loop...
✅ Workflow validated and fixed after 2 attempts
```

## Best Practices

1. **Use Structured Logging**: Include relevant context and data
2. **Use Appropriate Log Levels**: `info` for normal flow, `error` for problems
3. **Include Emojis**: Makes logs easier to scan visually
4. **Log Important State Changes**: Especially in the workflow fixing process
5. **Clean Up Logs Regularly**: Use `npm run logs:clear` to start fresh

## Troubleshooting

### Logs Not Appearing
1. Check if development server is running with `npm run dev`
2. Verify `dev.log` file permissions
3. Check if logging is enabled in production (disabled by default)

### Performance Impact
- Logging has minimal performance impact in development
- File logging is disabled by default in production
- Use async logging for high-frequency operations if needed

## Examples

### Workflow Debugging
```javascript
import { logger } from '@/lib/utils/logger';

export function debugWorkflow(workflow) {
  logger.info('🔍 Debugging workflow:', { 
    name: workflow.name,
    nodeCount: workflow.nodes?.length,
    hasConnections: !!workflow.connections
  });
  
  workflow.nodes?.forEach(node => {
    logger.debug(`📋 Node: ${node.name} (${node.type})`);
  });
}
```

### API Error Handling
```javascript
try {
  // ... some operation
  logger.info('✅ Operation completed successfully');
} catch (error) {
  logger.error('❌ Operation failed:', {
    error: error.message,
    stack: error.stack,
    context: { /* relevant context */ }
  });
}
```