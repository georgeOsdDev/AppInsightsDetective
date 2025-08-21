import axios, { AxiosInstance } from 'axios';
import { IDataSourceProvider, QueryExecutionRequest, ValidationResult, SchemaResult, MetadataResult } from '../../core/interfaces/IDataSourceProvider';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { DataSourceConfig } from '../../core/types/ProviderTypes';
import { QueryResult } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Application Insights data source provider implementation
 */
export class ApplicationInsightsProvider implements IDataSourceProvider {
  private httpClient: AxiosInstance;

  constructor(
    private config: DataSourceConfig,
    private authProvider?: IAuthenticationProvider
  ) {
    if (this.config.type !== 'application-insights') {
      throw new Error('Invalid provider type for ApplicationInsightsProvider');
    }

    const baseURL = this.config.endpoint || 'https://api.applicationinsights.io/v1/apps';

    this.httpClient = axios.create({
      baseURL,
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(async (config) => {
      try {
        let token: string;
        if (this.authProvider) {
          token = await this.authProvider.getAccessToken(['https://api.applicationinsights.io/.default']);
        } else {
          // Fallback to direct token acquisition
          const { DefaultAzureCredential } = await import('@azure/identity');
          const credential = new DefaultAzureCredential();
          const tokenResponse = await credential.getToken(['https://api.applicationinsights.io/.default']);
          token = tokenResponse.token;
        }
        
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      } catch (error) {
        logger.error('Failed to add auth token to Application Insights request:', error);
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

  /**
   * Execute a query against Application Insights
   */
  async executeQuery(request: QueryExecutionRequest): Promise<QueryResult> {
    try {
      if (!this.config.applicationId) {
        throw new Error('Application ID not configured for Application Insights provider');
      }

      const url = `/${this.config.applicationId}/query`;

      logger.info(`Executing KQL query: ${request.query}`);

      const response = await this.httpClient.post(url, {
        query: request.query,
      });

      logger.info('Query executed successfully');
      return response.data;
    } catch (error) {
      logger.error('Failed to execute Application Insights query:', error);
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  /**
   * Validate connection to Application Insights
   */
  async validateConnection(): Promise<ValidationResult> {
    try {
      // Test connection with a simple query
      await this.executeQuery({ query: 'requests | take 1' });
      logger.info('Application Insights connection validated successfully');
      return { isValid: true };
    } catch (error) {
      const errorMessage = `Application Insights connection validation failed: ${error}`;
      logger.error(errorMessage);
      return { 
        isValid: false, 
        error: errorMessage 
      };
    }
  }

  /**
   * Get schema information for Application Insights
   */
  async getSchema(): Promise<SchemaResult> {
    try {
      if (!this.config.applicationId) {
        throw new Error('Application ID not configured for Application Insights provider');
      }

      const url = `/${this.config.applicationId}/metadata`;

      const response = await this.httpClient.get(url);
      logger.info('Application Insights schema retrieved successfully');

      // Extract table names from metadata
      const tables: string[] = [];
      if (response.data?.tables) {
        tables.push(...response.data.tables.map((table: any) => table.name));
      }

      return {
        tables,
        schema: response.data
      };
    } catch (error) {
      logger.error('Failed to retrieve Application Insights schema:', error);
      throw new Error(`Schema retrieval failed: ${error}`);
    }
  }

  /**
   * Get metadata about the Application Insights resource
   */
  async getMetadata(): Promise<MetadataResult> {
    try {
      if (!this.config.applicationId) {
        throw new Error('Application ID not configured for Application Insights provider');
      }

      // For Application Insights, we can return basic metadata
      return {
        name: `Application Insights (${this.config.applicationId})`,
        type: 'application-insights',
        properties: {
          applicationId: this.config.applicationId,
          tenantId: this.config.tenantId,
          endpoint: this.config.endpoint,
          subscriptionId: this.config.subscriptionId,
          resourceGroup: this.config.resourceGroup,
          resourceName: this.config.resourceName
        }
      };
    } catch (error) {
      logger.error('Failed to retrieve Application Insights metadata:', error);
      throw new Error(`Metadata retrieval failed: ${error}`);
    }
  }
}