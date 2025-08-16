import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../types';
import { logger } from './logger';

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config', 'default.json');
const USER_CONFIG_PATH = path.join(process.env.HOME || '~', '.aidx', 'config.json');

export class ConfigManager {
  private config: Config | null = null;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      // ユーザー設定を優先して読み込み
      if (fs.existsSync(USER_CONFIG_PATH)) {
        const userConfig = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf-8'));
        this.config = userConfig;
        logger.info('Loaded user configuration from', USER_CONFIG_PATH);
        return;
      }

      // デフォルト設定を読み込み
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
}
