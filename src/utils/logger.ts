import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'appinsights-detective' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message }) => {
        return `${level}: ${message}`;
      })
    )
  }));
}

/**
 * Update the logger level dynamically
 * This allows the logger level to be configured after the config file is loaded
 */
export function updateLoggerLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
  // Environment variable takes precedence over config file
  if (process.env.LOG_LEVEL) {
    return;
  }
  
  logger.level = level;
  
  // Update all transports to respect the new level
  logger.transports.forEach((transport) => {
    if (transport instanceof winston.transports.Console) {
      transport.level = level;
    }
  });
}
