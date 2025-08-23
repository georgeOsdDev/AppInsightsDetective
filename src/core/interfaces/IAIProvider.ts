import { NLQuery, RegenerationContext, SupportedLanguage, ExplanationOptions } from '../../types';

/**
 * Request for AI query generation
 */
export interface QueryGenerationRequest {
  userInput: string;
  schema?: any;
  language?: SupportedLanguage;
}

/**
 * Request for AI query explanation
 */
export interface QueryExplanationRequest {
  query: string;
  options?: ExplanationOptions;
}

/**
 * Request for AI query regeneration
 */
export interface RegenerationRequest {
  userInput: string;
  context: RegenerationContext;
  schema?: any;
  language?: SupportedLanguage;
}

/**
 * Request for query result analysis
 */
export interface QueryAnalysisRequest {
  result: any; // QueryResult from types/index.ts
  originalQuery: string;
  analysisType: 'patterns' | 'anomalies' | 'insights' | 'full';
  options?: {
    language?: SupportedLanguage;
  };
}

/**
 * Result of query analysis
 */
export interface QueryAnalysisResult {
  patterns?: {
    trends: {
      description: string;
      confidence: number;
      visualization: string;
    }[];
    anomalies: {
      type: 'outlier' | 'spike' | 'dip' | 'missing_data';
      description: string;
      severity: 'low' | 'medium' | 'high';
      affectedRows: number[];
    }[];
    correlations: {
      columns: [string, string];
      coefficient: number;
      significance: 'strong' | 'moderate' | 'weak';
    }[];
  };
  insights?: {
    dataQuality: {
      completeness: number;
      consistency: string[];
      recommendations: string[];
    };
    businessInsights: {
      keyFindings: string[];
      potentialIssues: string[];
      opportunities: string[];
    };
    followUpQueries: {
      query: string;
      purpose: string;
      priority: 'high' | 'medium' | 'low';
    }[];
  };
  aiInsights?: string;
  recommendations?: string[];
  followUpQueries?: {
    query: string;
    purpose: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

/**
 * Core interface for AI providers (Azure OpenAI, OpenAI, Anthropic, etc.)
 */
export interface IAIProvider {
  /**
   * Initialize the AI provider
   */
  initialize(): Promise<void>;

  /**
   * Generate KQL query from natural language
   */
  generateQuery(request: QueryGenerationRequest): Promise<NLQuery>;

  /**
   * Explain a KQL query
   */
  explainQuery(request: QueryExplanationRequest): Promise<string>;

  /**
   * Regenerate query with context
   */
  regenerateQuery(request: RegenerationRequest): Promise<NLQuery>;

  /**
   * Generate generic response for analysis
   */
  generateResponse(prompt: string): Promise<string>;

  /**
   * Analyze query results
   */
  analyzeQueryResult(request: QueryAnalysisRequest): Promise<QueryAnalysisResult>;
}
