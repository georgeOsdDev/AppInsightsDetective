import { QueryResult, NLQuery, AnalysisResult, AnalysisType, SupportedLanguage } from '../types';

/**
 * Options for query execution
 */
export interface QueryExecutionOptions {
  mode: 'direct' | 'step' | 'raw';
  schema?: any;
  language?: SupportedLanguage;
}

/**
 * Options for result analysis
 */
export interface AnalysisOptions {
  analysisType: AnalysisType;
  language?: SupportedLanguage;
}

/**
 * Interface for coordinating business logic between AI and data sources
 */
export interface IQueryOrchestrator {
  /**
   * Execute natural language query with AI assistance
   */
  executeNaturalLanguageQuery(question: string, options: QueryExecutionOptions): Promise<QueryResult | null>;

  /**
   * Execute raw KQL query directly
   */
  executeRawQuery(query: string): Promise<QueryResult>;

  /**
   * Analyze query results for patterns and insights
   */
  analyzeResults(result: QueryResult, originalQuery: string, options: AnalysisOptions): Promise<AnalysisResult>;

  /**
   * Execute follow-up query
   */
  executeFollowUpQuery(query: string): Promise<QueryResult>;
}