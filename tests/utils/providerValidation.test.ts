import { ProviderConfigValidator } from '../../src/utils/providerValidation';
import { AIProviderConfig, DataSourceConfig, AuthConfig } from '../../src/core/types/ProviderTypes';

describe('ProviderConfigValidator', () => {
  
  describe('AI Provider Validation', () => {
    describe('Azure OpenAI', () => {
      it('should validate complete Azure OpenAI configuration', () => {
        const config: AIProviderConfig = {
          type: 'azure-openai',
          endpoint: 'https://test.openai.azure.com',
          apiKey: 'test-api-key',
          deploymentName: 'gpt-4'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject Azure OpenAI config without endpoint', () => {
        const config: AIProviderConfig = {
          type: 'azure-openai',
          apiKey: 'test-api-key'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Azure OpenAI endpoint is required');
      });

      it('should reject invalid endpoint URL', () => {
        const config: AIProviderConfig = {
          type: 'azure-openai',
          endpoint: 'not-a-valid-url',
          apiKey: 'test-api-key'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Azure OpenAI endpoint must be a valid URL');
      });

      it('should warn about missing API key (relying on managed identity)', () => {
        const config: AIProviderConfig = {
          type: 'azure-openai',
          endpoint: 'https://test.openai.azure.com'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Azure OpenAI API key not provided, will rely on managed identity');
      });

      it('should warn about missing deployment name', () => {
        const config: AIProviderConfig = {
          type: 'azure-openai',
          endpoint: 'https://test.openai.azure.com',
          apiKey: 'test-key'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Azure OpenAI deployment name not specified, will use default');
      });
    });

    describe('OpenAI', () => {
      it('should validate complete OpenAI configuration', () => {
        const config: AIProviderConfig = {
          type: 'openai',
          apiKey: 'test-api-key',
          model: 'gpt-4'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject OpenAI config without API key', () => {
        const config: AIProviderConfig = {
          type: 'openai'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('OpenAI API key is required');
      });

      it('should warn about missing model', () => {
        const config: AIProviderConfig = {
          type: 'openai',
          apiKey: 'test-key'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('OpenAI model not specified, will use default (gpt-4)');
      });

      it('should warn about unused Azure-specific parameters', () => {
        const config: AIProviderConfig = {
          type: 'openai',
          apiKey: 'test-key',
          endpoint: 'https://unused.com',
          deploymentName: 'unused'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Endpoint not used for OpenAI provider, will be ignored');
        expect(result.warnings).toContain('Deployment name not used for OpenAI provider, will be ignored');
      });
    });

    describe('Unsupported Providers', () => {
      it('should reject unsupported AI provider types', () => {
        const config: AIProviderConfig = {
          type: 'anthropic',
          apiKey: 'test-key'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Anthropic provider not yet implemented');
      });
    });
  });

  describe('Data Source Provider Validation', () => {
    describe('Application Insights', () => {
      it('should validate complete Application Insights configuration', () => {
        const config: DataSourceConfig = {
          type: 'application-insights',
          applicationId: 'test-app-id',
          subscriptionId: 'test-sub-id',
          resourceGroup: 'test-rg',
          resourceName: 'test-app-insights'
        };

        const result = ProviderConfigValidator.validateDataSourceConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject Application Insights config without application ID', () => {
        const config: DataSourceConfig = {
          type: 'application-insights'
        };

        const result = ProviderConfigValidator.validateDataSourceConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Application Insights application ID is required');
      });

      it('should warn about missing optional configuration', () => {
        const config: DataSourceConfig = {
          type: 'application-insights',
          applicationId: 'test-app-id'
        };

        const result = ProviderConfigValidator.validateDataSourceConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Subscription ID not provided, resource discovery may be limited');
        expect(result.warnings).toContain('Resource group not provided, resource discovery may be limited');
        expect(result.warnings).toContain('Resource name not provided, resource discovery may be limited');
      });
    });

    describe('Log Analytics', () => {
      it('should validate complete Log Analytics configuration', () => {
        const config: DataSourceConfig = {
          type: 'log-analytics',
          subscriptionId: 'test-sub-id',
          resourceGroup: 'test-rg',
          resourceName: 'test-workspace'
        };

        const result = ProviderConfigValidator.validateDataSourceConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject Log Analytics config without required fields', () => {
        const config: DataSourceConfig = {
          type: 'log-analytics'
        };

        const result = ProviderConfigValidator.validateDataSourceConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Log Analytics subscription ID is required');
        expect(result.errors).toContain('Log Analytics resource group is required');
        expect(result.errors).toContain('Log Analytics workspace name is required');
      });

      it('should warn about unused Application Insights parameters', () => {
        const config: DataSourceConfig = {
          type: 'log-analytics',
          subscriptionId: 'test-sub-id',
          resourceGroup: 'test-rg',
          resourceName: 'test-workspace',
          applicationId: 'unused-app-id'
        };

        const result = ProviderConfigValidator.validateDataSourceConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Application ID not used for Log Analytics provider, will be ignored');
      });
    });

    describe('Unsupported Providers', () => {
      it('should reject unsupported data source provider types', () => {
        const config: DataSourceConfig = {
          type: 'azure-metrics'
        };

        const result = ProviderConfigValidator.validateDataSourceConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Azure Metrics provider not yet implemented');
      });
    });
  });

  describe('Auth Provider Validation', () => {
    describe('Azure Managed Identity', () => {
      it('should validate Azure Managed Identity configuration', () => {
        const config: AuthConfig = {
          type: 'azure-managed-identity',
          tenantId: 'test-tenant-id'
        };

        const result = ProviderConfigValidator.validateAuthConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should allow minimal configuration', () => {
        const config: AuthConfig = {
          type: 'azure-managed-identity'
        };

        const result = ProviderConfigValidator.validateAuthConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Tenant ID not provided, will use default tenant');
      });

      it('should warn about unused service principal parameters', () => {
        const config: AuthConfig = {
          type: 'azure-managed-identity',
          clientId: 'unused-client-id',
          clientSecret: 'unused-secret'
        };

        const result = ProviderConfigValidator.validateAuthConfig(config);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Client ID and secret not used for managed identity, will be ignored');
      });
    });

    describe('Unsupported Providers', () => {
      it('should reject unsupported auth provider types', () => {
        const config: AuthConfig = {
          type: 'service-principal',
          clientId: 'test-client-id',
          clientSecret: 'test-secret'
        };

        const result = ProviderConfigValidator.validateAuthConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Service Principal auth provider not yet implemented');
      });
    });
  });

  describe('URL Validation', () => {
    it('should validate proper URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://test.openai.azure.com',
        'http://localhost:3000',
        'https://api.openai.com/v1'
      ];

      validUrls.forEach(url => {
        const config: AIProviderConfig = {
          type: 'azure-openai',
          endpoint: url,
          apiKey: 'test-key'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'just-a-string',
        'ftp://invalid-protocol.com' // This should fail due to protocol check
      ];

      invalidUrls.forEach(url => {
        const config: AIProviderConfig = {
          type: 'azure-openai',
          endpoint: url,
          apiKey: 'test-key'
        };

        const result = ProviderConfigValidator.validateAIProviderConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Azure OpenAI endpoint must be a valid URL');
      });
    });

    it('should reject empty endpoint', () => {
      const config: AIProviderConfig = {
        type: 'azure-openai',
        endpoint: '',
        apiKey: 'test-key'
      };

      const result = ProviderConfigValidator.validateAIProviderConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Azure OpenAI endpoint is required');
    });
  });
});