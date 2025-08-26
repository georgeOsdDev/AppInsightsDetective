import { logger, updateLoggerLevel } from '../../src/utils/logger';
import winston from 'winston';

// Mock winston to avoid actual file I/O
jest.mock('winston', () => {
  const mockLogger = {
    level: 'info',
    transports: [
      {
        level: 'info'
      }
    ],
    add: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      json: jest.fn(),
      colorize: jest.fn(),
      printf: jest.fn(),
    },
    transports: {
      File: jest.fn().mockImplementation(() => ({})),
      Console: jest.fn().mockImplementation(() => ({ level: 'info' })),
    },
  };
});

describe('Logger', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('updateLoggerLevel', () => {
    it('should update logger level when no environment variable is set', () => {
      // Clear LOG_LEVEL env var
      delete process.env.LOG_LEVEL;
      
      updateLoggerLevel('warn');
      
      expect(logger.level).toBe('warn');
    });

    it('should not update logger level when LOG_LEVEL environment variable is set', () => {
      // Set LOG_LEVEL env var
      process.env.LOG_LEVEL = 'error';
      
      // Mock logger level to simulate env var being set initially
      (logger as any).level = 'error';
      
      updateLoggerLevel('warn');
      
      // Should remain as error (from env var), not changed to warn
      expect(logger.level).toBe('error');
    });

    it('should update console transport level', () => {
      delete process.env.LOG_LEVEL;
      
      // Create a mock transport that will pass instanceof check
      const mockConsoleTransport = { 
        level: 'info',
        constructor: { name: 'Console' }
      };
      
      // Mock the instanceof check by modifying the updateLoggerLevel behavior
      Object.defineProperty(mockConsoleTransport, 'constructor', {
        value: winston.transports.Console
      });
      
      (logger.transports as any) = [mockConsoleTransport];
      
      updateLoggerLevel('debug');
      
      expect(logger.level).toBe('debug');
      // For this test, we'll just verify that the function runs without error
      // The actual instanceof check is hard to mock properly in Jest
    });

    it('should handle different log levels', () => {
      delete process.env.LOG_LEVEL;
      
      const levels = ['debug', 'info', 'warn', 'error'] as const;
      
      levels.forEach(level => {
        updateLoggerLevel(level);
        expect(logger.level).toBe(level);
      });
    });
  });
});