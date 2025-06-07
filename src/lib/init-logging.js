// src/lib/init-logging.js
// Initialize logging for development
import { enableConsoleLogging, logger } from './utils/logger.js';

// Only enable in development or if explicitly requested
if (process.env.NODE_ENV === 'development' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Enable console override to log to file
  enableConsoleLogging();
  
  // Log initialization
  logger.info('📝 File logging enabled - output will be written to dev.log');
  logger.info('🚀 Application starting...');
  
  // Clear old logs if requested
  if (process.env.CLEAR_LOGS_ON_START === 'true') {
    logger.clear();
    logger.info('🧹 Previous logs cleared');
  }
}

export { logger };