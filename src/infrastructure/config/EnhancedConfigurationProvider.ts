import * as fs from 'fs';
import * as path from 'path';
import { 
  IConfigurationProvider, 
  EnhancedConfiguration, 
  ProviderConfiguration 
} from '../../core/interfaces/IConfigurationProvider';
import { Config } from '../../types';
import { logger } from '../../utils/logger';
import { ResourceGraphService } from '../../services/resourceGraphService';

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config', 'default.json');
const USER_CONFIG_PATH = path.join(process.env.HOME || '~', '.aidx', 'config.json');

/**
 * Enhanced configuration provider that supports multiple providers and resource discovery
 */
export class EnhancedConfigurationProvider implements IConfigurationProvider {
  private config: Config | null = null;
  private enhancedConfig: EnhancedConfiguration | null = null;
  private resourceGraphService: ResourceGraphService;

  constructor() {
    this.resourceGraphService = new ResourceGraphService();
    this.loadConfiguration();
  }

  getConfiguration(): Config {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  async getEnhancedConfiguration(): Promise<EnhancedConfiguration> {
    if (!this.enhancedConfig) {
      await this.buildEnhancedConfiguration();
    }
    return this.enhancedConfig!;
  }

  async updateConfiguration(configUpdate: Partial<Config>): Promise<void> {
    try {
      if (!this.config) {
        throw new Error('Configuration not loaded');
      }

      // Merge with existing config
      this.config = { ...this.config, ...configUpdate };

      // Save to user config file
      const userConfigDir = path.dirname(USER_CONFIG_PATH);
      if (!fs.existsSync(userConfigDir)) {
        fs.mkdirSync(userConfigDir, { recursive: true });
      }

      fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info('Configuration updated and saved to', USER_CONFIG_PATH);

      // Invalidate enhanced config cache
      this.enhancedConfig = null;
    } catch (error) {
      logger.error('Failed to update configuration:', error);
      throw error;
    }
  }

  async validateConfiguration(config: Config): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!config.appInsights?.applicationId) {
      errors.push('Application Insights Application ID is required');
    }

    if (!config.openAI?.endpoint) {
      errors.push('OpenAI endpoint is required');
    }

    if (!config.openAI?.deploymentName) {
      errors.push('OpenAI deployment name is required');
    }

    // Validate optional but recommended fields
    if (!config.appInsights?.tenantId) {
      warnings.push('Tenant ID is recommended for enhanced functionality');
    }

    if (!config.openAI?.apiKey) {
      warnings.push('Using Managed Identity - ensure proper RBAC permissions are configured');
    }

    // Validate provider configurations if present
    if (config.language && !['auto', 'en', 'ja', 'es', 'fr', 'de'].includes(config.language)) {
      warnings.push(`Unsupported language '${config.language}', falling back to 'auto'`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getProviderConfiguration(
    providerType: 'ai' | 'dataSources',
    providerId: string
  ): ProviderConfiguration | null {
    if (!this.enhancedConfig?.providers) {
      return null;
    }

    const providers = this.enhancedConfig.providers[providerType];
    return providers?.[providerId] || null;
  }

  private loadConfiguration(): void {
    try {
      // Load user settings with priority
      if (fs.existsSync(USER_CONFIG_PATH)) {
        const userConfig = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf-8'));
        this.config = userConfig;
        logger.info('Loaded user configuration from', USER_CONFIG_PATH);
        return;
      }

      // Load default settings
      if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
        const defaultConfig = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8'));
        this.config = defaultConfig;
        logger.info('Loaded default configuration from', DEFAULT_CONFIG_PATH);
        return;
      }

      // Build from environment variables
      this.config = this.buildConfigFromEnv();
      logger.info('Built configuration from environment variables');
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw new Error('Configuration could not be loaded');
    }
  }

  private buildConfigFromEnv(): Config {
    return {
      appInsights: {
        applicationId: process.env.AZURE_APPLICATION_INSIGHTS_ID || '',
        tenantId: process.env.AZURE_TENANT_ID || '',
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
        resourceGroup: process.env.AZURE_RESOURCE_GROUP || '',
        resourceName: process.env.AZURE_APPLICATION_INSIGHTS_NAME || ''
      },
      openAI: {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4'
      },
      logLevel: (process.env.AIDX_LOG_LEVEL as any) || 'info',
      language: (process.env.AIDX_LANGUAGE as any) || 'auto'
    };
  }

  private async buildEnhancedConfiguration(): Promise<void> {
    try {
      const baseConfig = this.getConfiguration();
      
      // Start with base configuration
      this.enhancedConfig = {
        ...baseConfig,
        providers: {
          ai: {
            'azure-openai': {
              type: 'azure-openai',
              config: {
                endpoint: baseConfig.openAI.endpoint,
                apiKey: baseConfig.openAI.apiKey,
                deploymentName: baseConfig.openAI.deploymentName,
                apiVersion: '2024-02-15-preview'
              }
            }
          },
          dataSources: {
            'application-insights': {
              type: 'application-insights',
              config: {
                applicationId: baseConfig.appInsights.applicationId,
                tenantId: baseConfig.appInsights.tenantId,
                subscriptionId: baseConfig.appInsights.subscriptionId,
                resourceGroup: baseConfig.appInsights.resourceGroup,
                resourceName: baseConfig.appInsights.resourceName
              }
            }
          }
        }
      };

      // Enhance with resource discovery if possible
      await this.enhanceWithResourceDiscovery();

      logger.debug('Enhanced configuration built successfully');
    } catch (error) {
      logger.error('Failed to build enhanced configuration:', error);
      throw error;
    }
  }

  private async enhanceWithResourceDiscovery(): Promise<void> {
    try {
      const baseConfig = this.getConfiguration();
      
      // Auto-discover Application Insights resource information
      if (baseConfig.appInsights.applicationId && 
          (!baseConfig.appInsights.subscriptionId || !baseConfig.appInsights.resourceGroup)) {
        
        logger.info('Auto-discovering Application Insights resource information...');
        
        const resourceInfo = await this.resourceGraphService.findApplicationInsightsResource(
          baseConfig.appInsights.applicationId
        );

        if (resourceInfo) {
          // Update the enhanced configuration with discovered information
          const appInsightsProvider = this.enhancedConfig!.providers!.dataSources!['application-insights'];
          appInsightsProvider.config = {
            ...appInsightsProvider.config,
            tenantId: resourceInfo.tenantId,
            subscriptionId: resourceInfo.subscriptionId,
            resourceGroup: resourceInfo.resourceGroup,
            resourceName: resourceInfo.name
          };

          logger.info('Enhanced configuration with auto-discovered resource information');
        }
      }
    } catch (error) {
      logger.warn('Resource discovery failed, using configuration as-is:', error);
      // Don't throw - enhancement is optional
    }
  }

  /**
   * Get provider-specific configuration for AI providers
   */
  getAIProviderConfig(providerId: string = 'azure-openai'): any {
    const providerConfig = this.getProviderConfiguration('ai', providerId);
    return providerConfig?.config || null;
  }

  /**
   * Get provider-specific configuration for data source providers
   */
  getDataSourceProviderConfig(providerId: string = 'application-insights'): any {
    const providerConfig = this.getProviderConfiguration('dataSources', providerId);
    return providerConfig?.config || null;
  }

  /**
   * Create a new provider configuration
   */
  async addProviderConfiguration(
    providerType: 'ai' | 'dataSources',
    providerId: string,
    configuration: ProviderConfiguration
  ): Promise<void> {
    const enhancedConfig = await this.getEnhancedConfiguration();
    
    if (!enhancedConfig.providers) {
      enhancedConfig.providers = { ai: {}, dataSources: {} };
    }

    if (!enhancedConfig.providers[providerType]) {
      enhancedConfig.providers[providerType] = {};
    }

    enhancedConfig.providers[providerType]![providerId] = configuration;
    
    // Save updated configuration
    await this.updateConfiguration(enhancedConfig);
  }
}