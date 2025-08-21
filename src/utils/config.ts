import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types';
import { logger } from './logger';
import { ResourceGraphService } from '../services/resourceGraphService';

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

      // 設定ファイルが見つからない場合は環境変数から構築
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
        endpoint: process.env.AZURE_APPLICATION_INSIGHTS_ENDPOINT,
        subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
        resourceGroup: process.env.AZURE_RESOURCE_GROUP,
        resourceName: process.env.AZURE_RESOURCE_NAME,
        clusterId: process.env.AZURE_DATA_EXPLORER_CLUSTER_ID,
        databaseName: process.env.AZURE_DATA_EXPLORER_DATABASE_NAME || 'ApplicationInsights',
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

  public updateConfig(updates: Partial<Config>): void {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.config = { ...this.config, ...updates };
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
        tenantId: resourceInfo.tenantId || this.config.appInsights.tenantId,
        clusterId: resourceInfo.clusterId,
        databaseName: resourceInfo.databaseName || this.config.appInsights.databaseName,
      };

      // Save the enhanced configuration
      this.saveUserConfig();

      logger.info('Configuration auto-enhanced with resource information');
      logger.info(`Resource: ${resourceInfo.resourceName} in ${resourceInfo.resourceGroup} (${resourceInfo.subscriptionId})`);
      
      if (resourceInfo.clusterId) {
        logger.info(`Data Explorer cluster: ${resourceInfo.clusterId}`);
      }

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
