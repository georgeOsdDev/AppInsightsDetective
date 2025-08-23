import { QueryResult } from '../../types';

/**
 * Interface for data source providers (Application Insights, Log Analytics, etc.)
 */
export interface IDataSourceProvider {
  /**
   * Execute KQL query against the data source
   */
  executeQuery(query: string): Promise<QueryResult>;

  /**
   * Validate connection to the data source
   */
  validateConnection(): Promise<{
    isValid: boolean;
    error?: string;
  }>;

  /**
   * Get schema information from the data source
   */
  getSchema(): Promise<any>;

  /**
   * Get metadata about the data source
   */
  getMetadata(): Promise<{
    name: string;
    type: string;
    version?: string;
    capabilities: string[];
  }>;

  /**
   * Get resource identifier for external operations
   */
  getResourceId(): Promise<string | null>;
}