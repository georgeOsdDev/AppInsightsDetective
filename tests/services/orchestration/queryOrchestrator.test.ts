import { QueryOrchestrator } from '../../../src/services/orchestration/QueryOrchestrator';
import { IAIProvider, IDataSourceProvider, ITemplateRepository, QueryTemplate, TemplateParameters } from '../../../src/core/interfaces';
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

// Mock Template Repository
const mockTemplate: QueryTemplate = {
  id: 'test-template',
  name: 'Test Template',
  description: 'A test template',
  category: 'Testing',
  kqlTemplate: 'requests | where timestamp > ago({{timespan}}) | take {{limit}}',
  parameters: [
    {
      name: 'timespan',
      type: 'timespan',
      description: 'Time period',
      required: true,
      defaultValue: '1h'
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Row limit',
      required: false,
      defaultValue: 100
    }
  ],
  metadata: {
    author: 'Test Author',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['test']
  }
};

const mockTemplateRepository: ITemplateRepository = {
  getTemplate: jest.fn().mockResolvedValue(mockTemplate),
  getTemplates: jest.fn().mockResolvedValue([mockTemplate]),
  saveTemplate: jest.fn().mockResolvedValue(undefined),
  deleteTemplate: jest.fn().mockResolvedValue(true),
  searchTemplates: jest.fn().mockResolvedValue([mockTemplate]),
  applyTemplate: jest.fn().mockResolvedValue('requests | where timestamp > ago(1h) | take 100'),
  getCategories: jest.fn().mockResolvedValue(['Testing']),
  initialize: jest.fn().mockResolvedValue(undefined),
  validateTemplate: jest.fn().mockReturnValue(undefined),
  getPromptTemplates: jest.fn().mockResolvedValue([]),
  getPromptTemplate: jest.fn().mockResolvedValue(null),
  savePromptTemplate: jest.fn().mockResolvedValue(undefined),
  deletePromptTemplate: jest.fn().mockResolvedValue(true),
  applyPromptTemplate: jest.fn().mockResolvedValue('Focus on performance analysis'),
  validatePromptTemplate: jest.fn().mockReturnValue(undefined)
};

describe('QueryOrchestrator', () => {
  let orchestrator: QueryOrchestrator;
  let orchestratorWithTemplates: QueryOrchestrator;

  beforeEach(() => {
    // Reset all mocks to their original implementations
    jest.clearAllMocks();
    
    // Re-setup the mock implementations
    (mockDataSourceProvider.executeQuery as jest.Mock).mockResolvedValue({
      tables: [{
        name: 'PrimaryResult',
        columns: [{ name: 'timestamp', type: 'datetime' }],
        rows: [['2024-01-01T00:00:00Z']]
      }]
    });
    
    orchestrator = new QueryOrchestrator(mockAIProvider, mockDataSourceProvider);
    orchestratorWithTemplates = new QueryOrchestrator(mockAIProvider, mockDataSourceProvider, mockTemplateRepository);
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
    it('should throw error when template repository is not configured', async () => {
      const request = {
        templateId: 'test-template',
        parameters: {}
      };

      await expect(orchestrator.executeTemplateQuery(request)).rejects.toThrow('Template repository is not configured');
    });

    it('should execute template query successfully', async () => {
      const request = {
        templateId: 'test-template',
        parameters: {
          timespan: '2h',
          limit: 50
        }
      };

      const result = await orchestratorWithTemplates.executeTemplateQuery(request);

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('executionTime');
      expect(mockTemplateRepository.getTemplate).toHaveBeenCalledWith('test-template');
      expect(mockTemplateRepository.applyTemplate).toHaveBeenCalledWith(mockTemplate, request.parameters);
      expect(mockDataSourceProvider.executeQuery).toHaveBeenCalledWith({
        query: 'requests | where timestamp > ago(1h) | take 100'
      });
    });

    it('should throw error when template not found', async () => {
      const request = {
        templateId: 'nonexistent-template',
        parameters: {}
      };

      (mockTemplateRepository.getTemplate as jest.Mock).mockResolvedValueOnce(null);

      await expect(orchestratorWithTemplates.executeTemplateQuery(request)).rejects.toThrow('Template not found: nonexistent-template');
    });

    it('should handle template application errors', async () => {
      const request = {
        templateId: 'test-template',
        parameters: {}
      };

      (mockTemplateRepository.applyTemplate as jest.Mock).mockRejectedValueOnce(new Error('Invalid parameters'));

      await expect(orchestratorWithTemplates.executeTemplateQuery(request)).rejects.toThrow('Template query execution failed');
    });
  });
});