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
    const defaultAI = providers.ai[providers.ai.default];
    if (!defaultAI) {
      logger.error(`Default AI provider '${providers.ai.default}' configuration is missing`);
      return false;
    }

    const aiValidation = ProviderConfigValidator.validateAIProviderConfig(defaultAI);
    if (!aiValidation.isValid) {
      logger.error(`Default AI provider '${providers.ai.default}' configuration is incomplete: ${aiValidation.errors.join(', ')}`);
      return false;
    }

    // Validate default data source provider configuration
    const defaultDataSource = providers.dataSources[providers.dataSources.default];
    if (!defaultDataSource) {
      logger.error(`Default data source provider '${providers.dataSources.default}' configuration is missing`);
      return false;
    }

    const dataSourceValidation = ProviderConfigValidator.validateDataSourceConfig(defaultDataSource);
    if (!dataSourceValidation.isValid) {
      logger.error(`Default data source provider '${providers.dataSources.default}' configuration is incomplete: ${dataSourceValidation.errors.join(', ')}`);
      return false;
    }

    // Validate default auth provider configuration
    const defaultAuth = providers.auth[providers.auth.default];
    if (!defaultAuth) {
      logger.error(`Default auth provider '${providers.auth.default}' configuration is missing`);
      return false;
    }

    const authValidation = ProviderConfigValidator.validateAuthConfig(defaultAuth);
    if (!authValidation.isValid) {
      logger.error(`Default auth provider '${providers.auth.default}' configuration is incomplete: ${authValidation.errors.join(', ')}`);
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
    
    if (!dataSourceConfig?.applicationId) {
      logger.debug('No Application ID configured, skipping auto-enhancement');
      return false;
    }

    // Skip if resource info is already complete
    if (dataSourceConfig.subscriptionId && 
        dataSourceConfig.resourceGroup && 
        dataSourceConfig.resourceName) {
      logger.debug('Resource information already configured, skipping auto-enhancement');
      return true;
    }

    try {
      logger.info('Auto-enhancing configuration with Azure Resource Graph...');
      
      const resourceInfo = await this.resourceGraphService.getResourceInfo(
        dataSourceConfig.applicationId
      );

      if (!resourceInfo) {
        logger.warn('Could not find Application Insights resource in Azure Resource Graph');
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
    if (dataSourceConfig?.applicationId && 
        (!dataSourceConfig.subscriptionId || 
         !dataSourceConfig.resourceGroup || 
         !dataSourceConfig.resourceName)) {
      await this.autoEnhanceConfig();
    }

    return this.config;
  }
}
