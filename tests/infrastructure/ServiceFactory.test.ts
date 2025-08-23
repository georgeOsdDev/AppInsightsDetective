import { ServiceFactory } from '../../src/infrastructure/factories/ServiceFactory';

// Mock all the services to avoid actual initialization
jest.mock('../../src/infrastructure/config/EnhancedConfigurationProvider');
jest.mock('../../src/providers/ai/AzureOpenAIProvider');
jest.mock('../../src/providers/datasource/ApplicationInsightsProvider');
jest.mock('../../src/services/orchestration/QueryOrchestrator');
jest.mock('../../src/presentation/renderers/ConsoleOutputRenderer');
jest.mock('../../src/presentation/interactive/InteractiveSessionController');
jest.mock('../../src/services/authService');

describe('ServiceFactory', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createServices', () => {
    it('should create all services successfully', async () => {
      // Mock configuration provider to return valid configuration
      const mockConfigProvider = {
        getEnhancedConfiguration: jest.fn().mockResolvedValue({
          language: 'en'
        }),
        getProviderConfiguration: jest.fn()
          .mockReturnValueOnce({
            config: {
              endpoint: 'https://test.openai.azure.com',
              deploymentName: 'gpt-4'
            }
          })
          .mockReturnValueOnce({
            config: {
              applicationId: 'test-app-id'
            }
          })
      };

      // Mock the static methods
      jest.spyOn(ServiceFactory as any, 'getConfigurationProvider')
        .mockReturnValue(mockConfigProvider);
      jest.spyOn(ServiceFactory as any, 'getAuthService')
        .mockReturnValue({});

      const services = await ServiceFactory.createServices();

      expect(services).toBeDefined();
      expect(services.configProvider).toBeDefined();
      expect(services.aiProvider).toBeDefined();
      expect(services.dataSourceProvider).toBeDefined();
      expect(services.queryOrchestrator).toBeDefined();
      expect(services.outputRenderer).toBeDefined();
      expect(services.sessionController).toBeDefined();
    });

    it('should throw error when AI provider config is missing', async () => {
      const mockConfigProvider = {
        getEnhancedConfiguration: jest.fn().mockResolvedValue({}),
        getProviderConfiguration: jest.fn().mockReturnValue(null)
      };

      jest.spyOn(ServiceFactory as any, 'getConfigurationProvider')
        .mockReturnValue(mockConfigProvider);

      await expect(ServiceFactory.createServices()).rejects.toThrow(
        'Azure OpenAI provider configuration not found'
      );
    });
  });

  describe('createAIProvider', () => {
    it('should create Azure OpenAI provider', async () => {
      const mockConfigProvider = {
        getConfiguration: jest.fn(),
        getEnhancedConfiguration: jest.fn(),
        updateConfiguration: jest.fn(),
        validateConfiguration: jest.fn(),
        getProviderConfiguration: jest.fn().mockReturnValue({
          config: { endpoint: 'test', deploymentName: 'gpt-4' }
        })
      };

      const provider = await ServiceFactory.createAIProvider('azure-openai', mockConfigProvider as any);
      expect(provider).toBeDefined();
    });

    it('should throw error for unsupported provider type', async () => {
      const mockConfigProvider = {
        getConfiguration: jest.fn(),
        getEnhancedConfiguration: jest.fn(),
        updateConfiguration: jest.fn(),
        validateConfiguration: jest.fn(),
        getProviderConfiguration: jest.fn().mockReturnValue({
          config: {}
        })
      };

      await expect(
        ServiceFactory.createAIProvider('unsupported-provider', mockConfigProvider as any)
      ).rejects.toThrow('Unsupported AI provider type: unsupported-provider');
    });
  });

  describe('createDataSourceProvider', () => {
    it('should create Application Insights provider', async () => {
      const mockConfigProvider = {
        getConfiguration: jest.fn(),
        getEnhancedConfiguration: jest.fn(),
        updateConfiguration: jest.fn(),
        validateConfiguration: jest.fn(),
        getProviderConfiguration: jest.fn().mockReturnValue({
          config: { applicationId: 'test-id' }
        })
      };

      const provider = await ServiceFactory.createDataSourceProvider(
        'application-insights', 
        mockConfigProvider as any
      );
      expect(provider).toBeDefined();
    });

    it('should throw error for unsupported provider type', async () => {
      const mockConfigProvider = {
        getConfiguration: jest.fn(),
        getEnhancedConfiguration: jest.fn(),
        updateConfiguration: jest.fn(),
        validateConfiguration: jest.fn(),
        getProviderConfiguration: jest.fn().mockReturnValue({
          config: {}
        })
      };

      await expect(
        ServiceFactory.createDataSourceProvider('unsupported-provider', mockConfigProvider as any)
      ).rejects.toThrow('Unsupported data source provider type: unsupported-provider');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate configuration successfully', async () => {
      const mockConfigProvider = {
        getConfiguration: jest.fn().mockReturnValue({}),
        getEnhancedConfiguration: jest.fn(),
        updateConfiguration: jest.fn(),
        getProviderConfiguration: jest.fn(),
        validateConfiguration: jest.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: []
        })
      };

      const result = await ServiceFactory.validateConfiguration(mockConfigProvider as any);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle validation errors', async () => {
      const mockConfigProvider = {
        getConfiguration: jest.fn().mockImplementation(() => {
          throw new Error('Configuration error');
        }),
        getEnhancedConfiguration: jest.fn(),
        updateConfiguration: jest.fn(),
        getProviderConfiguration: jest.fn(),
        validateConfiguration: jest.fn()
      };

      const result = await ServiceFactory.validateConfiguration(mockConfigProvider as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Configuration validation failed');
    });
  });
});