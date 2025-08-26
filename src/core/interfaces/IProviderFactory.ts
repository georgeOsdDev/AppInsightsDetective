import { IAIProvider } from './IAIProvider';
import { IDataSourceProvider } from './IDataSourceProvider';
import { IAuthenticationProvider } from './IAuthenticationProvider';
import { IExternalExecutionProvider } from './IExternalExecutionProvider';
import { AIProviderType, DataSourceType, AuthType, ExternalExecutionProviderType, AIProviderConfig, DataSourceConfig, AuthConfig, ExternalExecutionProviderConfig } from '../types/ProviderTypes';

/**
 * Factory interface for creating providers
 */
export interface IProviderFactory {
  /**
   * Create AI provider instance
   */
  createAIProvider(type: AIProviderType, config: AIProviderConfig): IAIProvider;

  /**
   * Create data source provider instance
   */
  createDataSourceProvider(type: DataSourceType, config: DataSourceConfig): IDataSourceProvider;

  /**
   * Create authentication provider instance
   */
  createAuthProvider(type: AuthType, config: AuthConfig): IAuthenticationProvider;

  /**
   * Create external execution provider instance
   */
  createExternalExecutionProvider(type: ExternalExecutionProviderType, config: ExternalExecutionProviderConfig): IExternalExecutionProvider;

  /**
   * Get available AI provider types
   */
  getAvailableAIProviders(): AIProviderType[];

  /**
   * Get available data source provider types
   */
  getAvailableDataSourceProviders(): DataSourceType[];

  /**
   * Get available auth provider types
   */
  getAvailableAuthProviders(): AuthType[];

  /**
   * Get available external execution provider types
   */
  getAvailableExternalExecutionProviders(): ExternalExecutionProviderType[];

  /**
   * Check if AI provider is registered
   */
  isAIProviderRegistered(type: AIProviderType): boolean;

  /**
   * Check if data source provider is registered
   */
  isDataSourceProviderRegistered(type: DataSourceType): boolean;

  /**
   * Check if auth provider is registered
   */
  isAuthProviderRegistered(type: AuthType): boolean;

  /**
   * Check if external execution provider is registered
   */
  isExternalExecutionProviderRegistered(type: ExternalExecutionProviderType): boolean;
}