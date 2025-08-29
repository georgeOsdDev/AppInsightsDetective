// Mock implementation for the 'ora' package
// Used to handle ora v8+ ESM module compatibility in CommonJS Jest environment

const createSpinnerMock = () => ({
  text: '',
  color: 'cyan',
  isSpinning: false,
  indent: 0,
  spinner: 'dots',
  prefixText: '',
  suffixText: '',
  
  start: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  warn: jest.fn().mockReturnThis(),
  info: jest.fn().mockReturnThis(),
  clear: jest.fn().mockReturnThis(),
  render: jest.fn().mockReturnThis(),
  frame: jest.fn().mockReturnValue('⠋'),
});

// Default export - ora function
const ora = jest.fn((options) => createSpinnerMock());

// Named export - Ora class constructor
const Ora = jest.fn().mockImplementation((options) => createSpinnerMock());

// Export both default and named exports
module.exports = ora;
module.exports.Ora = Ora;
module.exports.default = ora;