import { QueryResult } from '../../types';

/**
 * Request for query execution
 */
export interface QueryExecutionRequest {
  query: string;
  timeout?: number;
  timespan?: string;
}

/**
 * Validation result for connection
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Schema result for data source
 */
export interface SchemaResult {
  tables?: string[];
  schema?: any;
  error?: string;
}

/**
 * Metadata about the data source
 */
export interface MetadataResult {
  name?: string;
  type?: string;
  properties?: Record<string, any>;
  metadata?: any;
  error?: string;
}

/**
 * Core interface for data source providers (Application Insights, Log Analytics, etc.)
 */
export interface IDataSourceProvider {
  /**
   * Execute a query against the data source
   */
  executeQuery(request: QueryExecutionRequest): Promise<QueryResult>;

  /**
   * Validate connection to the data source
   */
  validateConnection(): Promise<ValidationResult>;

  /**
   * Get schema information for query generation
   */
  getSchema(): Promise<SchemaResult>;

  /**
   * Get metadata about the data source
   */
  getMetadata(): Promise<MetadataResult>;
}