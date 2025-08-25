import { OpenAIProvider } from '../../src/providers/ai/OpenAIProvider';
import { AIProviderConfig } from '../../src/core/types/ProviderTypes';
import { QueryGenerationRequest, QueryExplanationRequest, RegenerationRequest, QueryAnalysisRequest } from '../../src/core/interfaces/IAIProvider';

// Mock the openai module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      models: {
        list: jest.fn().mockResolvedValue({ data: [] })
      },
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: { content: '{"kql": "requests | count", "confidence": 0.85, "reasoning": "Test reasoning"}' },
              finish_reason: 'stop'
            }]
          })
        }
      }
    }))
  };
});

describe('OpenAIProvider', () => {
  let mockOpenAIConfig: AIProviderConfig;
  let openAIProvider: OpenAIProvider;

  beforeEach(() => {
    mockOpenAIConfig = {
      type: 'openai',
      apiKey: 'test-api-key',
      model: 'gpt-4'
    };

    openAIProvider = new OpenAIProvider(mockOpenAIConfig);
  });

  describe('constructor', () => {
    it('should create OpenAIProvider with valid config', () => {
      expect(openAIProvider).toBeInstanceOf(OpenAIProvider);
    });

    it('should throw error for invalid provider type', async () => {
      const invalidConfig = { ...mockOpenAIConfig, type: 'invalid' } as any;
      const provider = new OpenAIProvider(invalidConfig);
      await expect(provider.initialize()).rejects.toThrow('Invalid provider type for OpenAIProvider');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(openAIProvider.initialize()).resolves.not.toThrow();
    });

    it('should throw error if API key is missing', async () => {
      const configWithoutApiKey = { ...mockOpenAIConfig, apiKey: undefined };
      const provider = new OpenAIProvider(configWithoutApiKey);
      
      await expect(provider.initialize()).rejects.toThrow('OpenAI API key is required');
    });
  });

  describe('generateQuery', () => {
    it('should generate KQL query successfully', async () => {
      const request: QueryGenerationRequest = {
        userInput: 'show me all requests from last hour',
        schema: { tables: ['requests'] }
      };

      const result = await openAIProvider.generateQuery(request);

      expect(result).toEqual({
        generatedKQL: 'requests | count',
        confidence: 0.85,
        reasoning: 'Test reasoning'
      });
    });

    it('should handle schema in request', async () => {
      const request: QueryGenerationRequest = {
        userInput: 'show errors',
        schema: { tables: ['exceptions', 'requests'] }
      };

      const result = await openAIProvider.generateQuery(request);
      expect(result.generatedKQL).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('explainQuery', () => {
    it('should explain query successfully', async () => {
      const request: QueryExplanationRequest = {
        query: 'requests | count',
        options: {
          language: 'en',
          technicalLevel: 'intermediate',
          includeExamples: true
        }
      };

      // Mock different response for explanation by creating a fresh mock
      const mockOpenAI = require('openai').default;
      const mockCreateCompletion = jest.fn().mockResolvedValueOnce({
        choices: [{
          message: { content: 'This query counts all requests in the last 24 hours.' },
          finish_reason: 'stop'
        }]
      });
      
      // Override the mock for this test
      mockOpenAI.mockImplementation(() => ({
        models: { list: jest.fn().mockResolvedValue({ data: [] }) },
        chat: { completions: { create: mockCreateCompletion } }
      }));

      // Create a fresh provider instance for this test
      const provider = new OpenAIProvider(mockOpenAIConfig);
      const result = await provider.explainQuery(request);
      expect(result).toBe('This query counts all requests in the last 24 hours.');
    });
  });

  describe('regenerateQuery', () => {
    it('should regenerate query successfully', async () => {
      const request: RegenerationRequest = {
        userInput: 'show me errors',
        context: {
          previousQuery: 'requests | where success == false',
          attemptNumber: 2
        }
      };

      // Mock for regenerate
      const mockOpenAI = require('openai').default;
      const mockCreateCompletion = jest.fn().mockResolvedValueOnce({
        choices: [{
          message: { content: '{"kql": "requests | count", "confidence": 0.85, "reasoning": "Test reasoning"}' },
          finish_reason: 'stop'
        }]
      });
      
      // Override the mock for this test
      mockOpenAI.mockImplementation(() => ({
        models: { list: jest.fn().mockResolvedValue({ data: [] }) },
        chat: { completions: { create: mockCreateCompletion } }
      }));

      // Create a fresh provider instance for this test
      const provider = new OpenAIProvider(mockOpenAIConfig);
      const result = await provider.regenerateQuery(request);

      expect(result).toEqual({
        generatedKQL: 'requests | count',
        confidence: 0.85,
        reasoning: 'Test reasoning'
      });
    });
  });

  describe('generateResponse', () => {
    it('should generate generic response', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreateCompletion = jest.fn().mockResolvedValueOnce({
        choices: [{
          message: { content: 'Generic AI response' },
          finish_reason: 'stop'
        }]
      });
      
      // Override the mock for this test
      mockOpenAI.mockImplementation(() => ({
        models: { list: jest.fn().mockResolvedValue({ data: [] }) },
        chat: { completions: { create: mockCreateCompletion } }
      }));

      // Create a fresh provider instance for this test
      const provider = new OpenAIProvider(mockOpenAIConfig);
      const result = await provider.generateResponse('Test prompt');
      expect(result).toBe('Generic AI response');
    });
  });

  describe('error handling', () => {
    it('should handle OpenAI API errors gracefully', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreateCompletion = jest.fn().mockRejectedValueOnce(new Error('API Error'));
      
      // Override the mock for this test
      mockOpenAI.mockImplementation(() => ({
        models: { list: jest.fn().mockResolvedValue({ data: [] }) },
        chat: { completions: { create: mockCreateCompletion } }
      }));

      // Create a fresh provider instance for this test
      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request: QueryGenerationRequest = {
        userInput: 'test query'
      };

      await expect(provider.generateQuery(request)).rejects.toThrow('KQL generation failed');
    });

    it('should handle invalid JSON responses', async () => {
      const mockOpenAI = require('openai').default;
      const mockCreateCompletion = jest.fn().mockResolvedValueOnce({
        choices: [{
          message: { content: 'invalid json response' },
          finish_reason: 'stop'
        }]
      });
      
      // Override the mock for this test
      mockOpenAI.mockImplementation(() => ({
        models: { list: jest.fn().mockResolvedValue({ data: [] }) },
        chat: { completions: { create: mockCreateCompletion } }
      }));

      // Create a fresh provider instance for this test
      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request: QueryGenerationRequest = {
        userInput: 'test query'
      };

      const result = await provider.generateQuery(request);
      expect(result.generatedKQL).toBe('invalid json response');
      expect(result.confidence).toBe(0.5); // Lower confidence for non-JSON
    });

    it('should handle JSON responses wrapped in markdown code blocks', async () => {
      const mockOpenAI = require('openai').default;
      const jsonContent = `\`\`\`json
{
  "kql": "exceptions | where timestamp > ago(7d) | take 10",
  "confidence": 0.85,
  "reasoning": "The query filters exceptions from the last week and retrieves the top 10 records."
}
\`\`\``;
      
      const mockCreateCompletion = jest.fn().mockResolvedValueOnce({
        choices: [{
          message: { content: jsonContent },
          finish_reason: 'stop'
        }]
      });
      
      // Override the mock for this test
      mockOpenAI.mockImplementation(() => ({
        models: { list: jest.fn().mockResolvedValue({ data: [] }) },
        chat: { completions: { create: mockCreateCompletion } }
      }));

      // Create a fresh provider instance for this test
      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request: QueryGenerationRequest = {
        userInput: 'show me last week exceptions'
      };

      const result = await provider.generateQuery(request);
      expect(result.generatedKQL).toBe('exceptions | where timestamp > ago(7d) | take 10');
      expect(result.reasoning).toBe('The query filters exceptions from the last week and retrieves the top 10 records.');
      expect(result.confidence).toBe(0.85); // Should recognize as valid JSON and use normal confidence
    });
  });

  describe('analyzeQueryResult', () => {
    beforeEach(() => {
      // Reset the mock before each test
      const MockedOpenAI = require('openai').default as jest.MockedClass<typeof import('openai').default>;
      MockedOpenAI.mockClear();
    });

    it('should analyze query result for patterns', async () => {
      // Mock successful pattern analysis response
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              trends: [{ description: 'Increasing trend', confidence: 0.8, visualization: 'line chart' }],
              anomalies: [{ type: 'spike', description: 'Traffic spike at 10am', severity: 'medium', affectedRows: [1, 2] }],
              correlations: [{ columns: ['requests', 'errors'], coefficient: 0.7, significance: 'moderate' }]
            })
          },
          finish_reason: 'stop'
        }]
      };

      const MockedOpenAI = require('openai').default as jest.MockedClass<typeof import('openai').default>;
      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      MockedOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request = {
        result: {
          tables: [{
            columns: [{ name: 'requests', type: 'int' }],
            rows: [[100], [150], [200]]
          }]
        },
        originalQuery: 'requests | count',
        analysisType: 'patterns' as const
      };

      const result = await provider.analyzeQueryResult(request);

      expect(result.patterns).toBeDefined();
      expect(result.patterns?.trends).toHaveLength(1);
      expect(result.patterns?.anomalies).toHaveLength(1);
      expect(result.patterns?.correlations).toHaveLength(1);
      expect(result.recommendations).toBeDefined();
      expect(result.followUpQueries).toBeDefined();
    });

    it('should analyze query result for anomalies only', async () => {
      // Mock successful pattern analysis response
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              trends: [{ description: 'Increasing trend', confidence: 0.8, visualization: 'line chart' }],
              anomalies: [{ type: 'spike', description: 'Traffic spike at 10am', severity: 'high', affectedRows: [5, 6] }],
              correlations: []
            })
          },
          finish_reason: 'stop'
        }]
      };

      const MockedOpenAI = require('openai').default as jest.MockedClass<typeof import('openai').default>;
      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      MockedOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request = {
        result: {
          tables: [{
            columns: [{ name: 'requests', type: 'int' }],
            rows: [[100], [150], [1000]]
          }]
        },
        originalQuery: 'requests | count',
        analysisType: 'anomalies' as const
      };

      const result = await provider.analyzeQueryResult(request);

      expect(result.patterns).toBeDefined();
      expect(result.patterns?.trends).toHaveLength(0); // Should be filtered out for anomalies
      expect(result.patterns?.anomalies).toHaveLength(1);
      expect(result.patterns?.correlations).toHaveLength(0); // Should be filtered out for anomalies
    });

    it('should analyze query result for insights', async () => {
      // Mock successful insights response
      const mockResponse = {
        choices: [{
          message: {
            content: 'Your application shows healthy performance with consistent response times.'
          },
          finish_reason: 'stop'
        }]
      };

      const MockedOpenAI = require('openai').default as jest.MockedClass<typeof import('openai').default>;
      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      MockedOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request = {
        result: {
          tables: [{
            columns: [{ name: 'requests', type: 'int' }, { name: 'duration', type: 'real' }],
            rows: [[100, 250.5], [150, 300.2], [200, 275.8]]
          }]
        },
        originalQuery: 'requests | project requests, duration',
        analysisType: 'insights' as const
      };

      const result = await provider.analyzeQueryResult(request);

      expect(result.insights).toBeDefined();
      expect(result.insights?.dataQuality).toBeDefined();
      expect(result.insights?.businessInsights).toBeDefined();
      expect(result.aiInsights).toBe('Your application shows healthy performance with consistent response times.');
    });

    it('should analyze query result for full analysis', async () => {
      // Mock successful pattern analysis and insights responses
      let callCount = 0;
      const mockCreate = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call for pattern analysis
          return Promise.resolve({
            choices: [{
              message: {
                content: JSON.stringify({
                  trends: [{ description: 'Stable performance', confidence: 0.9, visualization: 'line chart' }],
                  anomalies: [],
                  correlations: []
                })
              },
              finish_reason: 'stop'
            }]
          });
        } else {
          // Second call for AI insights
          return Promise.resolve({
            choices: [{
              message: {
                content: 'Complete analysis shows good system health.'
              },
              finish_reason: 'stop'
            }]
          });
        }
      });

      const MockedOpenAI = require('openai').default as jest.MockedClass<typeof import('openai').default>;
      MockedOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request = {
        result: {
          tables: [{
            columns: [{ name: 'requests', type: 'int' }],
            rows: [[100], [150], [200]]
          }]
        },
        originalQuery: 'requests | count',
        analysisType: 'full' as const
      };

      const result = await provider.analyzeQueryResult(request);

      expect(result.patterns).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(result.aiInsights).toBe('Complete analysis shows good system health.');
      expect(result.recommendations).toBeDefined();
      expect(result.followUpQueries).toBeDefined();
    });

    it('should handle empty result gracefully', async () => {
      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request = {
        result: {
          tables: []
        },
        originalQuery: 'requests | where 1 = 0',
        analysisType: 'insights' as const
      };

      const result = await provider.analyzeQueryResult(request);

      expect(result.insights).toBeDefined();
      expect(result.insights?.dataQuality.completeness).toBe(0);
      expect(result.insights?.dataQuality.consistency).toContain('No data available');
      expect(result.recommendations).toContain('No data returned - consider adjusting your query criteria');
    });

    it('should handle API errors gracefully', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));

      const MockedOpenAI = require('openai').default as jest.MockedClass<typeof import('openai').default>;
      MockedOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request = {
        result: {
          tables: [{
            columns: [{ name: 'requests', type: 'int' }],
            rows: [[100]]
          }]
        },
        originalQuery: 'requests | count',
        analysisType: 'patterns' as const
      };

      const result = await provider.analyzeQueryResult(request);
      
      // Should return empty patterns when pattern analysis fails
      expect(result.patterns).toBeDefined();
      expect(result.patterns?.trends).toHaveLength(0);
      expect(result.patterns?.anomalies).toHaveLength(0);
      expect(result.patterns?.correlations).toHaveLength(0);
      expect(result.recommendations).toBeDefined();
      expect(result.followUpQueries).toBeDefined();
    });

    it('should handle invalid JSON response in pattern analysis', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'invalid json response'
          },
          finish_reason: 'stop'
        }]
      };

      const MockedOpenAI = require('openai').default as jest.MockedClass<typeof import('openai').default>;
      const mockCreate = jest.fn().mockResolvedValue(mockResponse);
      MockedOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      } as any));

      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request = {
        result: {
          tables: [{
            columns: [{ name: 'requests', type: 'int' }],
            rows: [[100]]
          }]
        },
        originalQuery: 'requests | count',
        analysisType: 'patterns' as const
      };

      const result = await provider.analyzeQueryResult(request);

      expect(result.patterns).toBeDefined();
      expect(result.patterns?.trends).toHaveLength(0);
      expect(result.patterns?.anomalies).toHaveLength(0);
      expect(result.patterns?.correlations).toHaveLength(0);
    });

    it('should generate appropriate follow-up queries for temporal data', async () => {
      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request = {
        result: {
          tables: [{
            columns: [{ name: 'timestamp', type: 'datetime' }, { name: 'requests', type: 'int' }],
            rows: [['2024-01-01T10:00:00Z', 100], ['2024-01-01T11:00:00Z', 150]]
          }]
        },
        originalQuery: 'requests | project timestamp, count()',
        analysisType: 'insights' as const
      };

      const result = await provider.analyzeQueryResult(request);

      expect(result.followUpQueries).toBeDefined();
      expect(result.followUpQueries?.some(q => q.purpose.includes('temporal'))).toBe(true);
    });

    it('should throw error for complete AI service failure during insights analysis', async () => {
      // Mock OpenAI client initialization failure
      const MockedOpenAI = require('openai').default as jest.MockedClass<typeof import('openai').default>;
      MockedOpenAI.mockImplementation(() => {
        throw new Error('OpenAI initialization failed');
      });

      const provider = new OpenAIProvider(mockOpenAIConfig);
      const request = {
        result: {
          tables: [{
            columns: [{ name: 'requests', type: 'int' }],
            rows: [[100]]
          }]
        },
        originalQuery: 'requests | count',
        analysisType: 'insights' as const
      };

      await expect(provider.analyzeQueryResult(request)).rejects.toThrow();
    });
  });
});