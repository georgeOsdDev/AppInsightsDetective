"use strict";
// Global test setup
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
// Mock console methods to avoid test noise
global.console.log = globals_1.jest.fn();
global.console.error = globals_1.jest.fn();
global.console.warn = globals_1.jest.fn();
global.console.info = globals_1.jest.fn();
// Mock process.exit to prevent tests from actually exiting
const mockProcessExit = globals_1.jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit() was called');
});
// Mock chalk completely
const createChalkFunction = (color) => {
    const fn = globals_1.jest.fn((text) => text);
    fn.bold = globals_1.jest.fn((text) => text);
    return fn;
};
globals_1.jest.mock('chalk', () => ({
    red: createChalkFunction('red'),
    green: createChalkFunction('green'),
    blue: createChalkFunction('blue'),
    cyan: createChalkFunction('cyan'),
    yellow: createChalkFunction('yellow'),
    bold: {
        blue: globals_1.jest.fn((text) => text),
        cyan: globals_1.jest.fn((text) => text),
    },
    dim: globals_1.jest.fn((text) => text),
    white: globals_1.jest.fn((text) => text),
    gray: globals_1.jest.fn((text) => text),
}));
beforeEach(() => {
    globals_1.jest.clearAllMocks();
});
//# sourceMappingURL=setup.js.map