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
}