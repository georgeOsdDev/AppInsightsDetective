import { AIProviderConfig, DataSourceConfig, AuthConfig, AIProviderType, DataSourceType, AuthType } from '../core/types/ProviderTypes';
import { logger } from './logger';

/**
 * Validation result for provider configurations
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Provider configuration validator
 */
export class ProviderConfigValidator {

  /**
   * Validate AI provider configuration
   */
  static validateAIProviderConfig(config: AIProviderConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    // Type-specific validation
    switch (config.type) {
      case 'azure-openai':
        return this.validateAzureOpenAIConfig(config);
      case 'openai':
        return this.validateOpenAIConfig(config);
      case 'anthropic':
        result.errors.push('Anthropic provider not yet implemented');
        result.isValid = false;
        break;
      default:
        result.errors.push(`Unsupported AI provider type: ${config.type}`);
        result.isValid = false;
    }

    return result;
  }

  /**
   * Validate data source provider configuration
   */
  static validateDataSourceConfig(config: DataSourceConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    // Type-specific validation
    switch (config.type) {
      case 'application-insights':
        return this.validateApplicationInsightsConfig(config);
      case 'log-analytics':
        return this.validateLogAnalyticsConfig(config);
      case 'azure-metrics':
        result.errors.push('Azure Metrics provider not yet implemented');
        result.isValid = false;
        break;
      default:
        result.errors.push(`Unsupported data source provider type: ${config.type}`);
        result.isValid = false;
    }

    return result;
  }

  /**
   * Validate auth provider configuration
   */
  static validateAuthConfig(config: AuthConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    switch (config.type) {
      case 'azure-managed-identity':
        return this.validateAzureManagedIdentityConfig(config);
      case 'service-principal':
        result.errors.push('Service Principal auth provider not yet implemented');
        result.isValid = false;
        break;
      default:
        result.errors.push(`Unsupported auth provider type: ${config.type}`);
        result.isValid = false;
    }

    return result;
  }

  /**
   * Validate Azure OpenAI configuration
   */
  private static validateAzureOpenAIConfig(config: AIProviderConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    if (!config.endpoint) {
      result.errors.push('Azure OpenAI endpoint is required');
      result.isValid = false;
    } else if (config.endpoint && !this.isValidUrl(config.endpoint)) {
      result.errors.push('Azure OpenAI endpoint must be a valid URL');
      result.isValid = false;
    }

    if (!config.apiKey) {
      result.warnings.push('Azure OpenAI API key not provided, will rely on managed identity');
    }

    if (!config.deploymentName) {
      result.warnings.push('Azure OpenAI deployment name not specified, will use default');
    }

    return result;
  }

  /**
   * Validate OpenAI configuration
   */
  private static validateOpenAIConfig(config: AIProviderConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    if (!config.apiKey) {
      result.errors.push('OpenAI API key is required');
      result.isValid = false;
    }

    if (!config.model) {
      result.warnings.push('OpenAI model not specified, will use default (gpt-4)');
    }

    // OpenAI doesn't need endpoint or deploymentName
    if (config.endpoint) {
      result.warnings.push('Endpoint not used for OpenAI provider, will be ignored');
    }
    if (config.deploymentName) {
      result.warnings.push('Deployment name not used for OpenAI provider, will be ignored');
    }

    return result;
  }

  /**
   * Validate Application Insights configuration
   */
  private static validateApplicationInsightsConfig(config: DataSourceConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    if (!config.applicationId) {
      result.errors.push('Application Insights application ID is required');
      result.isValid = false;
    }

    // Optional but recommended for resource discovery
    if (!config.subscriptionId) {
      result.warnings.push('Subscription ID not provided, resource discovery may be limited');
    }
    if (!config.resourceGroup) {
      result.warnings.push('Resource group not provided, resource discovery may be limited');  
    }
    if (!config.resourceName) {
      result.warnings.push('Resource name not provided, resource discovery may be limited');
    }

    return result;
  }

  /**
   * Validate Log Analytics configuration
   */
  private static validateLogAnalyticsConfig(config: DataSourceConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    if (!config.subscriptionId) {
      result.errors.push('Log Analytics subscription ID is required');
      result.isValid = false;
    }

    if (!config.resourceGroup) {
      result.errors.push('Log Analytics resource group is required');
      result.isValid = false;
    }

    if (!config.resourceName) {
      result.errors.push('Log Analytics workspace name is required');
      result.isValid = false;
    }

    // Application ID not used for Log Analytics
    if (config.applicationId) {
      result.warnings.push('Application ID not used for Log Analytics provider, will be ignored');
    }

    return result;
  }

  /**
   * Validate Azure Managed Identity configuration
   */
  private static validateAzureManagedIdentityConfig(config: AuthConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    // Tenant ID is optional for managed identity
    if (!config.tenantId) {
      result.warnings.push('Tenant ID not provided, will use default tenant');
    }

    // Client ID and secret not used for managed identity
    if (config.clientId || config.clientSecret) {
      result.warnings.push('Client ID and secret not used for managed identity, will be ignored');
    }

    return result;
  }

  /**
   * Validate if string is a valid URL
   */
  private static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Only allow http and https protocols
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Log validation results
   */
  static logValidationResult(providerType: string, result: ValidationResult): void {
    if (result.isValid) {
      logger.info(`${providerType} configuration is valid`);
    } else {
      logger.error(`${providerType} configuration is invalid:`, result.errors);
    }

    if (result.warnings.length > 0) {
      logger.warn(`${providerType} configuration warnings:`, result.warnings);
    }
  }
}