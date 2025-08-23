import { NLQuery, QueryResult, SupportedLanguage, ExplanationOptions, RegenerationContext } from '../../types';

/**
 * Interface for AI providers that can generate and explain KQL queries
 */
export interface IAIProvider {
  /**
   * Initialize the AI provider
   */
  initialize(): Promise<void>;

  /**
   * Generate KQL query from natural language
   */
  generateKQLQuery(
    naturalLanguageQuery: string,
    schema?: any
  ): Promise<NLQuery | null>;

  /**
   * Regenerate KQL query with different approach
   */
  regenerateKQLQuery(
    originalQuestion: string,
    context: RegenerationContext,
    schema?: any
  ): Promise<NLQuery | null>;

  /**
   * Explain KQL query in detail
   */
  explainKQLQuery(
    kqlQuery: string,
    options?: ExplanationOptions
  ): Promise<string>;

  /**
   * Generate AI response for analysis prompts
   */
  generateResponse(prompt: string): Promise<string>;

  /**
   * Validate query for security and syntax
   */
  validateQuery(query: string): Promise<{
    isValid: boolean;
    error?: string;
    warnings?: string[];
  }>;
}