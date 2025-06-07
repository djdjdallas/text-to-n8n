// src/lib/utils/logger.js
import fs from 'fs';
import path from 'path';

// Get the project root directory
const projectRoot = process.cwd();
const logFile = path.join(projectRoot, 'dev.log');

// Ensure the log file exists
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, '');
}

/**
 * Custom logger that writes to both console and dev.log file
 */
class Logger {
  constructor() {
    this.logFile = logFile;
  }

  /**
   * Write to log file with timestamp
   */
  writeToFile(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Format additional arguments
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2);
      }
      return String(arg);
    }).join(' ');

    const fullLogEntry = formattedArgs ? `${logEntry} ${formattedArgs}\n` : `${logEntry}\n`;

    try {
      fs.appendFileSync(this.logFile, fullLogEntry);
    } catch (error) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Log info message
   */
  info(message, ...args) {
    console.log(message, ...args);
    this.writeToFile('info', message, ...args);
  }

  /**
   * Log error message
   */
  error(message, ...args) {
    console.error(message, ...args);
    this.writeToFile('error', message, ...args);
  }

  /**
   * Log warning message
   */
  warn(message, ...args) {
    console.warn(message, ...args);
    this.writeToFile('warn', message, ...args);
  }

  /**
   * Log debug message
   */
  debug(message, ...args) {
    console.log(message, ...args);
    this.writeToFile('debug', message, ...args);
  }

  /**
   * Log with custom level
   */
  log(level, message, ...args) {
    console.log(message, ...args);
    this.writeToFile(level, message, ...args);
  }

  /**
   * Clear the log file
   */
  clear() {
    try {
      fs.writeFileSync(this.logFile, '');
      console.log('Log file cleared');
    } catch (error) {
      console.error('Failed to clear log file:', error.message);
    }
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(lines = 100) {
    try {
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const logLines = content.trim().split('\n');
      return logLines.slice(-lines).join('\n');
    } catch (error) {
      console.error('Failed to read log file:', error.message);
      return '';
    }
  }
}

// Create and export singleton instance
export const logger = new Logger();

// Override console methods to also log to file (optional)
export function enableConsoleLogging() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    originalLog(...args);
    logger.writeToFile('console', args.join(' '));
  };

  console.error = (...args) => {
    originalError(...args);
    logger.writeToFile('error', args.join(' '));
  };

  console.warn = (...args) => {
    originalWarn(...args);
    logger.writeToFile('warn', args.join(' '));
  };
}

export default logger;