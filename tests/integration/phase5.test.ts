import { ProviderFactory } from '../../src/infrastructure/di/ProviderFactory';
import { OpenAIProvider } from '../../src/providers/ai/OpenAIProvider';
import { LogAnalyticsProvider } from '../../src/providers/datasource/LogAnalyticsProvider';
import { AIProviderConfig, DataSourceConfig } from '../../src/core/types/ProviderTypes';

describe('Phase 5 Integration Tests', () => {
  let providerFactory: ProviderFactory;

  beforeEach(() => {
    providerFactory = new ProviderFactory();
  });

  describe('Provider Registration and Discovery', () => {
    it('should register Phase 5 providers successfully', () => {
      // Register providers manually for testing
      const { AzureOpenAIProvider } = require('../../src/providers/ai/AzureOpenAIProvider');
      const { OpenAIProvider } = require('../../src/providers/ai/OpenAIProvider');
      const { ApplicationInsightsProvider } = require('../../src/providers/datasource/ApplicationInsightsProvider');
      const { LogAnalyticsProvider } = require('../../src/providers/datasource/LogAnalyticsProvider');
      const { AzureManagedIdentityProvider } = require('../../src/providers/auth/AzureManagedIdentityProvider');

      providerFactory.registerAIProvider('azure-openai', AzureOpenAIProvider);
      providerFactory.registerAIProvider('openai', OpenAIProvider);
      providerFactory.registerDataSourceProvider('application-insights', ApplicationInsightsProvider);
      providerFactory.registerDataSourceProvider('log-analytics', LogAnalyticsProvider);
      providerFactory.registerAuthProvider('azure-managed-identity', AzureManagedIdentityProvider);

      // Verify AI providers are registered
      expect(providerFactory.isAIProviderRegistered('azure-openai')).toBe(true);
      expect(providerFactory.isAIProviderRegistered('openai')).toBe(true);

      // Verify data source providers are registered
      expect(providerFactory.isDataSourceProviderRegistered('application-insights')).toBe(true);
      expect(providerFactory.isDataSourceProviderRegistered('log-analytics')).toBe(true);
    });

    it('should return available providers through discovery mechanism', () => {
      // Register providers manually for testing
      const { AzureOpenAIProvider } = require('../../src/providers/ai/AzureOpenAIProvider');
      const { OpenAIProvider } = require('../../src/providers/ai/OpenAIProvider');
      const { ApplicationInsightsProvider } = require('../../src/providers/datasource/ApplicationInsightsProvider');
      const { LogAnalyticsProvider } = require('../../src/providers/datasource/LogAnalyticsProvider');

      providerFactory.registerAIProvider('azure-openai', AzureOpenAIProvider);
      providerFactory.registerAIProvider('openai', OpenAIProvider);
      providerFactory.registerDataSourceProvider('application-insights', ApplicationInsightsProvider);
      providerFactory.registerDataSourceProvider('log-analytics', LogAnalyticsProvider);

      const aiProviders = providerFactory.getAvailableAIProviders();
      const dataSourceProviders = providerFactory.getAvailableDataSourceProviders();

      // Check that Phase 5 providers are included
      expect(aiProviders).toContain('openai');
      expect(aiProviders).toContain('azure-openai');
      expect(dataSourceProviders).toContain('log-analytics');
      expect(dataSourceProviders).toContain('application-insights');
    });
  });

  describe('OpenAI Provider Integration', () => {
    const validOpenAIConfig: AIProviderConfig = {
      type: 'openai',
      apiKey: 'test-api-key',
      model: 'gpt-4'
    };

    beforeEach(() => {
      const { OpenAIProvider } = require('../../src/providers/ai/OpenAIProvider');
      providerFactory.registerAIProvider('openai', OpenAIProvider);
    });

    it('should create OpenAI provider with valid configuration', () => {
      expect(() => {
        providerFactory.createAIProvider('openai', validOpenAIConfig);
      }).not.toThrow();
    });

    it('should validate OpenAI configuration and reject invalid config', () => {
      const invalidConfig: AIProviderConfig = {
        type: 'openai'
        // Missing required apiKey
      };

      expect(() => {
        providerFactory.createAIProvider('openai', invalidConfig);
      }).toThrow(/Invalid AI provider configuration/);
    });

    it('should initialize OpenAI provider correctly', async () => {
      const provider = new OpenAIProvider(validOpenAIConfig);

      // Should initialize without throwing
      await expect(provider.initialize()).resolves.not.toThrow();
    });
  });

  describe('Log Analytics Provider Integration', () => {
    const validLogAnalyticsConfig: DataSourceConfig = {
      type: 'log-analytics',
      subscriptionId: 'test-subscription-id',
      resourceGroup: 'test-rg',
      resourceName: 'test-workspace'
    };

    beforeEach(() => {
      const { LogAnalyticsProvider } = require('../../src/providers/datasource/LogAnalyticsProvider');
      providerFactory.registerDataSourceProvider('log-analytics', LogAnalyticsProvider);
    });

    it('should create Log Analytics provider with valid configuration', () => {
      expect(() => {
        providerFactory.createDataSourceProvider('log-analytics', validLogAnalyticsConfig);
      }).not.toThrow();
    });

    it('should validate Log Analytics configuration and reject invalid config', () => {
      const invalidConfig: DataSourceConfig = {
        type: 'log-analytics'
        // Missing required fields: subscriptionId, resourceGroup, resourceName
      };

      expect(() => {
        providerFactory.createDataSourceProvider('log-analytics', invalidConfig);
      }).toThrow(/Invalid data source provider configuration/);
    });

    it('should initialize Log Analytics provider correctly', () => {
      const provider = new LogAnalyticsProvider(validLogAnalyticsConfig);

      // Should create instance without throwing
      expect(provider).toBeInstanceOf(LogAnalyticsProvider);
    });
  });

  describe('Configuration Validation', () => {
    beforeEach(() => {
      const { OpenAIProvider } = require('../../src/providers/ai/OpenAIProvider');
      providerFactory.registerAIProvider('openai', OpenAIProvider);
    });

    it('should warn about missing optional configuration for OpenAI', () => {
      // Spy on logger to capture warnings
      const loggerSpy = jest.spyOn(require('../../src/utils/logger').logger, 'warn');

      const configWithoutModel: AIProviderConfig = {
        type: 'openai',
        apiKey: 'test-api-key'
        // Missing model - should generate warning
      };

      providerFactory.createAIProvider('openai', configWithoutModel);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI Provider (openai) configuration warnings: OpenAI model not specified')
      );

      loggerSpy.mockRestore();
    });

    it('should warn about unused configuration parameters', () => {
      // Spy on logger to capture warnings
      const loggerSpy = jest.spyOn(require('../../src/utils/logger').logger, 'warn');

      const configWithUnusedParams: AIProviderConfig = {
        type: 'openai',
        apiKey: 'test-api-key',
        endpoint: 'https://unused-endpoint.com', // Not used for OpenAI
        deploymentName: 'unused-deployment' // Not used for OpenAI
      };

      providerFactory.createAIProvider('openai', configWithUnusedParams);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI Provider (openai) configuration warnings:')
      );

      loggerSpy.mockRestore();
    });
  });

  describe('Provider Type Support', () => {
    beforeEach(() => {
      const { OpenAIProvider } = require('../../src/providers/ai/OpenAIProvider');
      const { LogAnalyticsProvider } = require('../../src/providers/datasource/LogAnalyticsProvider');
      providerFactory.registerAIProvider('openai', OpenAIProvider);
      providerFactory.registerDataSourceProvider('log-analytics', LogAnalyticsProvider);
    });

    it('should throw error for unsupported AI provider type', () => {
      const unsupportedConfig: AIProviderConfig = {
        type: 'anthropic' as any, // Type is defined but not implemented
        apiKey: 'test-key'
      };

      expect(() => {
        providerFactory.createAIProvider('anthropic' as any, unsupportedConfig);
      }).toThrow(/Anthropic provider not yet implemented/);
    });

    it('should throw error for unsupported data source provider type', () => {
      const unsupportedConfig: DataSourceConfig = {
        type: 'azure-metrics' as any // Type is defined but not implemented
      };

      expect(() => {
        providerFactory.createDataSourceProvider('azure-metrics' as any, unsupportedConfig);
      }).toThrow(/Azure Metrics provider not yet implemented/);
    });
  });

  describe('Multi-Provider Scenario', () => {
    beforeEach(() => {
      const { AzureOpenAIProvider } = require('../../src/providers/ai/AzureOpenAIProvider');
      const { OpenAIProvider } = require('../../src/providers/ai/OpenAIProvider');
      const { LogAnalyticsProvider } = require('../../src/providers/datasource/LogAnalyticsProvider');
      
      providerFactory.registerAIProvider('azure-openai', AzureOpenAIProvider);
      providerFactory.registerAIProvider('openai', OpenAIProvider);
      providerFactory.registerDataSourceProvider('log-analytics', LogAnalyticsProvider);
    });

    it('should support creating multiple providers simultaneously', () => {
      // Create OpenAI provider
      const openAIProvider = providerFactory.createAIProvider('openai', {
        type: 'openai',
        apiKey: 'test-key'
      });

      // Create Log Analytics provider
      const logAnalyticsProvider = providerFactory.createDataSourceProvider('log-analytics', {
        type: 'log-analytics',
        subscriptionId: 'test-sub',
        resourceGroup: 'test-rg',
        resourceName: 'test-workspace'
      });

      expect(openAIProvider).toBeInstanceOf(OpenAIProvider);
      expect(logAnalyticsProvider).toBeInstanceOf(LogAnalyticsProvider);
    });

    it('should maintain provider independence', () => {
      // Create two different AI providers
      const azureProvider = providerFactory.createAIProvider('azure-openai', {
        type: 'azure-openai',
        endpoint: 'https://test.openai.azure.com',
        apiKey: 'test-key',
        deploymentName: 'gpt-4'
      });

      const openAIProvider = providerFactory.createAIProvider('openai', {
        type: 'openai',
        apiKey: 'different-key'
      });

      // They should be different instances
      expect(azureProvider).not.toBe(openAIProvider);
    });
  });
});