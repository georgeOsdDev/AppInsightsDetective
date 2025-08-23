import { SupportedLanguage, OutputFormat } from '../../types';
import { IQueryOrchestrator } from './IQueryOrchestrator';
import { IOutputRenderer } from './IOutputRenderer';

export interface SessionOptions {
  language?: SupportedLanguage;
  defaultMode?: 'direct' | 'step' | 'raw';
  outputFormat?: OutputFormat;
  outputFile?: string;
  prettyJson?: boolean;
  includeHeaders?: boolean;
  encoding?: BufferEncoding;
}

/**
 * Interface for interactive session management and user interaction
 */
export interface ISessionController {
  /**
   * Start interactive session
   */
  startSession(): Promise<void>;

  /**
   * Process user input and execute queries
   */
  processUserInput(input: string): Promise<void>;

  /**
   * Select execution mode for query
   */
  selectExecutionMode(): Promise<'direct' | 'step' | 'raw'>;

  /**
   * Handle session termination
   */
  endSession(): Promise<void>;
}