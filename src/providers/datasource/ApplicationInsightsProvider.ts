import axios, { AxiosInstance } from 'axios';
import { IDataSourceProvider, QueryExecutionRequest, ValidationResult, SchemaResult, MetadataResult } from '../../core/interfaces/IDataSourceProvider';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { DataSourceConfig } from '../../core/types/ProviderTypes';
import { QueryResult } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Azure Application Insights data source provider implementation
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

    if (!this.config.applicationId) {
      throw new Error('Application Insights provider requires applicationId');
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
   * Execute KQL query against Application Insights
   */
  async executeQuery(request: QueryExecutionRequest): Promise<QueryResult> {
    try {
      logger.info('Executing query on Application Insights...');

      const url = `/${this.config.applicationId}/query`;

      const requestBody: any = {
        query: request.query,
      };

      // Add timespan if provided
      if (request.timespan) {
        requestBody.timespan = request.timespan;
      }

      const response = await this.httpClient.post(url, requestBody);

      logger.info(`Application Insights query executed successfully, returned ${response.data?.tables?.[0]?.rows?.length || 0} rows`);
      return response.data;
    } catch (error) {
      logger.error('Failed to execute Application Insights query:', error);
      throw new Error(`Application Insights query execution failed: ${error}`);
    }
  }

  /**
   * Validate connection to Application Insights
   */
  async validateConnection(): Promise<ValidationResult> {
    try {
      logger.info('Validating Application Insights connection...');

      // Test connection with a simple query
      const url = `/${this.config.applicationId}/query`;

      await this.httpClient.post(url, {
        query: 'requests | take 1',
      });

      logger.info('Application Insights connection validated successfully');
      return { isValid: true };
    } catch (error) {
      logger.error('Application Insights connection validation failed:', error);
      return {
        isValid: false,
        error: `Connection validation failed: ${error}`
      };
    }
  }

  /**
   * Get schema information from Application Insights
   */
  async getSchema(): Promise<SchemaResult> {
    try {
      logger.info('Retrieving Application Insights schema...');

      const url = `/${this.config.applicationId}/metadata`;

      const response = await this.httpClient.get(url);

      logger.info('Application Insights schema retrieved successfully');
      
      // Extract tables from the schema response if available
      let tables: string[] = [];
      if (response.data?.tables) {
        if (Array.isArray(response.data.tables)) {
          // Handle array format
          tables = response.data.tables.map((table: any) => table.name || table);
        } else if (typeof response.data.tables === 'object') {
          // Handle object format (table names as keys)
          tables = Object.keys(response.data.tables);
        }
      }
      
      return { 
        schema: response.data,
        tables 
      };
    } catch (error) {
      logger.error('Failed to retrieve Application Insights schema:', error);
      return { 
        schema: null, 
        tables: [],
        error: `Schema retrieval failed: ${error}` 
      };
    }
  }

  /**
   * Get metadata about the Application Insights resource
   */
  async getMetadata(): Promise<MetadataResult> {
    try {
      logger.info('Retrieving Application Insights metadata...');

      // Get application info
      const infoUrl = `/${this.config.applicationId}`;

      const response = await this.httpClient.get(infoUrl);

      const metadata = {
        applicationId: this.config.applicationId,
        applicationName: response.data?.properties?.applicationName || 'Unknown',
        tenantId: this.config.tenantId,
        endpoint: this.config.endpoint || 'https://api.applicationinsights.io/v1/apps',
        instrumentationKey: response.data?.properties?.instrumentationKey,
        appId: response.data?.properties?.appId,
        createdDate: response.data?.properties?.createdDate,
        flowType: response.data?.properties?.flowType,
        applicationType: response.data?.properties?.applicationType,
        requestSource: response.data?.properties?.requestSource
      };

      logger.info('Application Insights metadata retrieved successfully');
      return { metadata };
    } catch (error) {
      logger.error('Failed to retrieve Application Insights metadata:', error);
      return { metadata: null, error: `Metadata retrieval failed: ${error}` };
    }
  }
}
