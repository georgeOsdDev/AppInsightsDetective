// Simple console-based logger for Next.js API routes
const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[DEBUG] ${new Date().toISOString()}: ${message}`, ...args);
    }
  }
};

export { logger };