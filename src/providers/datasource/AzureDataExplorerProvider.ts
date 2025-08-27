import { IDataSourceProvider, QueryExecutionRequest, ValidationResult, SchemaResult, MetadataResult } from '../../core/interfaces/IDataSourceProvider';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { DataSourceConfig } from '../../core/types/ProviderTypes';
import { QueryResult } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Azure Data Explorer (Kusto) data source provider implementation
 */
export class AzureDataExplorerProvider implements IDataSourceProvider {
  private client: any;
  private clusterUri: string;
  private database: string;
  private requiresAuthentication: boolean;
  private KustoClient: any;
  private KustoConnectionStringBuilder: any;
  private ClientRequestProperties: any;

  constructor(
    private config: DataSourceConfig,
    private authProvider?: IAuthenticationProvider
  ) {
    if (this.config.type !== 'azure-data-explorer') {
      throw new Error('Invalid provider type for AzureDataExplorerProvider');
    }

    if (!this.config.clusterUri) {
      throw new Error('Azure Data Explorer provider requires clusterUri');
    }

    if (!this.config.database) {
      throw new Error('Azure Data Explorer provider requires database');
    }

    this.clusterUri = this.config.clusterUri;
    this.database = this.config.database;
    this.requiresAuthentication = this.config.requiresAuthentication ?? true;

    // Note: Client initialization is deferred until first use
  }

  private async initializeClient(): Promise<void> {
    try {
      // Dynamic import to avoid TypeScript module resolution issues
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const kustoData = require('azure-kusto-data');
      this.KustoClient = kustoData.Client;
      this.KustoConnectionStringBuilder = kustoData.KustoConnectionStringBuilder;
      this.ClientRequestProperties = kustoData.ClientRequestProperties;

      let connectionStringBuilder: any;

      if (this.requiresAuthentication && this.authProvider) {
        // Use provided authentication provider - get token and use withAccessToken
        const token = await this.authProvider.getAccessToken(['https://help.kusto.windows.net/.default']);
        connectionStringBuilder = this.KustoConnectionStringBuilder.withAccessToken(this.clusterUri, token);
      } else {
        // For all clusters (including "public" ones), use Azure AD authentication
        // Even public clusters like Microsoft Help cluster require Azure AD auth
        const { DefaultAzureCredential } = await import('@azure/identity');
        const credential = new DefaultAzureCredential();
        
        try {
          // Use withTokenCredential for proper Azure AD integration
          connectionStringBuilder = this.KustoConnectionStringBuilder.withTokenCredential(this.clusterUri, credential);
        } catch (authError) {
          logger.debug('DefaultAzureCredential failed, trying Azure CLI credential:', authError);
          try {
            // Try Azure CLI credential as fallback
            connectionStringBuilder = this.KustoConnectionStringBuilder.withAzLoginIdentity(this.clusterUri);
          } catch (azCliError) {
            // If Azure CLI credential also fails, try system managed identity as final fallback
            logger.debug('Azure CLI credential failed, trying system managed identity:', azCliError);
            connectionStringBuilder = this.KustoConnectionStringBuilder.withSystemManagedIdentity(this.clusterUri);
          }
        }
      }

      this.client = new this.KustoClient(connectionStringBuilder);
      logger.debug('Azure Data Explorer client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Azure Data Explorer client:', error);
      throw new Error(`Azure Data Explorer client initialization failed: ${error}`);
    }
  }

  /**
   * Execute KQL query against Azure Data Explorer cluster
   */
  async executeQuery(request: QueryExecutionRequest): Promise<QueryResult> {
    try {
      logger.debug('Executing query on Azure Data Explorer...');

      // Ensure client is initialized
      if (!this.client) {
        await this.initializeClient();
      }

      const clientRequestProperties = new this.ClientRequestProperties();
      if (request.timeout) {
        clientRequestProperties.setOption('servertimeout', request.timeout);
      }

      const response = await this.client.execute(this.database, request.query, clientRequestProperties);

      // Transform ADX response to Application Insights format for consistency
      const result = this.transformADXResponse(response);

      logger.debug(`Azure Data Explorer query executed successfully, returned ${result.tables[0]?.rows?.length || 0} rows`);
      return result;
    } catch (error) {
      logger.error('Failed to execute Azure Data Explorer query:', error);
      throw new Error(`Azure Data Explorer query execution failed: ${error}`);
    }
  }

  /**
   * Validate connection to Azure Data Explorer cluster
   */
  async validateConnection(): Promise<ValidationResult> {
    try {
      // Test connection with a simple query
      const testQuery = '.show version';
      await this.executeQuery({ query: testQuery });
      
      logger.debug('Azure Data Explorer connection validated successfully');
      return { isValid: true };
    } catch (error) {
      logger.warn('Azure Data Explorer connection validation failed:', error);
      return { 
        isValid: false, 
        error: `Connection validation failed: ${error}` 
      };
    }
  }

  /**
   * Get schema information from Azure Data Explorer cluster
   */
  async getSchema(): Promise<SchemaResult> {
    try {
      // Query to get all tables in the database
      const tablesQuery = '.show tables | project TableName';
      const tablesResponse = await this.executeQuery({ query: tablesQuery });
      
      const tables = tablesResponse.tables[0]?.rows?.map(row => String(row[0])) || [];
      
      // Get detailed schema for each table (limit to avoid overwhelming response)
      const schemaQuery = '.show tables schema | project TableName, ColumnName, ColumnType | limit 1000';
      const schemaResponse = await this.executeQuery({ query: schemaQuery });
      
      const schema = this.buildSchemaFromResponse(schemaResponse);

      logger.debug(`Retrieved schema for ${tables.length} tables from Azure Data Explorer`);
      return { 
        tables, 
        schema 
      };
    } catch (error) {
      logger.error('Failed to get Azure Data Explorer schema:', error);
      return { 
        error: `Schema retrieval failed: ${error}` 
      };
    }
  }

  /**
   * Get metadata about the Azure Data Explorer cluster
   */
  async getMetadata(): Promise<MetadataResult> {
    try {
      // Get cluster information
      const clusterInfoQuery = '.show version';
      const clusterResponse = await this.executeQuery({ query: clusterInfoQuery });
      
      // Get database information
      const databaseInfoQuery = '.show database details';
      const databaseResponse = await this.executeQuery({ query: databaseInfoQuery });

      const metadata = {
        clusterUri: this.clusterUri,
        database: this.database,
        version: clusterResponse.tables[0]?.rows?.[0] || 'Unknown',
        databaseInfo: databaseResponse.tables[0]?.rows?.[0] || {}
      };

      logger.debug('Retrieved Azure Data Explorer metadata successfully');
      return {
        name: `${this.clusterUri}/${this.database}`,
        type: 'azure-data-explorer',
        properties: {
          clusterUri: this.clusterUri,
          database: this.database,
          requiresAuthentication: this.requiresAuthentication
        },
        metadata
      };
    } catch (error) {
      logger.error('Failed to get Azure Data Explorer metadata:', error);
      return {
        error: `Metadata retrieval failed: ${error}`
      };
    }
  }

  /**
   * Transform ADX response to Application Insights compatible format
   */
  private transformADXResponse(adxResponse: any): QueryResult {
    try {
      // ADX returns results in KustoResponseDataSetV2 format
      // primaryResults is an array of KustoResultTable objects
      const primaryResult = adxResponse.primaryResults[0];
      
      if (!primaryResult) {
        return {
          tables: [{
            name: 'PrimaryResult',
            columns: [],
            rows: []
          }]
        };
      }

      // KustoResultColumn has 'name' and 'type' properties (not columnName/dataType)
      const columns = primaryResult.columns.map((col: any) => ({
        name: col.name,
        type: col.type
      }));

      // KustoResultTable has rows() method that returns a generator of KustoResultRow objects
      // Convert generator to array and extract values from each row
      const rows: unknown[][] = [];
      const rowGenerator = primaryResult.rows();
      if (rowGenerator) {
        for (const row of rowGenerator) {
          // Convert KustoResultRow to plain array of values
          // Each row has column values accessible by column names or via ordinal access
          const rowValues: unknown[] = [];
          for (let i = 0; i < columns.length; i++) {
            rowValues.push(row.getValueAt(i));
          }
          rows.push(rowValues);
        }
      }

      logger.debug(`Transformed ADX response: ${rows.length} rows, ${columns.length} columns`);

      return {
        tables: [{
          name: 'PrimaryResult',
          columns,
          rows
        }]
      };
    } catch (error) {
      logger.error('Failed to transform ADX response:', error);
      // Return empty result on transformation failure
      return {
        tables: [{
          name: 'PrimaryResult',
          columns: [],
          rows: []
        }]
      };
    }
  }

  /**
   * Build schema object from schema query response
   */
  private buildSchemaFromResponse(schemaResponse: QueryResult): any {
    const schema: any = {};
    
    if (schemaResponse.tables[0]?.rows) {
      schemaResponse.tables[0].rows.forEach((row: any) => {
        const [tableName, columnName, columnType] = row;
        if (!schema[tableName]) {
          schema[tableName] = {};
        }
        schema[tableName][columnName] = columnType;
      });
    }
    
    return schema;
  }
}