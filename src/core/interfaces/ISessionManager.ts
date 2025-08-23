import { SupportedLanguage } from '../../types';

/**
 * Options for creating a query session
 */
export interface SessionOptions {
  language?: SupportedLanguage;
  defaultMode?: 'direct' | 'step' | 'raw' | 'template';
  showConfidenceThreshold?: number;
  allowEditing?: boolean;
  maxRegenerationAttempts?: number;
}

/**
 * Represents an active query session
 */
export interface IQuerySession {
  sessionId: string;
  options: SessionOptions;
  queryHistory: string[];
  detailedHistory: Array<{
    query: string;
    timestamp: Date;
    confidence: number;
    action: 'generated' | 'edited' | 'regenerated';
    reason?: string;
  }>;
  
  /**
   * Add a query to the session history
   */
  addToHistory(query: string, confidence: number, action: 'generated' | 'edited' | 'regenerated', reason?: string): void;
  
  /**
   * Get query history
   */
  getHistory(): string[];
  
  /**
   * Get detailed history
   */
  getDetailedHistory(): Array<{
    query: string;
    timestamp: Date;
    confidence: number;
    action: 'generated' | 'edited' | 'regenerated';
    reason?: string;
  }>;
}

/**
 * Session manager for handling interactive sessions
 */
export interface ISessionManager {
  /**
   * Create a new query session
   */
  createSession(options: SessionOptions): Promise<IQuerySession>;
  
  /**
   * Get an existing session
   */
  getSession(sessionId: string): Promise<IQuerySession | null>;
  
  /**
   * Update session options
   */
  updateSessionOptions(sessionId: string, options: Partial<SessionOptions>): Promise<void>;
  
  /**
   * End a session
   */
  endSession(sessionId: string): Promise<void>;
}