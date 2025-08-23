import { IAIProvider } from './IAIProvider';
import { IDataSourceProvider } from './IDataSourceProvider';
import { IAuthenticationProvider } from './IAuthenticationProvider';
import { AIProviderType, DataSourceType, AuthType, AIProviderConfig, DataSourceConfig, AuthConfig } from '../types/ProviderTypes';

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
}