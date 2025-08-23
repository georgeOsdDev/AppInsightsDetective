import { SessionManager } from '../../../src/services/orchestration/SessionManager';
import { SessionOptions } from '../../../src/core/interfaces';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('createSession', () => {
    it('should create a new session with default options', async () => {
      const options: SessionOptions = {
        language: 'en',
        defaultMode: 'step'
      };

      const session = await sessionManager.createSession(options);

      expect(session.sessionId).toMatch(/^session_\d+_\d+$/);
      expect(session.options.language).toBe('en');
      expect(session.options.defaultMode).toBe('step');
      expect(session.options.showConfidenceThreshold).toBe(0.7);
      expect(session.queryHistory).toEqual([]);
      expect(session.detailedHistory).toEqual([]);
    });

    it('should create a session with custom options', async () => {
      const options: SessionOptions = {
        language: 'ja',
        defaultMode: 'direct',
        showConfidenceThreshold: 0.8,
        allowEditing: false,
        maxRegenerationAttempts: 5
      };

      const session = await sessionManager.createSession(options);

      expect(session.options.language).toBe('ja');
      expect(session.options.defaultMode).toBe('direct');
      expect(session.options.showConfidenceThreshold).toBe(0.8);
      expect(session.options.allowEditing).toBe(false);
      expect(session.options.maxRegenerationAttempts).toBe(5);
    });
  });

  describe('getSession', () => {
    it('should return existing session', async () => {
      const createdSession = await sessionManager.createSession({});
      const sessionId = createdSession.sessionId;

      const retrievedSession = await sessionManager.getSession(sessionId);

      expect(retrievedSession).toBe(createdSession);
      expect(retrievedSession!.sessionId).toBe(sessionId);
    });

    it('should return null for non-existent session', async () => {
      const result = await sessionManager.getSession('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateSessionOptions', () => {
    it('should update existing session options', async () => {
      const session = await sessionManager.createSession({ language: 'en' });
      
      await sessionManager.updateSessionOptions(session.sessionId, {
        language: 'ja',
        defaultMode: 'direct'
      });

      const updatedSession = await sessionManager.getSession(session.sessionId);
      expect(updatedSession!.options.language).toBe('ja');
      expect(updatedSession!.options.defaultMode).toBe('direct');
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionManager.updateSessionOptions('non-existent', { language: 'en' })
      ).rejects.toThrow('Session not found: non-existent');
    });
  });

  describe('endSession', () => {
    it('should end an existing session', async () => {
      const session = await sessionManager.createSession({});
      const sessionId = session.sessionId;

      await sessionManager.endSession(sessionId);

      const retrievedSession = await sessionManager.getSession(sessionId);
      expect(retrievedSession).toBeNull();
    });

    it('should handle ending non-existent session gracefully', async () => {
      // Should not throw
      await expect(sessionManager.endSession('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('session history', () => {
    it('should add queries to session history', async () => {
      const session = await sessionManager.createSession({});

      session.addToHistory('requests | take 10', 0.8, 'generated', 'Initial query');
      session.addToHistory('requests | count', 0.9, 'edited', 'User edited query');

      expect(session.getHistory()).toEqual([
        'requests | take 10',
        'requests | count'
      ]);

      const detailedHistory = session.getDetailedHistory();
      expect(detailedHistory).toHaveLength(2);
      expect(detailedHistory[0].query).toBe('requests | take 10');
      expect(detailedHistory[0].confidence).toBe(0.8);
      expect(detailedHistory[0].action).toBe('generated');
      expect(detailedHistory[1].query).toBe('requests | count');
      expect(detailedHistory[1].confidence).toBe(0.9);
      expect(detailedHistory[1].action).toBe('edited');
    });

    it('should limit history size', async () => {
      const session = await sessionManager.createSession({});

      // Add more than 50 queries
      for (let i = 0; i < 55; i++) {
        session.addToHistory(`query ${i}`, 0.8, 'generated');
      }

      expect(session.getHistory()).toHaveLength(50);
      expect(session.getDetailedHistory()).toHaveLength(50);
      // Should keep the latest 50
      expect(session.getHistory()[0]).toBe('query 5');
      expect(session.getHistory()[49]).toBe('query 54');
    });
  });

  describe('session cleanup', () => {
    it('should clean up old sessions', async () => {
      const session1 = await sessionManager.createSession({});
      const session2 = await sessionManager.createSession({});

      // Add old history to session1
      session1.addToHistory('old query', 0.8, 'generated');
      // Manually set old timestamp
      session1.detailedHistory[0].timestamp = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

      // Add recent history to session2
      session2.addToHistory('new query', 0.8, 'generated');

      // Cleanup sessions older than 24 hours
      sessionManager.cleanupOldSessions(24 * 60 * 60 * 1000);

      // session1 should be cleaned up, session2 should remain
      expect(await sessionManager.getSession(session1.sessionId)).toBeNull();
      expect(await sessionManager.getSession(session2.sessionId)).not.toBeNull();
    });

    it('should return active session count', async () => {
      expect(sessionManager.getActiveSessionCount()).toBe(0);

      await sessionManager.createSession({});
      expect(sessionManager.getActiveSessionCount()).toBe(1);

      await sessionManager.createSession({});
      expect(sessionManager.getActiveSessionCount()).toBe(2);
    });
  });
});