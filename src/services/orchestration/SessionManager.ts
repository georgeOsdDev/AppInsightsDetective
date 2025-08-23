import { 
  ISessionManager, 
  IQuerySession, 
  SessionOptions 
} from '../../core/interfaces';
import { logger } from '../../utils/logger';

/**
 * Query session implementation
 */
export class QuerySession implements IQuerySession {
  public sessionId: string;
  public options: SessionOptions;
  public queryHistory: string[] = [];
  public detailedHistory: Array<{
    query: string;
    timestamp: Date;
    confidence: number;
    action: 'generated' | 'edited' | 'regenerated';
    reason?: string;
  }> = [];

  constructor(sessionId: string, options: SessionOptions) {
    this.sessionId = sessionId;
    this.options = { ...options };
  }

  /**
   * Add a query to the session history
   */
  addToHistory(query: string, confidence: number, action: 'generated' | 'edited' | 'regenerated', reason?: string): void {
    this.queryHistory.push(query);
    this.detailedHistory.push({
      query,
      timestamp: new Date(),
      confidence,
      action,
      reason
    });

    // Keep history manageable (last 50 queries)
    if (this.queryHistory.length > 50) {
      this.queryHistory = this.queryHistory.slice(-50);
      this.detailedHistory = this.detailedHistory.slice(-50);
    }

    logger.debug(`Added query to session ${this.sessionId} history: ${action}`);
  }

  /**
   * Get query history
   */
  getHistory(): string[] {
    return [...this.queryHistory];
  }

  /**
   * Get detailed history
   */
  getDetailedHistory(): Array<{
    query: string;
    timestamp: Date;
    confidence: number;
    action: 'generated' | 'edited' | 'regenerated';
    reason?: string;
  }> {
    return [...this.detailedHistory];
  }
}

/**
 * Session manager implementation
 */
export class SessionManager implements ISessionManager {
  private sessions = new Map<string, IQuerySession>();
  private sessionCounter = 0;

  /**
   * Create a new query session
   */
  async createSession(options: SessionOptions): Promise<IQuerySession> {
    const sessionId = `session_${++this.sessionCounter}_${Date.now()}`;
    
    const session = new QuerySession(sessionId, {
      language: 'auto',
      defaultMode: 'step',
      showConfidenceThreshold: 0.7,
      allowEditing: true,
      maxRegenerationAttempts: 3,
      ...options
    });

    this.sessions.set(sessionId, session);
    
    logger.info(`Created new query session: ${sessionId}`);
    return session;
  }

  /**
   * Get an existing session
   */
  async getSession(sessionId: string): Promise<IQuerySession | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.warn(`Session not found: ${sessionId}`);
      return null;
    }

    return session;
  }

  /**
   * Update session options
   */
  async updateSessionOptions(sessionId: string, options: Partial<SessionOptions>): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update session options
    session.options = {
      ...session.options,
      ...options
    };

    logger.info(`Updated session ${sessionId} options`);
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      logger.warn(`Attempted to end non-existent session: ${sessionId}`);
      return;
    }

    this.sessions.delete(sessionId);
    logger.info(`Ended session: ${sessionId}`);
  }

  /**
   * Get session count (for monitoring/debugging)
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Clean up old sessions (for memory management)
   */
  cleanupOldSessions(maxAge: number = 24 * 60 * 60 * 1000): void { // Default 24 hours
    const now = Date.now();
    const sessionsToDelete: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivity = session.detailedHistory.length > 0 
        ? session.detailedHistory[session.detailedHistory.length - 1].timestamp.getTime()
        : now; // If no history, consider it as recent activity

      if (now - lastActivity > maxAge) {
        sessionsToDelete.push(sessionId);
      }
    }

    for (const sessionId of sessionsToDelete) {
      this.sessions.delete(sessionId);
      logger.info(`Cleaned up old session: ${sessionId}`);
    }

    if (sessionsToDelete.length > 0) {
      logger.info(`Cleaned up ${sessionsToDelete.length} old sessions`);
    }
  }
}