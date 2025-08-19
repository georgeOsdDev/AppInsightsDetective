export interface AppInsightsConfig {
  applicationId: string;
  tenantId: string;
  endpoint?: string;
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
