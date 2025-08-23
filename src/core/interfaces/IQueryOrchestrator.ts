import { QueryResult, NLQuery, AnalysisResult } from '../../types';
import { IAIProvider } from './IAIProvider';
import { IDataSourceProvider } from './IDataSourceProvider';

export interface QueryExecutionRequest {
  naturalLanguageQuery?: string;
  rawQuery?: string;
  mode: 'direct' | 'step' | 'raw';
  schema?: any;
}

export interface QueryExecutionResult {
  result: QueryResult;
  executionTime: number;
  nlQuery?: NLQuery;
  analysisResult?: AnalysisResult;
}

/**
 * Interface for query orchestration and business logic
 */
export interface IQueryOrchestrator {
  /**
   * Execute natural language query
   */
  executeNaturalLanguageQuery(request: QueryExecutionRequest): Promise<QueryExecutionResult>;

  /**
   * Execute raw KQL query
   */
  executeRawQuery(query: string): Promise<QueryExecutionResult>;

  /**
   * Execute query in step-by-step mode
   */
  executeStepByStepQuery(
    naturalLanguageQuery: string,
    schema?: any
  ): Promise<QueryExecutionResult | null>;

  /**
   * Analyze query results
   */
  analyzeResults(
    result: QueryResult,
    analysisType?: string
  ): Promise<AnalysisResult>;
}