/**
 * Simple logging utility with environment-aware output
 * - Development: Shows all logs
 * - Production: Only shows warnings and errors
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Logger instance with environment-aware methods
 */
const logger = {
  /**
   * Debug/info logging - only in development
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Informational logging - only in development
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Warning logging - always shown
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    console.warn(...args);
  },

  /**
   * Error logging - always shown
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    console.error(...args);
  },

  /**
   * Success logging - only in development
   * Used for successful operations (✅ messages)
   * @param {...any} args - Arguments to log
   */
  success: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Debug logging - only in development
   * For detailed debugging information
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  }
};

export default logger;
