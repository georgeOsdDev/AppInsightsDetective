import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types';
import { logger, updateLoggerLevel } from './logger';
import { ResourceGraphService } from '../services/resourceGraphService';
import { ProviderConfigValidator } from './providerValidation';

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config', 'default.json');
const USER_CONFIG_PATH = path.join(process.env.HOME || '~', '.aidx', 'config.json');

export class ConfigManager {
  private config: Config | null = null;
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
        this.config = userConfigContent;
        this.updateLoggerLevelFromConfig();
        logger.info('Loaded user configuration from', USER_CONFIG_PATH);
        return;
      }

      // Load default settings
      if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
        const defaultConfigContent = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8'));
        this.config = defaultConfigContent;
        this.updateLoggerLevelFromConfig();
        logger.info('Loaded default configuration from', DEFAULT_CONFIG_PATH);
        return;
      }

      // Build from environment variables
      this.config = this.buildConfigFromEnv();
      this.updateLoggerLevelFromConfig();
      logger.info('Built configuration from environment variables');
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw new Error('Configuration could not be loaded');
    }
  }

  /**
   * Update logger level based on configuration
   */
  private updateLoggerLevelFromConfig(): void {
    if (this.config?.logLevel) {
      updateLoggerLevel(this.config.logLevel);
    }
  }

  private buildConfigFromEnv(): Config {
    return {
      providers: {
        ai: {
          default: 'azure-openai',
          'azure-openai': {
            type: 'azure-openai',
            endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
            deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
          },
        },
        dataSources: {
          default: 'application-insights',
          'application-insights': {
            type: 'application-insights',
            applicationId: process.env.AZURE_APPLICATION_INSIGHTS_ID || '',
            tenantId: process.env.AZURE_TENANT_ID || '',
            endpoint: process.env.AZURE_APPLICATION_INSIGHTS_ENDPOINT,
            subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
            resourceGroup: process.env.AZURE_RESOURCE_GROUP,
            resourceName: process.env.AZURE_RESOURCE_NAME,
          },
        },
        auth: {
          default: 'azure-managed-identity',
          'azure-managed-identity': {
            type: 'azure-managed-identity',
            tenantId: process.env.AZURE_TENANT_ID || '',
          },
        },
      },
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      fallbackBehavior: {
        enableProviderFallback: true,
        aiProviderOrder: ['azure-openai'],
        dataSourceProviderOrder: ['application-insights'],
      },
    };
  }

  public getConfig(): Config {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<Config>): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config = { ...this.config, ...updates };
    this.saveUserConfig();
  }

  /**
   * Set default provider for a specific type
   */
  public setDefaultProvider(providerType: 'ai' | 'dataSources' | 'auth', providerId: string): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config.providers[providerType].default = providerId;
    this.saveUserConfig();
  }

  /**
   * Add or update a provider configuration
   */
  public updateProviderConfig(providerType: 'ai' | 'dataSources' | 'auth', providerId: string, config: any): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config.providers[providerType][providerId] = { ...config, type: providerId };
    this.saveUserConfig();
  }

  private saveUserConfig(): void {
    try {
      const configDir = path.dirname(USER_CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(this.config, null, 2));
      logger.info('Saved user configuration to', USER_CONFIG_PATH);
    } catch (error) {
      logger.error('Failed to save user configuration:', error);
      throw new Error('Failed to save configuration');
    }
  }

  public validateConfig(): boolean {
    if (!this.config) {
      return false;
    }

    const { providers } = this.config;

    // Check if default providers are specified
    if (!providers.ai.default || !providers.dataSources.default || !providers.auth.default) {
      logger.error('Default providers not specified in configuration');
      return false;
    }

    // Validate default AI provider configuration
    const defaultAIKey = providers.ai.default;
    const defaultAI = providers.ai[defaultAIKey];
    if (!defaultAI) {
      logger.error(`Default AI provider '${defaultAIKey}' configuration is missing`);
      return false;
    }

    const aiValidation = ProviderConfigValidator.validateAIProviderConfig(defaultAI);
    if (!aiValidation.isValid) {
      logger.error(`Default AI provider '${defaultAIKey}' configuration is incomplete: ${aiValidation.errors.join(', ')}`);
      return false;
    }

    // Validate default data source provider configuration
    const defaultDataSourceKey = providers.dataSources.default;
    const defaultDataSource = providers.dataSources[defaultDataSourceKey];
    if (!defaultDataSource) {
      logger.error(`Default data source provider '${defaultDataSourceKey}' configuration is missing`);
      return false;
    }

    const dataSourceValidation = ProviderConfigValidator.validateDataSourceConfig(defaultDataSource);
    if (!dataSourceValidation.isValid) {
      logger.error(`Default data source provider '${defaultDataSourceKey}' configuration is incomplete: ${dataSourceValidation.errors.join(', ')}`);
      return false;
    }

    // Check for required fields based on data source type
    if (defaultDataSource.type === 'application-insights') {
      if (!defaultDataSource.applicationId) {
        logger.error(`Default data source provider '${providers.dataSources.default}' configuration is incomplete`);
        return false;
      }
    } else if (defaultDataSource.type === 'log-analytics') {
      if (!defaultDataSource.workspaceId) {
        logger.error(`Default data source provider '${providers.dataSources.default}' configuration is incomplete`);
        return false;
      }
    } else if (defaultDataSource.type === 'azure-data-explorer') {
      if (!defaultDataSource.clusterUri) {
        logger.error(`Default data source provider '${providers.dataSources.default}' configuration is incomplete: clusterUri is required`);
        return false;
      }
      if (!defaultDataSource.database) {
        logger.error(`Default data source provider '${providers.dataSources.default}' configuration is incomplete: database is required`);
        return false;
      }
    } else {
      logger.error(`Unknown data source provider type: '${defaultDataSource.type}'`);
      return false;
    }

    // Validate default auth provider configuration
    const defaultAuthKey = providers.auth.default;
    const defaultAuth = providers.auth[defaultAuthKey];
    if (!defaultAuth) {
      logger.error(`Default auth provider '${defaultAuthKey}' configuration is missing`);
      return false;
    }

    const authValidation = ProviderConfigValidator.validateAuthConfig(defaultAuth);
    if (!authValidation.isValid) {
      logger.error(`Default auth provider '${defaultAuthKey}' configuration is incomplete: ${authValidation.errors.join(', ')}`);
      return false;
    }

    return true;
  }

  /**
   * Get list of available providers
   */
  public getAvailableProviders(providerType: 'ai' | 'dataSources' | 'auth'): string[] {
    if (!this.config) {
      return [];
    }

    const providers = this.config.providers[providerType];
    return Object.keys(providers).filter(key => key !== 'default');
  }

  /**
   * Get default provider for a specific type
   */
  public getDefaultProvider(providerType: 'ai' | 'dataSources' | 'auth'): string {
    if (!this.config) {
      return '';
    }

    return this.config.providers[providerType].default;
  }

  /**
   * Get configuration for a specific provider
   */
  public getProviderConfig(providerType: 'ai' | 'dataSources' | 'auth', providerId: string): any {
    if (!this.config) {
      return null;
    }

    return this.config.providers[providerType][providerId];
  }

  /**
   * Auto-enhance configuration by fetching resource information from Azure Resource Graph
   */
  public async autoEnhanceConfig(): Promise<boolean> {
    if (!this.config) {
      logger.debug('No configuration loaded, skipping auto-enhancement');
      return false;
    }

    const defaultDataSource = this.config.providers.dataSources.default;
    const dataSourceConfig = this.config.providers.dataSources[defaultDataSource];
    
    // Skip if resource info is already complete
    if (dataSourceConfig.subscriptionId && 
        dataSourceConfig.resourceGroup && 
        dataSourceConfig.resourceName) {
      logger.debug('Resource information already configured, skipping auto-enhancement');
      return true;
    }

    try {
      logger.info('Auto-enhancing configuration with Azure Resource Graph...');
      
      let resourceInfo = null;

      if (dataSourceConfig?.applicationId && dataSourceConfig?.type === 'application-insights') {
        // Application Insights auto-enhancement
        resourceInfo = await this.resourceGraphService.getResourceInfo(
          dataSourceConfig.applicationId
        );
      } else if (dataSourceConfig?.workspaceId && dataSourceConfig?.type === 'log-analytics') {
        // Log Analytics auto-enhancement
        resourceInfo = await this.resourceGraphService.getLogAnalyticsResourceInfo(
          dataSourceConfig.workspaceId
        );
      } else {
        logger.debug('No suitable data source configuration found for auto-enhancement');
        return false;
      }

      if (!resourceInfo) {
        logger.warn('Could not find resource in Azure Resource Graph');
        return false;
      }

      // Update configuration with discovered resource information
      this.config.providers.dataSources[defaultDataSource] = {
        ...dataSourceConfig,
        subscriptionId: resourceInfo.subscriptionId,
        resourceGroup: resourceInfo.resourceGroup,
        resourceName: resourceInfo.resourceName,
        tenantId: resourceInfo.tenantId || dataSourceConfig.tenantId
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

    const defaultDataSource = this.config.providers.dataSources.default;
    const dataSourceConfig = this.config.providers.dataSources[defaultDataSource];

    // Try to auto-enhance if resource info is missing
    if ((dataSourceConfig?.applicationId && dataSourceConfig?.type === 'application-insights' &&
        (!dataSourceConfig.subscriptionId || 
         !dataSourceConfig.resourceGroup || 
         !dataSourceConfig.resourceName)) ||
        (dataSourceConfig?.workspaceId && dataSourceConfig?.type === 'log-analytics' &&
        (!dataSourceConfig.subscriptionId || 
         !dataSourceConfig.resourceGroup || 
         !dataSourceConfig.resourceName))) {
      await this.autoEnhanceConfig();
    }

    return this.config;
  }
}
