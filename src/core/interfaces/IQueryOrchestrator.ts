import { QueryResult, NLQuery, QueryResultWithTiming } from '../../types';
import { DataSourceType } from '../types/ProviderTypes';

/**
 * Request for natural language query execution
 */
export interface NLQueryRequest {
  userInput: string;
  schema?: any;
  language?: string;
  dataSourceType?: DataSourceType;
  extraContext?: string;
}

/**
 * Request for template query execution  
 */
export interface TemplateQueryRequest {
  templateId: string;
  parameters: Record<string, any>;
  schema?: any;
}

/**
 * Orchestrator for query execution
 */
export interface IQueryOrchestrator {
  /**
   * Execute a natural language query
   */
  executeNaturalLanguageQuery(request: NLQueryRequest): Promise<QueryResultWithTiming>;

  /**
   * Execute a template query
   */
  executeTemplateQuery(request: TemplateQueryRequest): Promise<QueryResultWithTiming>;

  /**
   * Execute a raw KQL query
   */
  executeRawQuery(query: string): Promise<QueryResultWithTiming>;

  /**
   * Validate a KQL query
   */
  validateQuery(query: string): Promise<{ isValid: boolean; error?: string }>;
}