import { LoadingIndicator, withLoadingIndicator } from '../../src/utils/loadingIndicator';

// Mock ora to avoid actual spinner display in tests
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    isSpinning: false,
    text: ''
  }));
});

describe('LoadingIndicator', () => {
  let loadingIndicator: LoadingIndicator;

  beforeEach(() => {
    loadingIndicator = new LoadingIndicator();
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should start loading indicator', () => {
      expect(() => loadingIndicator.start('Test message')).not.toThrow();
    });

    it('should update loading message', () => {
      loadingIndicator.start('Initial message');
      expect(() => loadingIndicator.update('Updated message')).not.toThrow();
    });

    it('should succeed loading indicator', () => {
      loadingIndicator.start('Test message');
      expect(() => loadingIndicator.succeed('Success message')).not.toThrow();
    });

    it('should fail loading indicator', () => {
      loadingIndicator.start('Test message');
      expect(() => loadingIndicator.fail('Error message')).not.toThrow();
    });

    it('should stop loading indicator', () => {
      loadingIndicator.start('Test message');
      expect(() => loadingIndicator.stop()).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle operations when not spinning', () => {
      expect(() => loadingIndicator.update('Message')).not.toThrow();
      expect(() => loadingIndicator.succeed('Success')).not.toThrow();
      expect(() => loadingIndicator.fail('Error')).not.toThrow();
      expect(() => loadingIndicator.stop()).not.toThrow();
    });

    it('should report spinning state correctly', () => {
      const isSpinning = loadingIndicator.isSpinning();
      expect(typeof isSpinning).toBe('boolean');
    });
  });
});

describe('withLoadingIndicator', () => {
  it('should handle successful operation', async () => {
    const mockOperation = jest.fn().mockResolvedValue('success result');
    
    const result = await withLoadingIndicator('Test operation', mockOperation);
    
    expect(result).toBe('success result');
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should handle failed operation', async () => {
    const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'));
    
    await expect(withLoadingIndicator('Test operation', mockOperation)).rejects.toThrow('Test error');
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should handle operation with custom options', async () => {
    const mockOperation = jest.fn().mockResolvedValue('result');
    
    const result = await withLoadingIndicator(
      'Test operation',
      mockOperation,
      {
        successMessage: 'Custom success',
        errorMessage: 'Custom error',
        spinnerType: 'arrow3'
      }
    );
    
    expect(result).toBe('result');
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should propagate thrown errors', async () => {
    const testError = new Error('Async operation failed');
    const mockOperation = jest.fn().mockRejectedValue(testError);
    
    await expect(withLoadingIndicator('Failing operation', mockOperation))
      .rejects.toThrow('Async operation failed');
  });

  it('should handle long-running operations', async () => {
    const mockOperation = jest.fn().mockImplementation(async () => {
      return new Promise(resolve => setTimeout(() => resolve('delayed result'), 10));
    });
    
    const result = await withLoadingIndicator('Long operation', mockOperation);
    
    expect(result).toBe('delayed result');
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });
});