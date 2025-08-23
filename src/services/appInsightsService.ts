import axios, { AxiosInstance } from 'axios';
import { QueryResult } from '../types';
import { AuthService } from './authService';
import { ConfigManager } from '../utils/config';
import { logger } from '../utils/logger';
import { withLoadingIndicator } from '../utils/loadingIndicator';

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
    logger.info(`Executing KQL query:\n ${kqlQuery}`);
    
    return withLoadingIndicator(
      'Executing query on Application Insights...',
      async () => {
        const config = this.configManager.getConfig();
        const url = `/${config.appInsights.applicationId}/query`;

        const response = await this.httpClient.post(url, {
          query: kqlQuery,
        });

        return response.data;
      },
      {
        successMessage: 'Query executed successfully',
        errorMessage: 'Failed to execute query'
      }
    );
  }

  public async validateConnection(): Promise<boolean> {
    return withLoadingIndicator(
      'Validating Application Insights connection...',
      async () => {
        // Test connection with a simple query
        await this.httpClient.post(`/${this.configManager.getConfig().appInsights.applicationId}/query`, {
          query: 'requests | take 1',
        });
        return true;
      },
      {
        successMessage: 'Connection validated successfully',
        errorMessage: 'Connection validation failed'
      }
    ).catch(() => {
      logger.error('Application Insights connection validation failed');
      return false;
    });
  }

  public async getSchema(): Promise<any> {
    return withLoadingIndicator(
      'Retrieving Application Insights schema...',
      async () => {
        const config = this.configManager.getConfig();
        const url = `/${config.appInsights.applicationId}/metadata`;

        const response = await this.httpClient.get(url);
        return response.data;
      },
      {
        successMessage: 'Schema retrieved successfully',
        errorMessage: 'Failed to retrieve schema'
      }
    );
  }
}
