import axios, { AxiosInstance } from 'axios';
import { QueryResult } from '../types';
import { AuthService } from './authService';
import { ConfigManager } from '../utils/config';
import { logger } from '../utils/logger';
import { withLoadingIndicator } from '../utils/loadingIndicator';
import { IDataSourceProvider } from '../core/interfaces/IDataSourceProvider';

/**
 * Legacy AppInsightsService that now delegates to the provider architecture
 * @deprecated Use IDataSourceProvider directly from dependency injection
 */
export class AppInsightsService {
  private dataSourceProvider: IDataSourceProvider | null = null;
  private httpClient: AxiosInstance;
  private authService: AuthService;
  private configManager: ConfigManager;

  constructor(authService: AuthService, configManager: ConfigManager) {
    this.authService = authService;
    this.configManager = configManager;

    this.initializeProvider();
    
    // Keep fallback HTTP client for backward compatibility
    const defaultDataSource = this.configManager.getDefaultProvider('dataSources');
    const dataSourceConfig = this.configManager.getProviderConfig('dataSources', defaultDataSource);
    
    if (!dataSourceConfig) {
      throw new Error(`Data source provider '${defaultDataSource}' configuration not found`);
    }
    
    const baseURL = dataSourceConfig.endpoint || 'https://api.applicationinsights.io/v1/apps';

    this.httpClient = axios.create({
      baseURL,
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private initializeProvider(): void {
    try {
      // Get the data source provider configuration
      const config = this.configManager.getConfig();
      const defaultDataSourceProvider = config.providers.dataSources.default;
      const dataSourceConfig = config.providers.dataSources[defaultDataSourceProvider];

      // Create the appropriate data source provider
      if (defaultDataSourceProvider === 'application-insights') {
        const { ApplicationInsightsProvider } = require('../providers/datasource/ApplicationInsightsProvider');
        this.dataSourceProvider = new ApplicationInsightsProvider(dataSourceConfig);
      } else if (defaultDataSourceProvider === 'log-analytics') {
        const { LogAnalyticsProvider } = require('../providers/datasource/LogAnalyticsProvider');
        this.dataSourceProvider = new LogAnalyticsProvider(dataSourceConfig);
      }
      
      logger.info('Legacy AppInsightsService initialized with provider delegation');
    } catch (error) {
      logger.error('Failed to initialize data source provider in legacy service:', error);
      logger.warn('Falling back to direct HTTP client implementation');
    }
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
    if (this.dataSourceProvider) {
      // Use provider if available
      return this.dataSourceProvider.executeQuery({ query: kqlQuery });
    }

    // Fallback to legacy implementation
    logger.info(`Executing KQL query:\n ${kqlQuery}`);
    
    return withLoadingIndicator(
      'Executing query on Application Insights...',
      async () => {
        const defaultDataSource = this.configManager.getDefaultProvider('dataSources');
        const dataSourceConfig = this.configManager.getProviderConfig('dataSources', defaultDataSource);
        
        if (!dataSourceConfig) {
          throw new Error(`Data source provider '${defaultDataSource}' configuration not found`);
        }
        
        const url = `/${dataSourceConfig.applicationId}/query`;

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
    if (this.dataSourceProvider) {
      // Use provider if available
      const result = await this.dataSourceProvider.validateConnection();
      return result.isValid;
    }

    // Fallback to legacy implementation
    return withLoadingIndicator(
      'Validating Application Insights connection...',
      async () => {
        const defaultDataSource = this.configManager.getDefaultProvider('dataSources');
        const dataSourceConfig = this.configManager.getProviderConfig('dataSources', defaultDataSource);
        
        if (!dataSourceConfig) {
          throw new Error(`Data source provider '${defaultDataSource}' configuration not found`);
        }
        
        // Test connection with a simple query
        await this.httpClient.post(`/${dataSourceConfig.applicationId}/query`, {
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
    if (this.dataSourceProvider) {
      // Use provider if available
      const result = await this.dataSourceProvider.getSchema();
      return result.schema;
    }

    // Fallback to legacy implementation
    return withLoadingIndicator(
      'Retrieving Application Insights schema...',
      async () => {
        const defaultDataSource = this.configManager.getDefaultProvider('dataSources');
        const dataSourceConfig = this.configManager.getProviderConfig('dataSources', defaultDataSource);
        
        if (!dataSourceConfig) {
          throw new Error(`Data source provider '${defaultDataSource}' configuration not found`);
        }
        
        const url = `/${dataSourceConfig.applicationId}/metadata`;

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
