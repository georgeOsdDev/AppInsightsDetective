// Mock implementation for the 'open' package
// Used to prevent Jest from trying to actually open browser windows during tests

module.exports = jest.fn(() => Promise.resolve());
