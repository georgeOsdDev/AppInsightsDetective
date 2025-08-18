import axios, { AxiosInstance } from 'axios';
import { QueryResult } from '../types';
import { AuthService } from './authService';
import { ConfigManager } from '../utils/config';
import { logger } from '../utils/logger';

export class AppInsightsService {
  private httpClient: AxiosInstance;
  private authService: AuthService;
  private configManager: ConfigManager;

  constructor(authService: AuthService, configManager: ConfigManager) {
    this.authService = authService;
    this.configManager = configManager;

    const config = this.configManager.getConfig();
    const baseURL = config.appInsights.endpoint || 'https://api.applicationinsights.io/v1/apps';

    this.httpClient = axios.create({
      baseURL,
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(async (config) => {
      try {
        const token = await this.authService.getAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      } catch (error) {
        logger.error('Failed to add auth token to request:', error);
        throw error;
      }
    });

    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Application Insights API error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  public async executeQuery(kqlQuery: string): Promise<QueryResult> {
    try {
      const config = this.configManager.getConfig();
      const url = `/${config.appInsights.applicationId}/query`;

      logger.info(`Executing KQL query: ${kqlQuery}`);

      const response = await this.httpClient.post(url, {
        query: kqlQuery,
      });

      logger.info('Query executed successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to execute query:', error);
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  public async validateConnection(): Promise<boolean> {
    try {
      // Test connection with a simple query
      await this.executeQuery('requests | take 1');
      logger.info('Application Insights connection validated successfully');
      return true;
    } catch (error) {
      logger.error('Application Insights connection validation failed:', error);
      return false;
    }
  }

  public async getSchema(): Promise<any> {
    try {
      const config = this.configManager.getConfig();
      const url = `/${config.appInsights.applicationId}/metadata`;

      const response = await this.httpClient.get(url);
      logger.info('Schema retrieved successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to retrieve schema:', error);
      throw new Error(`Schema retrieval failed: ${error}`);
    }
  }
}
