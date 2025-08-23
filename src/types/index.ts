export interface AppInsightsConfig {
  applicationId: string;
  tenantId: string;
  endpoint?: string;
  // External execution configuration
  subscriptionId?: string;
  resourceGroup?: string;
  resourceName?: string;
}

export interface OpenAIConfig {
  endpoint: string;
  apiKey?: string;
  deploymentName?: string;
}

export interface Config {
  appInsights: AppInsightsConfig;
  openAI: OpenAIConfig;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  language?: string;
}

export interface QueryResult {
  tables: QueryTable[];
}

export interface QueryTable {
  name: string;
  columns: QueryColumn[];
  rows: QueryRow[];
}

export interface QueryColumn {
  name: string;
  type: string;
}

export type QueryRow = unknown[];

export interface NaturalLanguageQuery {
  userInput: string;
  generatedKQL: string;
  confidence: number;
  timestamp: Date;
}

// NLQuery for AI service responses
export interface NLQuery {
  generatedKQL: string;
  confidence: number;
  reasoning?: string;
  originalQuestion?: string;  // Added for compatibility
  timestamp?: Date;           // Added for compatibility
}

// Regeneration context for AI service
export interface RegenerationContext {
  previousQuery: string;
  previousReasoning?: string;
  attemptNumber: number;
}

export interface QueryHistory {
  id: string;
  query: NaturalLanguageQuery;
  result?: QueryResult;
  executionTime: number;
  status: 'success' | 'error';
  error?: string;
}

// OpenAI response types for type safety
export interface OpenAIChoice {
  message?: {
    content?: string;
  };
  finish_reason?: string;
}

// Language settings for explanation translation
export type SupportedLanguage =
  | 'auto'
  | 'en'      // English
  | 'ja'      // Japanese
  | 'ko'      // Korean
  | 'zh'      // Chinese (Simplified)
  | 'zh-TW'   // Chinese (Traditional)
  | 'es'      // Spanish
  | 'fr'      // French
  | 'de'      // German
  | 'it'      // Italian
  | 'pt'      // Portuguese
  | 'ru'      // Russian
  | 'ar';     // Arabic

export interface ExplanationOptions {
  language?: SupportedLanguage;
  includeExamples?: boolean;
  technicalLevel?: 'beginner' | 'intermediate' | 'advanced';
}

// Output format types
export type OutputFormat = 'table' | 'json' | 'csv' | 'tsv' | 'raw';
export type OutputDestination = 'console' | 'file' | 'both';

export interface OutputOptions {
  format: OutputFormat;
  destination: OutputDestination;
  filePath?: string;
  pretty?: boolean;
  includeHeaders?: boolean;
  encoding?: BufferEncoding;
}

export interface FormattedOutput {
  content: string;
  extension: string;
  mimeType: string;
}

export interface QueryResultWithTiming {
  result: QueryResult;
  executionTime: number; // in milliseconds
}

// Analysis types for interactive query result analysis
export type AnalysisType = 'statistical' | 'patterns' | 'anomalies' | 'insights' | 'full';

export interface StatisticalAnalysis {
  summary: {
    totalRows: number;
    uniqueValues: Record<string, number>;
    nullPercentage: Record<string, number>;
  };
  numerical: {
    mean: number;
    median: number;
    stdDev: number;
    outliers: any[];
    distribution: 'normal' | 'skewed' | 'uniform' | 'unknown';
  } | null;
  temporal: {
    timeRange: { start: Date; end: Date };
    trends: 'increasing' | 'decreasing' | 'stable' | 'seasonal' | 'unknown';
    gaps: Date[];
  } | null;
}

export interface PatternAnalysis {
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
}

export interface ContextualInsights {
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
}

export interface AnalysisResult {
  statistical?: StatisticalAnalysis;
  patterns?: PatternAnalysis;
  insights?: ContextualInsights;
  aiInsights?: string;
  recommendations?: string[];
  followUpQueries?: {
    query: string;
    purpose: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

export interface AnalysisOptions {
  enabled: boolean;
  autoAnalyze: boolean;
  defaultAnalysisType: AnalysisType;
  maxDataSampleSize: number;
  includeFollowUpQueries: boolean;
  showStatisticalDetails: boolean;
  anomalyDetectionSensitivity: 'low' | 'medium' | 'high';
  language?: SupportedLanguage;
}

// External execution types
export type ExternalExecutionTarget = 'portal';

export interface ExternalExecutionOption {
  target: ExternalExecutionTarget;
  name: string;
  description: string;
}

export interface AzureResourceInfo {
  subscriptionId: string;
  resourceGroup: string;
  resourceName: string;
  tenantId: string;
}

export interface ExternalExecutionResult {
  url: string;
  target: ExternalExecutionTarget;
  launched: boolean;
  error?: string;
}
