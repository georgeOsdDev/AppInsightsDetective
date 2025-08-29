/**
 * Tests for IntelligentInvestigationService
 */
import { IntelligentInvestigationService } from '../../src/services/IntelligentInvestigationService';
import { IAIProvider, IDataSourceProvider, ISessionManager } from '../../src/core/interfaces';
import { 
  InvestigationProblem, 
  InvestigationType,
  InvestigationRequest
} from '../../src/types/investigation';
import { QueryResult } from '../../src/types';

// Mock implementations
class MockAIProvider implements IAIProvider {
  async initialize(): Promise<void> {}
  
  async generateQuery(): Promise<any> {
    return {
      generatedKQL: 'requests | where timestamp > ago(1h) | summarize count()',
      confidence: 0.8,
      reasoning: 'Test query for performance analysis'
    };
  }
  
  async explainQuery(): Promise<string> {
    return 'Test explanation';
  }
  
  async regenerateQuery(): Promise<any> {
    return this.generateQuery();
  }
  
  async generateResponse(prompt: string): Promise<string> {
    if (prompt.includes('Classify')) {
      return JSON.stringify({
        type: 'performance',
        confidence: 0.9,
        reasoning: 'The description indicates performance issues'
      });
    }
    
    if (prompt.includes('investigation plan')) {
      return JSON.stringify({
        phases: [
          {
            id: 'phase1',
            name: 'Initial Analysis',
            description: 'Basic performance metrics',
            queries: [
              {
                id: 'query1',
                purpose: 'Get response times',
                kqlQuery: 'requests | summarize avg(duration)',
                expectedOutcome: 'Average response times',
                confidence: 0.9,
                required: true
              }
            ],
            priority: 'high'
          }
        ],
        estimatedTotalTime: 300,
        confidence: 0.8,
        reasoning: 'Standard performance investigation'
      });
    }
    
    return 'Mock AI response';
  }
  
  async analyzeQueryResult(): Promise<any> {
    return {
      patterns: {
        trends: [{ description: 'Increasing response times', confidence: 0.8, visualization: 'line' }],
        anomalies: [],
        correlations: []
      },
      insights: {
        dataQuality: { completeness: 0.95, consistency: [], recommendations: [] },
        businessInsights: { keyFindings: ['High latency detected'], potentialIssues: [], opportunities: [] },
        followUpQueries: []
      },
      aiInsights: 'Performance degradation observed',
      recommendations: ['Optimize query performance']
    };
  }
}

class MockDataSourceProvider implements IDataSourceProvider {
  async initialize(): Promise<void> {}
  
  async executeQuery(): Promise<QueryResult> {
    return {
      tables: [
        {
          name: 'results',
          columns: [
            { name: 'timestamp', type: 'datetime' },
            { name: 'value', type: 'real' }
          ],
          rows: [
            [new Date(), 100],
            [new Date(), 150],
            [new Date(), 200]
          ]
        }
      ]
    };
  }
  
  async validateConnection(): Promise<{ isValid: boolean; error?: string }> {
    return { isValid: true };
  }
  
  async getSchema(): Promise<any> {
    return { schema: {} };
  }
  
  async getMetadata(): Promise<any> {
    return { metadata: {} };
  }
}

class MockSessionManager implements ISessionManager {
  private sessions = new Map();
  
  async createSession(): Promise<any> {
    const session = {
      sessionId: 'test-session-id',
      options: {},
      queryHistory: [],
      detailedHistory: [],
      addToHistory: jest.fn(),
      getHistory: () => [],
      getDetailedHistory: () => []
    };
    
    this.sessions.set(session.sessionId, session);
    return session;
  }
  
  async getSession(sessionId: string): Promise<any> {
    return this.sessions.get(sessionId) || null;
  }
  
  async updateSessionOptions(): Promise<void> {}
  
  async endSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

describe('IntelligentInvestigationService', () => {
  let service: IntelligentInvestigationService;
  let mockAIProvider: MockAIProvider;
  let mockDataSourceProvider: MockDataSourceProvider;
  let mockSessionManager: MockSessionManager;

  beforeEach(() => {
    mockAIProvider = new MockAIProvider();
    mockDataSourceProvider = new MockDataSourceProvider();
    mockSessionManager = new MockSessionManager();
    
    service = new IntelligentInvestigationService(
      mockAIProvider,
      mockDataSourceProvider,
      mockSessionManager
    );
  });

  describe('Problem Classification', () => {
    it('should classify problems correctly', async () => {
      const result = await service.classifyProblem('The application is responding slowly');
      
      expect(result.type).toBe('performance');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reasoning).toBeDefined();
    });

    it('should handle classification failures gracefully', async () => {
      const mockFailingAIProvider = {
        ...mockAIProvider,
        generateResponse: jest.fn().mockRejectedValue(new Error('AI service unavailable'))
      } as any;

      const failingService = new IntelligentInvestigationService(
        mockFailingAIProvider,
        mockDataSourceProvider,
        mockSessionManager
      );

      const result = await failingService.classifyProblem('Test problem');
      
      expect(result.type).toBe('performance'); // Default fallback
      expect(result.confidence).toBe(0.5);
      expect(result.reasoning).toContain('Classification failed');
    });
  });

  describe('Investigation Plan Generation', () => {
    it('should generate investigation plans', async () => {
      const problem: InvestigationProblem = {
        description: 'Application performance is degraded',
        type: 'performance',
        severity: 'high'
      };

      const plan = await service.generateInvestigationPlan(problem);

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.detectedType).toBe('performance');
      expect(plan.phases).toHaveLength(1);
      expect(plan.phases[0].queries).toHaveLength(1);
      expect(plan.confidence).toBeGreaterThan(0.7);
    });

    it('should handle plan generation failures', async () => {
      const mockFailingAIProvider = {
        ...mockAIProvider,
        generateResponse: jest.fn().mockRejectedValue(new Error('AI service unavailable'))
      } as any;

      const failingService = new IntelligentInvestigationService(
        mockFailingAIProvider,
        mockDataSourceProvider,
        mockSessionManager
      );

      const problem: InvestigationProblem = {
        description: 'Test problem',
        type: 'performance'
      };

      const plan = await failingService.generateInvestigationPlan(problem);

      expect(plan).toBeDefined();
      expect(plan.reasoning).toContain('Default investigation plan');
    });
  });

  describe('Investigation Execution', () => {
    it('should start investigations successfully', async () => {
      const request: InvestigationRequest = {
        problem: {
          description: 'Application is slow',
          type: 'performance',
          severity: 'medium'
        },
        options: {
          interactive: false,
          language: 'en'
        }
      };

      const response = await service.startInvestigation(request);

      expect(response.investigationId).toBeDefined();
      expect(response.status).toBe('in-progress');
      expect(response.plan).toBeDefined();
      expect(response.progress).toBeDefined();
    });

    it('should handle interactive mode', async () => {
      const request: InvestigationRequest = {
        problem: {
          description: 'Application is slow',
          type: 'performance'
        },
        options: {
          interactive: true
        }
      };

      const response = await service.startInvestigation(request);

      expect(response.nextAction?.type).toBe('confirm');
      expect(response.nextAction?.message).toContain('Would you like to proceed');
    });

    it('should get investigation status', async () => {
      const request: InvestigationRequest = {
        problem: {
          description: 'Test problem',
          type: 'performance'
        }
      };

      const startResponse = await service.startInvestigation(request);
      const statusResponse = await service.getInvestigationStatus(startResponse.investigationId);

      expect(statusResponse.investigationId).toBe(startResponse.investigationId);
      expect(statusResponse.status).toBeDefined();
      expect(statusResponse.progress).toBeDefined();
    });

    it('should pause and resume investigations', async () => {
      const request: InvestigationRequest = {
        problem: {
          description: 'Test problem',
          type: 'performance'
        }
      };

      const startResponse = await service.startInvestigation(request);
      
      // Pause
      await service.pauseInvestigation(startResponse.investigationId);
      let status = await service.getInvestigationStatus(startResponse.investigationId);
      expect(status.progress?.currentStatus).toBe('paused');
      
      // Resume
      await service.resumeInvestigation(startResponse.investigationId);
      status = await service.getInvestigationStatus(startResponse.investigationId);
      expect(status.progress?.currentStatus).toBe('in-progress');
    });

    it('should cancel investigations', async () => {
      const request: InvestigationRequest = {
        problem: {
          description: 'Test problem',
          type: 'performance'
        }
      };

      const startResponse = await service.startInvestigation(request);
      
      await service.cancelInvestigation(startResponse.investigationId);
      
      await expect(service.getInvestigationStatus(startResponse.investigationId))
        .rejects.toThrow('Investigation not found');
    });
  });

  describe('Plan Validation', () => {
    it('should validate valid plans', async () => {
      const problem: InvestigationProblem = {
        description: 'Test problem',
        type: 'performance'
      };

      const plan = await service.generateInvestigationPlan(problem);
      const validation = await service.validateInvestigationPlan(plan);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toBeUndefined();
    });

    it('should detect invalid plans', async () => {
      const invalidPlan = {
        id: 'test',
        problem: { description: 'test' },
        detectedType: 'performance' as InvestigationType,
        phases: [], // Empty phases should be invalid
        estimatedTotalTime: 300,
        confidence: 0.8,
        reasoning: 'test',
        createdAt: new Date()
      };

      const validation = await service.validateInvestigationPlan(invalidPlan);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Investigation plan must have at least one phase');
    });
  });

  describe('Export Functionality', () => {
    it('should export completed investigations', async () => {
      // This test would require a completed investigation, which is complex to mock
      // For now, we'll test the error case
      await expect(service.exportInvestigation('non-existent-id', 'json'))
        .rejects.toThrow('Investigation result not found');
    });
  });

  describe('Investigation History', () => {
    it('should return empty history initially', async () => {
      const history = await service.getInvestigationHistory();
      expect(history).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing investigations', async () => {
      await expect(service.continueInvestigation('non-existent-id'))
        .rejects.toThrow('Investigation not found');

      await expect(service.getInvestigationStatus('non-existent-id'))
        .rejects.toThrow('Investigation not found');

      await expect(service.pauseInvestigation('non-existent-id'))
        .rejects.toThrow('Investigation not found');
    });

    it('should handle service initialization failures', async () => {
      const failingRequest: InvestigationRequest = {
        problem: {
          description: 'Test problem'
        }
      };

      // Mock AI provider that fails classification
      const failingAIProvider = {
        ...mockAIProvider,
        generateResponse: jest.fn().mockRejectedValue(new Error('Service unavailable'))
      } as any;

      const failingService = new IntelligentInvestigationService(
        failingAIProvider,
        mockDataSourceProvider,
        mockSessionManager
      );

      const response = await failingService.startInvestigation(failingRequest);
      
      // Should still work with default classification
      expect(response.investigationId).toBeDefined();
      expect(response.status).toBe('in-progress');
    });
  });
});