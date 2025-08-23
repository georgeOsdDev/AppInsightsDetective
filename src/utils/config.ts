import * as fs from 'fs';
import * as path from 'path';
import { Config, MultiProviderConfig } from '../types';
import { logger } from './logger';
import { ResourceGraphService } from '../services/resourceGraphService';

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config', 'default.json');
const USER_CONFIG_PATH = path.join(process.env.HOME || '~', '.aidx', 'config.json');
const LEGACY_CONFIG_BACKUP_PATH = path.join(process.env.HOME || '~', '.aidx', 'config.legacy.json');

export class ConfigManager {
  private config: Config | null = null;
  private multiProviderConfig: MultiProviderConfig | null = null;
  private resourceGraphService: ResourceGraphService;

  constructor() {
    this.resourceGraphService = new ResourceGraphService();
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      // Load user settings with priority
      if (fs.existsSync(USER_CONFIG_PATH)) {
        const userConfigContent = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf-8'));
        
        // Check if this is the new multi-provider format
        if (this.isMultiProviderConfig(userConfigContent)) {
          this.multiProviderConfig = userConfigContent;
          // Generate legacy config for backward compatibility
          this.config = this.convertToLegacyConfig(this.multiProviderConfig);
          logger.info('Loaded multi-provider configuration from', USER_CONFIG_PATH);
        } else {
          // This is legacy format - migrate it
          this.config = userConfigContent;
          if (this.config) {
            this.multiProviderConfig = this.migrateLegacyConfig(this.config);
            logger.info('Loaded legacy configuration and migrated to multi-provider format');
            // Save the migrated configuration
            this.saveMigratedConfig();
          }
        }
        return;
      }

      // Load default settings
      if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
        const defaultConfigContent = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8'));
        
        if (this.isMultiProviderConfig(defaultConfigContent)) {
          this.multiProviderConfig = defaultConfigContent;
          this.config = this.convertToLegacyConfig(this.multiProviderConfig);
          logger.info('Loaded default multi-provider configuration from', DEFAULT_CONFIG_PATH);
        } else {
          // Legacy default config
          this.config = defaultConfigContent;
          if (this.config) {
            this.multiProviderConfig = this.migrateLegacyConfig(this.config);
            logger.info('Loaded default legacy configuration');
          }
        }
        return;
      }

      // Build from environment variables (legacy format first)
      this.config = this.buildConfigFromEnv();
      if (this.config) {
        this.multiProviderConfig = this.migrateLegacyConfig(this.config);
      }
      logger.info('Built configuration from environment variables');
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw new Error('Configuration could not be loaded');
    }
  }

  /**
   * Check if configuration is in the new multi-provider format
   */
  private isMultiProviderConfig(configData: any): configData is MultiProviderConfig {
    return configData && 
           configData.providers && 
           typeof configData.providers === 'object' &&
           configData.providers.ai && 
           configData.providers.dataSources;
  }

  /**
   * Convert multi-provider config to legacy format for backward compatibility
   */
  private convertToLegacyConfig(multiConfig: MultiProviderConfig): Config {
    // Get default providers
    const defaultAI = multiConfig.providers.ai.default || 'azure-openai';
    const defaultDataSource = multiConfig.providers.dataSources.default || 'application-insights';
    
    // Extract settings for default providers
    const aiConfig = multiConfig.providers.ai[defaultAI] || {};
    const dataSourceConfig = multiConfig.providers.dataSources[defaultDataSource] || {};
    
    return {
      appInsights: {
        applicationId: dataSourceConfig.applicationId || '',
        tenantId: dataSourceConfig.tenantId || '',
        endpoint: dataSourceConfig.endpoint,
        subscriptionId: dataSourceConfig.subscriptionId,
        resourceGroup: dataSourceConfig.resourceGroup,
        resourceName: dataSourceConfig.resourceName,
      },
      openAI: {
        endpoint: aiConfig.endpoint || '',
        apiKey: aiConfig.apiKey,
        deploymentName: aiConfig.deploymentName || 'gpt-4',
      },
      logLevel: multiConfig.logLevel || 'info',
      language: multiConfig.language,
    };
  }

  /**
   * Migrate legacy configuration to multi-provider format
   */
  private migrateLegacyConfig(legacyConfig: Config): MultiProviderConfig {
    return {
      providers: {
        ai: {
          default: 'azure-openai',
          'azure-openai': {
            type: 'azure-openai',
            endpoint: legacyConfig.openAI.endpoint,
            apiKey: legacyConfig.openAI.apiKey,
            deploymentName: legacyConfig.openAI.deploymentName || 'gpt-4',
          },
        },
        dataSources: {
          default: 'application-insights',
          'application-insights': {
            type: 'application-insights',
            applicationId: legacyConfig.appInsights.applicationId,
            tenantId: legacyConfig.appInsights.tenantId,
            endpoint: legacyConfig.appInsights.endpoint,
            subscriptionId: legacyConfig.appInsights.subscriptionId,
            resourceGroup: legacyConfig.appInsights.resourceGroup,
            resourceName: legacyConfig.appInsights.resourceName,
          },
        },
        auth: {
          default: 'azure-managed-identity',
          'azure-managed-identity': {
            type: 'azure-managed-identity',
            tenantId: legacyConfig.appInsights.tenantId,
          },
        },
      },
      logLevel: legacyConfig.logLevel || 'info',
      language: legacyConfig.language,
      fallbackBehavior: {
        enableProviderFallback: true,
        aiProviderOrder: ['azure-openai'],
        dataSourceProviderOrder: ['application-insights'],
      },
    };
  }

  /**
   * Save migrated configuration and backup legacy version
   */
  private saveMigratedConfig(): void {
    if (!this.config || !this.multiProviderConfig) {
      return;
    }

    try {
      const configDir = path.dirname(USER_CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Backup the legacy config
      fs.copyFileSync(USER_CONFIG_PATH, LEGACY_CONFIG_BACKUP_PATH);
      logger.info('Backed up legacy configuration to', LEGACY_CONFIG_BACKUP_PATH);

      // Save the new multi-provider configuration
      fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(this.multiProviderConfig, null, 2));
      logger.info('Migrated to multi-provider configuration format');
    } catch (error) {
      logger.error('Failed to save migrated configuration:', error);
      throw new Error('Failed to save migrated configuration');
    }
  }

  private buildConfigFromEnv(): Config {
    return {
      appInsights: {
        applicationId: process.env.AZURE_APPLICATION_INSIGHTS_ID || '',
        tenantId: process.env.AZURE_TENANT_ID || '',
        endpoint: process.env.AZURE_APPLICATION_INSIGHTS_ENDPOINT,
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
        resourceGroup: process.env.AZURE_RESOURCE_GROUP,
        resourceName: process.env.AZURE_RESOURCE_NAME
      },
      openAI: {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
      },
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
    };
  }

  public getConfig(): Config {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  /**
   * Get the multi-provider configuration
   */
  public getMultiProviderConfig(): MultiProviderConfig {
    if (!this.multiProviderConfig) {
      throw new Error('Multi-provider configuration not loaded');
    }
    return this.multiProviderConfig;
  }

  /**
   * Check if multi-provider configuration is available
   */
  public hasMultiProviderConfig(): boolean {
    return this.multiProviderConfig !== null;
  }

  /**
   * Update legacy configuration (for backward compatibility)
   */

  /**
   * Update legacy configuration (for backward compatibility)
   */
  public updateConfig(updates: Partial<Config>): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config = { ...this.config, ...updates };
    
    // Also update the multi-provider config to keep them in sync
    if (this.multiProviderConfig) {
      this.multiProviderConfig = this.migrateLegacyConfig(this.config);
    }
    
    this.saveUserConfig();
  }

  /**
   * Update multi-provider configuration
   */
  public updateMultiProviderConfig(updates: Partial<MultiProviderConfig>): void {
    if (!this.multiProviderConfig) {
      throw new Error('Multi-provider configuration not loaded');
    }

    this.multiProviderConfig = { ...this.multiProviderConfig, ...updates };
    
    // Update legacy config for backward compatibility
    this.config = this.convertToLegacyConfig(this.multiProviderConfig);
    
    this.saveUserConfig();
  }

  /**
   * Set default provider for a specific type
   */
  public setDefaultProvider(providerType: 'ai' | 'dataSources' | 'auth', providerId: string): void {
    if (!this.multiProviderConfig) {
      throw new Error('Multi-provider configuration not loaded');
    }

    this.multiProviderConfig.providers[providerType].default = providerId;
    
    // Update legacy config for backward compatibility
    this.config = this.convertToLegacyConfig(this.multiProviderConfig);
    
    this.saveUserConfig();
  }

  /**
   * Add or update a provider configuration
   */
  public updateProviderConfig(providerType: 'ai' | 'dataSources' | 'auth', providerId: string, config: any): void {
    if (!this.multiProviderConfig) {
      throw new Error('Multi-provider configuration not loaded');
    }

    this.multiProviderConfig.providers[providerType][providerId] = { ...config, type: providerId };
    
    // Update legacy config for backward compatibility if this is the default provider
    if (this.multiProviderConfig.providers[providerType].default === providerId) {
      this.config = this.convertToLegacyConfig(this.multiProviderConfig);
    }
    
    this.saveUserConfig();
  }

  private saveUserConfig(): void {
    try {
      const configDir = path.dirname(USER_CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Save the multi-provider config if available, otherwise save legacy config
      const configToSave = this.multiProviderConfig || this.config;
      fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(configToSave, null, 2));
      logger.info('Saved user configuration to', USER_CONFIG_PATH);
    } catch (error) {
      logger.error('Failed to save user configuration:', error);
      throw new Error('Failed to save configuration');
    }
  }

  public validateConfig(): boolean {
    // Try to validate multi-provider config first, then fall back to legacy
    if (this.multiProviderConfig) {
      return this.validateMultiProviderConfig();
    }
    
    if (!this.config) {
      return false;
    }

    const { appInsights, openAI } = this.config;

    if (!appInsights.applicationId || !appInsights.tenantId) {
      logger.error('Application Insights configuration is incomplete');
      return false;
    }

    if (!openAI.endpoint) {
      logger.error('OpenAI configuration is incomplete');
      return false;
    }

    return true;
  }

  /**
   * Validate multi-provider configuration
   */
  public validateMultiProviderConfig(): boolean {
    if (!this.multiProviderConfig) {
      return false;
    }

    const { providers } = this.multiProviderConfig;

    // Check if default providers are specified
    if (!providers.ai.default || !providers.dataSources.default || !providers.auth.default) {
      logger.error('Default providers not specified in multi-provider configuration');
      return false;
    }

    // Validate default AI provider configuration
    const defaultAI = providers.ai[providers.ai.default];
    if (!defaultAI || !defaultAI.endpoint) {
      logger.error(`Default AI provider '${providers.ai.default}' configuration is incomplete`);
      return false;
    }

    // Validate default data source provider configuration
    const defaultDataSource = providers.dataSources[providers.dataSources.default];
    if (!defaultDataSource || !defaultDataSource.applicationId || !defaultDataSource.tenantId) {
      logger.error(`Default data source provider '${providers.dataSources.default}' configuration is incomplete`);
      return false;
    }

    // Validate default auth provider configuration
    const defaultAuth = providers.auth[providers.auth.default];
    if (!defaultAuth || !defaultAuth.tenantId) {
      logger.error(`Default auth provider '${providers.auth.default}' configuration is incomplete`);
      return false;
    }

    return true;
  }

  /**
   * Get list of available providers
   */
  public getAvailableProviders(providerType: 'ai' | 'dataSources' | 'auth'): string[] {
    if (!this.multiProviderConfig) {
      // Return default providers for legacy config
      switch (providerType) {
        case 'ai':
          return ['azure-openai'];
        case 'dataSources':
          return ['application-insights'];
        case 'auth':
          return ['azure-managed-identity'];
        default:
          return [];
      }
    }

    const providers = this.multiProviderConfig.providers[providerType];
    return Object.keys(providers).filter(key => key !== 'default');
  }

  /**
   * Get default provider for a specific type
   */
  public getDefaultProvider(providerType: 'ai' | 'dataSources' | 'auth'): string {
    if (!this.multiProviderConfig) {
      // Return default providers for legacy config
      switch (providerType) {
        case 'ai':
          return 'azure-openai';
        case 'dataSources':
          return 'application-insights';
        case 'auth':
          return 'azure-managed-identity';
        default:
          return '';
      }
    }

    return this.multiProviderConfig.providers[providerType].default;
  }

  /**
   * Get configuration for a specific provider
   */
  public getProviderConfig(providerType: 'ai' | 'dataSources' | 'auth', providerId: string): any {
    if (!this.multiProviderConfig) {
      // Fall back to legacy config
      return this.convertToProviderConfig(providerType, providerId);
    }

    return this.multiProviderConfig.providers[providerType][providerId];
  }

  /**
   * Convert legacy config to provider-specific config
   */
  private convertToProviderConfig(providerType: 'ai' | 'dataSources' | 'auth', providerId: string): any {
    if (!this.config) return null;

    switch (providerType) {
      case 'ai':
        if (providerId === 'azure-openai') {
          return {
            type: 'azure-openai',
            endpoint: this.config.openAI.endpoint,
            apiKey: this.config.openAI.apiKey,
            deploymentName: this.config.openAI.deploymentName || 'gpt-4',
          };
        }
        break;
      case 'dataSources':
        if (providerId === 'application-insights') {
          return {
            type: 'application-insights',
            applicationId: this.config.appInsights.applicationId,
            tenantId: this.config.appInsights.tenantId,
            endpoint: this.config.appInsights.endpoint,
            subscriptionId: this.config.appInsights.subscriptionId,
            resourceGroup: this.config.appInsights.resourceGroup,
            resourceName: this.config.appInsights.resourceName,
          };
        }
        break;
      case 'auth':
        if (providerId === 'azure-managed-identity') {
          return {
            type: 'azure-managed-identity',
            tenantId: this.config.appInsights.tenantId,
          };
        }
        break;
    }

    return null;
  }

  /**
   * Auto-enhance configuration by fetching resource information from Azure Resource Graph
   */
  public async autoEnhanceConfig(): Promise<boolean> {
    if (!this.config?.appInsights.applicationId) {
      logger.debug('No Application ID configured, skipping auto-enhancement');
      return false;
    }

    // Skip if resource info is already complete
    if (this.config.appInsights.subscriptionId && 
        this.config.appInsights.resourceGroup && 
        this.config.appInsights.resourceName) {
      logger.debug('Resource information already configured, skipping auto-enhancement');
      return true;
    }

    try {
      logger.info('Auto-enhancing configuration with Azure Resource Graph...');
      
      const resourceInfo = await this.resourceGraphService.getResourceInfo(
        this.config.appInsights.applicationId
      );

      if (!resourceInfo) {
        logger.warn('Could not find Application Insights resource in Azure Resource Graph');
        return false;
      }

      // Update configuration with discovered resource information
      this.config.appInsights = {
        ...this.config.appInsights,
        subscriptionId: resourceInfo.subscriptionId,
        resourceGroup: resourceInfo.resourceGroup,
        resourceName: resourceInfo.resourceName,
        tenantId: resourceInfo.tenantId || this.config.appInsights.tenantId
      };

      // Save the enhanced configuration
      this.saveUserConfig();

      logger.info('Configuration auto-enhanced with resource information');
      logger.info(`Resource: ${resourceInfo.resourceName} in ${resourceInfo.resourceGroup} (${resourceInfo.subscriptionId})`);

      return true;

    } catch (error) {
      logger.warn('Failed to auto-enhance configuration:', error);
      return false;
    }
  }

  /**
   * Get configuration with auto-enhancement if needed
   */
  public async getEnhancedConfig(): Promise<Config> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    // Try to auto-enhance if resource info is missing
    if (this.config.appInsights.applicationId && 
        (!this.config.appInsights.subscriptionId || 
         !this.config.appInsights.resourceGroup || 
         !this.config.appInsights.resourceName)) {
      await this.autoEnhanceConfig();
    }

    return this.config;
  }
}
