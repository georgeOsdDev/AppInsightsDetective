import axios, { AxiosInstance } from 'axios';
import { LogsQueryClient, LogsQueryResult, LogsQueryResultStatus } from '@azure/monitor-query-logs';
import { IDataSourceProvider, QueryExecutionRequest, ValidationResult, SchemaResult, MetadataResult } from '../../core/interfaces/IDataSourceProvider';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { DataSourceConfig } from '../../core/types/ProviderTypes';
import { QueryResult } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Azure Monitor Log Analytics data source provider implementation
 */
export class LogAnalyticsProvider implements IDataSourceProvider {
  private httpClient!: AxiosInstance; // Keep for metadata operations
  private logsQueryClient!: LogsQueryClient;
  private initializationPromise: Promise<void>;

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

    // Initialize both clients asynchronously
    this.initializationPromise = this.initializeClients();
  }

  private async initializeClients(): Promise<void> {
    // Initialize LogsQueryClient for query operations
    let credential;
    if (this.authProvider) {
      // Use provided auth provider - we need to create a TokenCredential compatible wrapper
      credential = {
        getToken: async (scopes: string[]) => {
          const token = await this.authProvider!.getAccessToken(scopes);
          return { token, expiresOnTimestamp: Date.now() + (3600 * 1000) }; // 1 hour default
        }
      };
    } else {
      // Use DefaultAzureCredential
      const { DefaultAzureCredential } = await import('@azure/identity');
      credential = new DefaultAzureCredential();
    }
    
    this.logsQueryClient = new LogsQueryClient(credential);

    // Keep HTTP client for metadata operations (still needed for workspace metadata)
    const baseURL = 'https://management.azure.com';
    this.httpClient = axios.create({
      baseURL,
      timeout: 60000, // Log Analytics queries can take longer
    });

    this.setupInterceptors();
  }

  private async ensureInitialized(): Promise<void> {
    await this.initializationPromise;
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
   * Get the workspace ID for the configured Log Analytics workspace
   */
  private async getWorkspaceId(): Promise<string> {
    await this.ensureInitialized();
    
    try {
      const workspaceUrl = `/subscriptions/${this.config.subscriptionId}/resourceGroups/${this.config.resourceGroup}/providers/Microsoft.OperationalInsights/workspaces/${this.config.resourceName}`;
      const response = await this.httpClient.get(`${workspaceUrl}?api-version=2022-10-01`);
      
      const workspaceId = response.data.properties?.customerId;
      if (!workspaceId) {
        throw new Error('Workspace ID (customerId) not found in workspace metadata');
      }
      
      return workspaceId;
    } catch (error) {
      logger.error('Failed to retrieve workspace ID:', error);
      throw new Error(`Failed to retrieve workspace ID: ${error}`);
    }
  }

  /**
   * Execute KQL query against Log Analytics workspace
   */
  async executeQuery(request: QueryExecutionRequest): Promise<QueryResult> {
    try {
      await this.ensureInitialized();
      logger.debug('Executing query on Log Analytics using LogsQueryClient...');

      const workspaceId = await this.getWorkspaceId();
      
      // Convert timespan to QueryTimeInterval format
      const timespan = request.timespan 
        ? { duration: request.timespan }
        : { duration: 'PT24H' }; // Default to last 24 hours

      const result = await this.logsQueryClient.queryWorkspace(
        workspaceId,
        request.query,
        timespan
      );

      // Transform the result to Application Insights format
      const transformedResult = this.transformLogsQueryResponse(result);
      
      logger.debug(`Log Analytics query executed successfully, returned ${transformedResult.tables[0]?.rows?.length || 0} rows`);
      return transformedResult;
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
      await this.ensureInitialized();
      logger.debug('Validating Log Analytics connection...');

      const workspaceId = await this.getWorkspaceId();
      
      // Test connection with a simple query using the LogsQueryClient
      const timespan = { duration: 'PT1H' };
      await this.logsQueryClient.queryWorkspace(
        workspaceId,
        'print "connection_test"',
        timespan
      );

      logger.debug('Log Analytics connection validated successfully');
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
      await this.ensureInitialized();
      logger.debug('Retrieving Log Analytics schema...');

      const workspaceId = await this.getWorkspaceId();

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

      const timespan = { duration: 'PT1H' };
      const result = await this.logsQueryClient.queryWorkspace(
        workspaceId,
        schemaQuery,
        timespan
      );

      const transformedResult = this.transformLogsQueryResponse(result);
      
      logger.debug('Log Analytics schema retrieved successfully');
      return { schema: transformedResult };
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
      logger.debug('Retrieving Log Analytics metadata...');

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

      logger.debug('Log Analytics metadata retrieved successfully');
      return { metadata };
    } catch (error) {
      logger.error('Failed to retrieve Log Analytics metadata:', error);
      return { metadata: null, error: `Metadata retrieval failed: ${error}` };
    }
  }

  /**
   * Transform LogsQueryResult response to Application Insights format
   */
  private transformLogsQueryResponse(result: LogsQueryResult): QueryResult {
    // Handle different result statuses
    if (result.status === LogsQueryResultStatus.Success) {
      const transformedTables = result.tables.map((table) => ({
        name: table.name,
        columns: table.columnDescriptors.map((col) => ({
          name: col.name,
          type: this.mapLogAnalyticsType(col.type)
        })),
        rows: table.rows
      }));

      return { tables: transformedTables };
    } else if (result.status === LogsQueryResultStatus.PartialFailure) {
      logger.warn('Query completed with partial failure:', result.partialError);
      
      const transformedTables = result.partialTables.map((table) => ({
        name: table.name,
        columns: table.columnDescriptors.map((col) => ({
          name: col.name,
          type: this.mapLogAnalyticsType(col.type)
        })),
        rows: table.rows
      }));

      return { tables: transformedTables };
    } else {
      // This should not happen as errors are thrown, but handle just in case
      throw new Error('Query failed with unknown status');
    }
  }

  /**
   * Transform Log Analytics response to Application Insights format
   */
  private transformLogAnalyticsResponse(data: any): QueryResult {
    // Log Analytics returns data in a different format than Application Insights
    // We need to transform it to maintain compatibility
    
    // Log Analytics API returns data in "Table" (capital T), not "tables" (lowercase)
    const tables = data.Table || data.tables || [];
    
    if (!tables || tables.length === 0) {
      return { tables: [] };
    }

    const transformedTables = tables.map((table: any) => ({
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
      case 'decimal':
        return 'real';
      case 'datetime':
        return 'datetime';
      case 'bool':
        return 'bool';
      case 'dynamic':
        return 'dynamic';
      case 'timespan':
        return 'string'; // Map timespan to string for compatibility
      default:
        return logAnalyticsType || 'string';
    }
  }
}