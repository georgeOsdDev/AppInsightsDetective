import { IProviderFactory } from '../../core/interfaces/IProviderFactory';
import { IAIProvider, IDataSourceProvider, IAuthenticationProvider, IExternalExecutionProvider } from '../../core/interfaces';
import { 
  AIProviderType, 
  DataSourceType, 
  AuthType, 
  ExternalExecutionProviderType,
  AIProviderConfig, 
  DataSourceConfig, 
  AuthConfig,
  ExternalExecutionProviderConfig 
} from '../../core/types/ProviderTypes';
import { logger } from '../../utils/logger';
import { ProviderConfigValidator } from '../../utils/providerValidation';

// Provider constructors
type AIProviderConstructor = new (config: AIProviderConfig, authProvider?: IAuthenticationProvider) => IAIProvider;
type DataSourceProviderConstructor = new (config: DataSourceConfig, authProvider?: IAuthenticationProvider) => IDataSourceProvider;
type AuthProviderConstructor = new (config: AuthConfig) => IAuthenticationProvider;
type ExternalExecutionProviderConstructor = new (config: ExternalExecutionProviderConfig) => IExternalExecutionProvider;

/**
 * Factory for creating provider instances
 */
export class ProviderFactory implements IProviderFactory {
  private aiProviders = new Map<AIProviderType, AIProviderConstructor>();
  private dataSourceProviders = new Map<DataSourceType, DataSourceProviderConstructor>();
  private authProviders = new Map<AuthType, AuthProviderConstructor>();
  private externalExecutionProviders = new Map<ExternalExecutionProviderType, ExternalExecutionProviderConstructor>();

  /**
   * Register an AI provider constructor
   */
  registerAIProvider(type: AIProviderType, constructor: AIProviderConstructor): void {
    logger.debug(`Registering AI provider: ${type}`);
    this.aiProviders.set(type, constructor);
  }

  /**
   * Register a data source provider constructor
   */
  registerDataSourceProvider(type: DataSourceType, constructor: DataSourceProviderConstructor): void {
    logger.debug(`Registering data source provider: ${type}`);
    this.dataSourceProviders.set(type, constructor);
  }

  /**
   * Register an auth provider constructor
   */
  registerAuthProvider(type: AuthType, constructor: AuthProviderConstructor): void {
    logger.debug(`Registering auth provider: ${type}`);
    this.authProviders.set(type, constructor);
  }

  /**
   * Register an external execution provider constructor
   */
  registerExternalExecutionProvider(type: ExternalExecutionProviderType, constructor: ExternalExecutionProviderConstructor): void {
    logger.debug(`Registering external execution provider: ${type}`);
    this.externalExecutionProviders.set(type, constructor);
  }

  /**
   * Create AI provider instance
   */
  createAIProvider(type: AIProviderType, config: AIProviderConfig, authProvider?: IAuthenticationProvider): IAIProvider {
    // Validate configuration before creating provider
    const validationResult = ProviderConfigValidator.validateAIProviderConfig(config);
    ProviderConfigValidator.logValidationResult(`AI Provider (${type})`, validationResult);

    if (!validationResult.isValid) {
      throw new Error(`Invalid AI provider configuration for ${type}: ${validationResult.errors.join(', ')}`);
    }

    const constructor = this.aiProviders.get(type);
    if (!constructor) {
      throw new Error(`AI provider not registered: ${type}`);
    }
    logger.debug(`Creating AI provider: ${type}`);
    return new constructor(config, authProvider);
  }

  /**
   * Create data source provider instance
   */
  createDataSourceProvider(type: DataSourceType, config: DataSourceConfig, authProvider?: IAuthenticationProvider): IDataSourceProvider {
    // Validate configuration before creating provider
    const validationResult = ProviderConfigValidator.validateDataSourceConfig(config);
    ProviderConfigValidator.logValidationResult(`Data Source Provider (${type})`, validationResult);

    if (!validationResult.isValid) {
      throw new Error(`Invalid data source provider configuration for ${type}: ${validationResult.errors.join(', ')}`);
    }

    const constructor = this.dataSourceProviders.get(type);
    if (!constructor) {
      throw new Error(`Data source provider not registered: ${type}`);
    }
    logger.debug(`Creating data source provider: ${type}`);
    return new constructor(config, authProvider);
  }

  /**
   * Create authentication provider instance
   */
  createAuthProvider(type: AuthType, config: AuthConfig): IAuthenticationProvider {
    // Validate configuration before creating provider
    const validationResult = ProviderConfigValidator.validateAuthConfig(config);
    ProviderConfigValidator.logValidationResult(`Auth Provider (${type})`, validationResult);

    if (!validationResult.isValid) {
      throw new Error(`Invalid auth provider configuration for ${type}: ${validationResult.errors.join(', ')}`);
    }

    const constructor = this.authProviders.get(type);
    if (!constructor) {
      throw new Error(`Auth provider not registered: ${type}`);
    }
    logger.debug(`Creating auth provider: ${type}`);
    return new constructor(config);
  }

  /**
   * Create external execution provider instance
   */
  createExternalExecutionProvider(type: ExternalExecutionProviderType, config: ExternalExecutionProviderConfig): IExternalExecutionProvider {
    // Basic validation - more comprehensive validation will be done by the provider
    if (!config.type) {
      throw new Error('External execution provider configuration must have a type');
    }

    const constructor = this.externalExecutionProviders.get(type);
    if (!constructor) {
      throw new Error(`External execution provider not registered: ${type}`);
    }
    logger.debug(`Creating external execution provider: ${type}`);
    return new constructor(config);
  }

  /**
   * Get available AI provider types
   */
  getAvailableAIProviders(): AIProviderType[] {
    return Array.from(this.aiProviders.keys());
  }

  /**
   * Get available data source provider types
   */
  getAvailableDataSourceProviders(): DataSourceType[] {
    return Array.from(this.dataSourceProviders.keys());
  }

  /**
   * Get available auth provider types
   */
  getAvailableAuthProviders(): AuthType[] {
    return Array.from(this.authProviders.keys());
  }

  /**
   * Get available external execution provider types
   */
  getAvailableExternalExecutionProviders(): ExternalExecutionProviderType[] {
    return Array.from(this.externalExecutionProviders.keys());
  }

  /**
   * Check if AI provider is registered
   */
  isAIProviderRegistered(type: AIProviderType): boolean {
    return this.aiProviders.has(type);
  }

  /**
   * Check if data source provider is registered
   */
  isDataSourceProviderRegistered(type: DataSourceType): boolean {
    return this.dataSourceProviders.has(type);
  }

  /**
   * Check if auth provider is registered
   */
  isAuthProviderRegistered(type: AuthType): boolean {
    return this.authProviders.has(type);
  }

  /**
   * Check if external execution provider is registered
   */
  isExternalExecutionProviderRegistered(type: ExternalExecutionProviderType): boolean {
    return this.externalExecutionProviders.has(type);
  }
}