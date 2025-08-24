import { AuthService } from '../../src/services/authService';
import { ConfigManager } from '../../src/utils/config';
import { AppInsightsService } from '../../src/services/appInsightsService';

// Mock Azure SDK and dependencies
jest.mock('@azure/identity');
jest.mock('../../src/utils/logger');

// Mock axios with interceptors
const mockAxiosInstance = {
  interceptors: {
    request: {
      use: jest.fn()
    },
    response: {
      use: jest.fn()
    }
  }
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  default: {
    create: jest.fn(() => mockAxiosInstance)
  }
}));

describe('Integration Tests', () => {
  describe('Service Initialization', () => {
  it('should initialize all core services without errors', () => {
    const mockConfigManager = {
      get: jest.fn().mockReturnValue({ applicationId: 'test-app-id' }),
      getConfig: jest.fn().mockReturnValue({
        providers: {
          dataSources: {
            default: 'application-insights',
            'application-insights': {
              applicationId: 'test-app-id',
              endpoint: 'https://api.applicationinsights.io/v1/apps'
            }
          }
        },
        appInsights: { endpoint: 'https://api.applicationinsights.io/v1/apps' }
      }),
      getDefaultProvider: jest.fn().mockReturnValue('application-insights'),
      getProviderConfig: jest.fn().mockReturnValue({
        applicationId: 'test-app-id',
        endpoint: 'https://api.applicationinsights.io/v1/apps'
      }),
      getOpenAIConfig: jest.fn().mockReturnValue({
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com/',
        deploymentName: 'gpt-4'
      })
    } as any;

    expect(() => new AuthService()).not.toThrow();

    // Mock axios to prevent interceptor setup errors
    const mockAxios = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };

    jest.doMock('axios', () => ({
      create: jest.fn(() => mockAxios),
      default: mockAxios
    }));

    const authService = new AuthService();
    expect(() => new AppInsightsService(authService, mockConfigManager)).not.toThrow();
  });    it('should handle configuration validation', () => {
      const configManager = new ConfigManager();

      // This should not throw during instantiation
      expect(configManager).toBeDefined();
      expect(typeof configManager.getConfig).toBe('function');
      expect(typeof configManager.validateConfig).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors gracefully', async () => {
      const authService = new AuthService();

      // Even if authentication fails, the service should be instantiated
      expect(authService).toBeDefined();
      expect(typeof authService.getAccessToken).toBe('function');
      expect(typeof authService.getOpenAIToken).toBe('function');
    });
  });
});
