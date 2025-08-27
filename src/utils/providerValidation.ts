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
      case 'ollama':
        return this.validateOllamaConfig(config);
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
      case 'azure-data-explorer':
        return this.validateAzureDataExplorerConfig(config);
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

    // Only generate warnings for actual configuration issues, not for expected managed identity usage
    // No longer warn about missing apiKey since managed identity is a valid auth method
    // No longer warn about missing deploymentName since defaults are acceptable

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
   * Validate Ollama configuration
   */
  private static validateOllamaConfig(config: AIProviderConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    // Validate endpoint
    if (!config.endpoint) {
      result.warnings.push('Ollama endpoint not specified, will use default (http://localhost:11434/v1)');
    } else {
      try {
        new URL(config.endpoint);
      } catch {
        result.errors.push('Invalid Ollama endpoint URL');
        result.isValid = false;
      }
    }

    // Validate model
    if (!config.model) {
      result.warnings.push('Ollama model not specified, will use default (phi3:latest)');
    }

    // Ollama doesn't need an actual API key
    if (!config.apiKey) {
      result.warnings.push('API key not required for Ollama, using placeholder value');
    }

    // Ollama doesn't use deploymentName
    if (config.deploymentName) {
      result.warnings.push('Deployment name not used for Ollama provider, will be ignored');
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

    // Only generate warnings for actual issues, not for optional fields that have reasonable defaults
    // Resource discovery is optional and many users don't need these fields
    // No longer warn about missing subscriptionId, resourceGroup, resourceName

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
   * Validate Azure Data Explorer configuration
   */
  private static validateAzureDataExplorerConfig(config: DataSourceConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    if (!config.clusterUri) {
      result.errors.push('Azure Data Explorer cluster URI is required');
      result.isValid = false;
    } else if (!this.isValidUrl(config.clusterUri)) {
      result.errors.push('Azure Data Explorer cluster URI must be a valid URL');
      result.isValid = false;
    }

    if (!config.database) {
      result.errors.push('Azure Data Explorer database name is required');
      result.isValid = false;
    }

    // Warn about unused fields
    if (config.applicationId) {
      result.warnings.push('Application ID not used for Azure Data Explorer provider, will be ignored');
    }
    if (config.subscriptionId) {
      result.warnings.push('Subscription ID not used for Azure Data Explorer provider, will be ignored');
    }
    if (config.resourceGroup) {
      result.warnings.push('Resource Group not used for Azure Data Explorer provider, will be ignored');
    }
    if (config.resourceName) {
      result.warnings.push('Resource Name not used for Azure Data Explorer provider, will be ignored');
    }

    return result;
  }

  /**
   * Validate Azure Managed Identity configuration
   */
  private static validateAzureManagedIdentityConfig(config: AuthConfig): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    // Tenant ID is optional for managed identity - no need to warn
    // Client ID and secret are not used for managed identity - no need to warn unless misconfigured
    
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
      logger.error(`${providerType} configuration is invalid: ${result.errors.join(', ')}`);
    }

    // Only log warnings if there are actual meaningful warnings
    const meaningfulWarnings = result.warnings.filter(warning => warning && warning.trim().length > 0);
    if (meaningfulWarnings.length > 0) {
      logger.warn(`${providerType} configuration warnings: ${meaningfulWarnings.join('; ')}`);
    }
  }
}