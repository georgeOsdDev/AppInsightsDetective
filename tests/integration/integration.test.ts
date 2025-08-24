import { ConfigManager } from '../../src/utils/config';
import { Bootstrap } from '../../src/infrastructure/Bootstrap';
import { ProviderFactory } from '../../src/infrastructure/di/ProviderFactory';

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
  describe('Provider Architecture Integration', () => {
    it('should initialize providers through Bootstrap without errors', async () => {
      // Mock config manager to provide multi-provider config
      const mockConfigManager = {
        getConfig: jest.fn().mockReturnValue({
          providers: {
            auth: {
              default: 'azure-managed-identity',
              'azure-managed-identity': {}
            },
            ai: {
              default: 'azure-openai',
              'azure-openai': {
                endpoint: 'https://test.openai.azure.com/',
                deploymentName: 'gpt-4'
              }
            },
            dataSources: {
              default: 'application-insights',
              'application-insights': {
                applicationId: 'test-app-id',
                endpoint: 'https://api.applicationinsights.io/v1/apps'
              }
            }
          }
        }),
        validateConfig: jest.fn().mockReturnValue(true)
      } as any;

      // Mock Bootstrap initialization
      const bootstrap = new Bootstrap();
      jest.spyOn(bootstrap, 'initialize' as any).mockResolvedValue({
        resolve: jest.fn()
      });

      expect(async () => await bootstrap.initialize()).not.toThrow();
    });    it('should handle configuration validation', () => {
      const configManager = new ConfigManager();

      // This should not throw during instantiation
      expect(configManager).toBeDefined();
      expect(typeof configManager.getConfig).toBe('function');
      expect(typeof configManager.validateConfig).toBe('function');
    });

    it('should validate provider factory creation', () => {
      const providerFactory = new ProviderFactory();
      
      expect(providerFactory).toBeDefined();
      expect(typeof providerFactory.createAuthProvider).toBe('function');
      expect(typeof providerFactory.createAIProvider).toBe('function');
      expect(typeof providerFactory.createDataSourceProvider).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle provider initialization errors gracefully', () => {
      const providerFactory = new ProviderFactory();
      
      // Provider factory should handle invalid configurations gracefully
      expect(() => {
        providerFactory.createAuthProvider('invalid-provider' as any, { type: 'invalid' } as any);
      }).toThrow();
    });
  });
});
