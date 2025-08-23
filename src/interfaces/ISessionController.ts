import { SupportedLanguage, AnalysisResult } from '../types';

/**
 * Options for interactive session configuration
 */
export interface InteractiveSessionOptions {
  language?: SupportedLanguage;
  defaultMode?: 'direct' | 'step' | 'raw';
  outputFormat?: string;
  outputFile?: string;
  prettyJson?: boolean;
  includeHeaders?: boolean;
  encoding?: BufferEncoding;
}

/**
 * Interface for managing user interaction and session flow
 */
export interface ISessionController {
  /**
   * Start interactive session with user
   */
  startSession(): Promise<void>;

  /**
   * Get question from user with validation
   */
  promptForQuestion(): Promise<string>;

  /**
   * Select execution mode (direct, step, raw)
   */
  selectExecutionMode(question?: string): Promise<'direct' | 'step' | 'raw'>;

  /**
   * Prompt for analysis preferences
   */
  promptForAnalysis(): Promise<{ wantAnalysis: boolean; analysisType?: string; language?: SupportedLanguage }>;

  /**
   * Prompt for follow-up query execution
   */
  promptForFollowUpQuery(followUpQueries: Array<{ query: string; purpose: string; priority: 'high' | 'medium' | 'low' }>): Promise<string | null>;

  /**
   * Ask user if they want to continue the session
   */
  promptToContinue(): Promise<boolean>;

  /**
   * Update session settings
   */
  updateSettings(currentLanguage?: SupportedLanguage): Promise<void>;
}