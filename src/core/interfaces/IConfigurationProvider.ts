import { Config } from '../../types';

export interface ProviderConfiguration {
  type: string;
  config: Record<string, any>;
}

export interface EnhancedConfiguration extends Config {
  providers?: {
    ai?: Record<string, ProviderConfiguration>;
    dataSources?: Record<string, ProviderConfiguration>;
  };
}

/**
 * Interface for configuration management
 */
export interface IConfigurationProvider {
  /**
   * Get current configuration
   */
  getConfiguration(): Config;

  /**
   * Get enhanced configuration with provider information
   */
  getEnhancedConfiguration(): Promise<EnhancedConfiguration>;

  /**
   * Update configuration
   */
  updateConfiguration(config: Partial<Config>): Promise<void>;

  /**
   * Validate configuration
   */
  validateConfiguration(config: Config): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>;

  /**
   * Get provider configuration
   */
  getProviderConfiguration(
    providerType: 'ai' | 'dataSources',
    providerId: string
  ): ProviderConfiguration | null;
}