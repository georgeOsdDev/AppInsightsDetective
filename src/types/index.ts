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
