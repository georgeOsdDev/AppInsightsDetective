import axios, { AxiosInstance } from 'axios';
import { IDataSourceProvider, QueryExecutionRequest, ValidationResult, SchemaResult, MetadataResult } from '../../core/interfaces/IDataSourceProvider';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { DataSourceConfig } from '../../core/types/ProviderTypes';
import { QueryResult } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Azure Monitor Log Analytics data source provider implementation
 */
export class LogAnalyticsProvider implements IDataSourceProvider {
  private httpClient: AxiosInstance;

  constructor(
    private config: DataSourceConfig,
    private authProvider?: IAuthenticationProvider
  ) {
    if (this.config.type !== 'log-analytics') {
      throw new Error('Invalid provider type for LogAnalyticsProvider');
    }

    if (!this.config.subscriptionId || !this.config.resourceGroup || !this.config.resourceName) {
      throw new Error('Log Analytics provider requires subscriptionId, resourceGroup, and resourceName');
    }

    const baseURL = 'https://management.azure.com';
    this.httpClient = axios.create({
      baseURL,
      timeout: 60000, // Log Analytics queries can take longer
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(async (config) => {
      try {
        let token: string;
        if (this.authProvider) {
          token = await this.authProvider.getAccessToken(['https://management.azure.com/.default']);
        } else {
          // Fallback to direct token acquisition
          const { DefaultAzureCredential } = await import('@azure/identity');
          const credential = new DefaultAzureCredential();
          const tokenResponse = await credential.getToken(['https://management.azure.com/.default']);
          token = tokenResponse.token;
        }
        
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      } catch (error) {
        logger.error('Failed to add auth token to Log Analytics request:', error);
        throw error;
      }
    });
  }

  /**
   * Execute KQL query against Log Analytics workspace
   */
  async executeQuery(request: QueryExecutionRequest): Promise<QueryResult> {
    try {
      logger.info('Executing query on Log Analytics...');

      const queryUrl = `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroup}/providers/Microsoft.OperationalInsights/workspaces/${this.config.resourceName}/api/query`;

      const response = await this.httpClient.post(`${queryUrl}?api-version=2020-08-01`, {
        query: request.query,
        timespan: request.timespan || 'PT24H' // Default to last 24 hours
      });

      // Transform Log Analytics response to Application Insights format
      const result = this.transformLogAnalyticsResponse(response.data);
      
      logger.info(`Log Analytics query executed successfully, returned ${result.tables[0]?.rows?.length || 0} rows`);
      return result;
    } catch (error) {
      logger.error('Failed to execute Log Analytics query:', error);
      throw new Error(`Log Analytics query execution failed: ${error}`);
    }
  }

  /**
   * Validate connection to Log Analytics workspace
   */
  async validateConnection(): Promise<ValidationResult> {
    try {
      logger.info('Validating Log Analytics connection...');

      // Test connection with a simple query
      const queryUrl = `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroup}/providers/Microsoft.OperationalInsights/workspaces/${this.config.resourceName}/api/query`;

      await this.httpClient.post(`${queryUrl}?api-version=2020-08-01`, {
        query: 'print "connection_test"',
        timespan: 'PT1H'
      });

      logger.info('Log Analytics connection validated successfully');
      return { isValid: true };
    } catch (error) {
      logger.error('Log Analytics connection validation failed:', error);
      return { 
        isValid: false, 
        error: `Connection validation failed: ${error}` 
      };
    }
  }

  /**
   * Get schema information from Log Analytics workspace
   */
  async getSchema(): Promise<SchemaResult> {
    try {
      logger.info('Retrieving Log Analytics schema...');

      const queryUrl = `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroup}/providers/Microsoft.OperationalInsights/workspaces/${this.config.resourceName}/api/query`;

      // Query to get table schema information
      const schemaQuery = `
        union *
        | getschema
        | where isnotempty(TableName)
        | summarize ColumnCount=count(), 
                   Columns=make_list(strcat(ColumnName, ':', ColumnType)) 
                   by TableName
        | order by TableName asc
        | limit 100
      `;

      const response = await this.httpClient.post(`${queryUrl}?api-version=2020-08-01`, {
        query: schemaQuery,
        timespan: 'PT1H'
      });

      const result = this.transformLogAnalyticsResponse(response.data);
      
      logger.info('Log Analytics schema retrieved successfully');
      return { schema: result };
    } catch (error) {
      logger.error('Failed to retrieve Log Analytics schema:', error);
      return { schema: null, error: `Schema retrieval failed: ${error}` };
    }
  }

  /**
   * Get metadata about the Log Analytics workspace
   */
  async getMetadata(): Promise<MetadataResult> {
    try {
      logger.info('Retrieving Log Analytics metadata...');

      const workspaceUrl = `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroup}/providers/Microsoft.OperationalInsights/workspaces/${this.config.resourceName}`;

      const response = await this.httpClient.get(`${workspaceUrl}?api-version=2022-10-01`);

      const metadata = {
        workspaceId: response.data.properties?.customerId,
        workspaceName: response.data.name,
        location: response.data.location,
        resourceGroup: this.config.resourceGroup,
        subscriptionId: this.config.subscriptionId,
        provisioningState: response.data.properties?.provisioningState,
        retentionInDays: response.data.properties?.retentionInDays,
        sku: response.data.properties?.sku?.name
      };

      logger.info('Log Analytics metadata retrieved successfully');
      return { metadata };
    } catch (error) {
      logger.error('Failed to retrieve Log Analytics metadata:', error);
      return { metadata: null, error: `Metadata retrieval failed: ${error}` };
    }
  }

  /**
   * Transform Log Analytics response to Application Insights format
   */
  private transformLogAnalyticsResponse(data: any): QueryResult {
    // Log Analytics returns data in a different format than Application Insights
    // We need to transform it to maintain compatibility
    
    if (!data.tables || data.tables.length === 0) {
      return { tables: [] };
    }

    const transformedTables = data.tables.map((table: any) => ({
      name: table.name || 'Results',
      columns: table.columns.map((col: any) => ({
        name: col.name,
        type: this.mapLogAnalyticsType(col.type)
      })),
      rows: table.rows || []
    }));

    return { tables: transformedTables };
  }

  /**
   * Map Log Analytics column types to Application Insights format
   */
  private mapLogAnalyticsType(logAnalyticsType: string): string {
    switch (logAnalyticsType?.toLowerCase()) {
      case 'string':
      case 'guid':
        return 'string';
      case 'int':
      case 'long':
        return 'long';
      case 'real':
        return 'real';
      case 'datetime':
        return 'datetime';
      case 'bool':
        return 'bool';
      case 'dynamic':
        return 'dynamic';
      default:
        return logAnalyticsType || 'string';
    }
  }
}