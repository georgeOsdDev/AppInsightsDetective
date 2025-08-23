import { QueryOrchestrator } from '../../../src/services/orchestration/QueryOrchestrator';
import { IAIProvider, IDataSourceProvider } from '../../../src/core/interfaces';
import { NLQuery, QueryResult } from '../../../src/types';

// Mock AI Provider
const mockAIProvider: IAIProvider = {
  initialize: jest.fn().mockResolvedValue(undefined),
  generateQuery: jest.fn().mockResolvedValue({
    generatedKQL: 'requests | take 10',
    confidence: 0.8,
    reasoning: 'Simple request query'
  } as NLQuery),
  explainQuery: jest.fn().mockResolvedValue('This query gets 10 requests'),
  regenerateQuery: jest.fn().mockResolvedValue({
    generatedKQL: 'requests | take 20',
    confidence: 0.7,
    reasoning: 'Modified request query'
  } as NLQuery),
  generateResponse: jest.fn().mockResolvedValue('Generated response'),
  analyzeQueryResult: jest.fn().mockResolvedValue({
    insights: {
      dataQuality: {
        completeness: 95,
        consistency: ['good'],
        recommendations: ['use indexes']
      },
      businessInsights: {
        keyFindings: ['peak usage'],
        potentialIssues: ['slow queries'],
        opportunities: ['optimize']
      },
      followUpQueries: []
    }
  })
};

// Mock Data Source Provider
const mockDataSourceProvider: IDataSourceProvider = {
  executeQuery: jest.fn().mockResolvedValue({
    tables: [{
      name: 'PrimaryResult',
      columns: [{ name: 'timestamp', type: 'datetime' }],
      rows: [['2024-01-01T00:00:00Z']]
    }]
  } as QueryResult),
  validateConnection: jest.fn().mockResolvedValue({ isValid: true }),
  getSchema: jest.fn().mockResolvedValue({
    tables: ['requests', 'dependencies'],
    schema: {}
  }),
  getMetadata: jest.fn().mockResolvedValue({
    tables: [],
    metadata: {}
  })
};

describe('QueryOrchestrator', () => {
  let orchestrator: QueryOrchestrator;

  beforeEach(() => {
    orchestrator = new QueryOrchestrator(mockAIProvider, mockDataSourceProvider);
    jest.clearAllMocks();
  });

  describe('executeNaturalLanguageQuery', () => {
    it('should generate and execute a query from natural language', async () => {
      const request = {
        userInput: 'show me recent requests',
        schema: { tables: ['requests'] }
      };

      const result = await orchestrator.executeNaturalLanguageQuery(request);

      expect(mockAIProvider.generateQuery).toHaveBeenCalledWith(request);
      expect(mockDataSourceProvider.executeQuery).toHaveBeenCalledWith({
        query: 'requests | take 10'
      });
      expect(result).toEqual({
        result: expect.objectContaining({
          tables: expect.any(Array)
        }),
        executionTime: expect.any(Number)
      });
    });

    it('should handle execution errors', async () => {
      const request = {
        userInput: 'invalid query',
        schema: null
      };

      mockAIProvider.generateQuery = jest.fn().mockRejectedValue(new Error('AI generation failed'));

      await expect(orchestrator.executeNaturalLanguageQuery(request)).rejects.toThrow('Query execution failed: Error: AI generation failed');
    });
  });

  describe('executeRawQuery', () => {
    it('should execute raw KQL query directly', async () => {
      const query = 'requests | count';

      const result = await orchestrator.executeRawQuery(query);

      expect(mockDataSourceProvider.executeQuery).toHaveBeenCalledWith({ query });
      expect(result).toEqual({
        result: expect.objectContaining({
          tables: expect.any(Array)
        }),
        executionTime: expect.any(Number)
      });
    });

    it('should handle raw query execution errors', async () => {
      const query = 'invalid | syntax';

      mockDataSourceProvider.executeQuery = jest.fn().mockRejectedValue(new Error('Invalid query'));

      await expect(orchestrator.executeRawQuery(query)).rejects.toThrow('Raw query execution failed: Error: Invalid query');
    });
  });

  describe('validateQuery', () => {
    it('should validate a basic query', async () => {
      const query = 'requests | take 10';

      const result = await orchestrator.validateQuery(query);

      expect(result.isValid).toBe(true);
    });

    it('should reject empty queries', async () => {
      const query = '';

      const result = await orchestrator.validateQuery(query);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Query cannot be empty');
    });

    it('should reject potentially dangerous queries', async () => {
      const query = 'drop table requests';

      const result = await orchestrator.validateQuery(query);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Potentially dangerous operation detected: drop');
    });
  });

  describe('executeTemplateQuery', () => {
    it('should throw not implemented error', async () => {
      const request = {
        templateId: 'test-template',
        parameters: {}
      };

      await expect(orchestrator.executeTemplateQuery(request)).rejects.toThrow('Template queries are not yet implemented');
    });
  });
});