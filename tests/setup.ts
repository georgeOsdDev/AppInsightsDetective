// Global test setup

import { jest } from '@jest/globals';

// Mock console methods to avoid test noise
global.console.log = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();
global.console.info = jest.fn();

// Mock process.exit to prevent tests from actually exiting
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit() was called');
});

// Mock chalk completely
const createChalkFunction = (color: string) => {
  const fn = jest.fn((text) => text) as any;
  fn.bold = jest.fn((text) => text);
  return fn;
};

jest.mock('chalk', () => ({
  red: createChalkFunction('red'),
  green: createChalkFunction('green'),
  blue: createChalkFunction('blue'),
  cyan: createChalkFunction('cyan'),
  yellow: createChalkFunction('yellow'),
  bold: {
    blue: jest.fn((text) => text),
    cyan: jest.fn((text) => text),
  },
  dim: jest.fn((text) => text),
  white: jest.fn((text) => text),
  gray: jest.fn((text) => text),
}));

beforeEach(() => {
  jest.clearAllMocks();
});
