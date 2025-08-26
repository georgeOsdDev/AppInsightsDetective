import { OllamaProvider } from '../../src/providers/ai/OllamaProvider';
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

describe('OllamaProvider', () => {
  let mockOllamaConfig: AIProviderConfig;
  let ollamaProvider: OllamaProvider;

  beforeEach(() => {
    mockOllamaConfig = {
      type: 'ollama',
      endpoint: 'http://localhost:11434/v1',
      model: 'phi3:latest',
      apiKey: 'ollama'
    };

    ollamaProvider = new OllamaProvider(mockOllamaConfig);
  });

  describe('constructor', () => {
    it('should create OllamaProvider with valid config', () => {
      expect(ollamaProvider).toBeInstanceOf(OllamaProvider);
    });

    it('should throw error for invalid provider type', async () => {
      const invalidConfig = { ...mockOllamaConfig, type: 'invalid' } as any;
      const provider = new OllamaProvider(invalidConfig);
      await expect(provider.initialize()).rejects.toThrow('Invalid provider type for OllamaProvider');
    });

    it('should use default endpoint when not provided', async () => {
      const configWithoutEndpoint = { ...mockOllamaConfig };
      delete configWithoutEndpoint.endpoint;
      const provider = new OllamaProvider(configWithoutEndpoint);
      await expect(provider.initialize()).resolves.toBeUndefined();
    });

    it('should use default model when not provided', async () => {
      const configWithoutModel = { ...mockOllamaConfig };
      delete configWithoutModel.model;
      const provider = new OllamaProvider(configWithoutModel);
      await expect(provider.initialize()).resolves.toBeUndefined();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(ollamaProvider.initialize()).resolves.toBeUndefined();
    });

    it('should initialize with default endpoint if not provided', async () => {
      const configWithoutEndpoint = { ...mockOllamaConfig };
      delete configWithoutEndpoint.endpoint;
      const provider = new OllamaProvider(configWithoutEndpoint);
      await expect(provider.initialize()).resolves.toBeUndefined();
    });

    it('should only initialize once', async () => {
      await ollamaProvider.initialize();
      await ollamaProvider.initialize(); // Second call should not throw
      expect(ollamaProvider).toBeDefined();
    });
  });

  describe('generateQuery', () => {
    it('should generate KQL query successfully', async () => {
      const request: QueryGenerationRequest = {
        userInput: 'Show me errors',
        schema: {},
        language: 'en'
      };

      const result = await ollamaProvider.generateQuery(request);

      expect(result).toEqual({
        generatedKQL: 'requests | count',
        confidence: expect.any(Number),
        reasoning: expect.any(String)
      });
    });

    it('should throw error if not initialized', async () => {
      const request: QueryGenerationRequest = {
        userInput: 'Show me errors'
      };

      const uninitializedProvider = new OllamaProvider(mockOllamaConfig);
      // Manually set client to null to simulate uninitialized state
      (uninitializedProvider as any).openAIClient = null;
      (uninitializedProvider as any).initializationPromise = Promise.resolve();

      await expect(uninitializedProvider.generateQuery(request)).rejects.toThrow('Ollama client not initialized');
    });
  });

  describe('explainQuery', () => {
    it('should explain KQL query successfully', async () => {
      const request: QueryExplanationRequest = {
        query: 'requests | count',
        options: {
          language: 'en',
          technicalLevel: 'intermediate'
        }
      };

      const result = await ollamaProvider.explainQuery(request);
      expect(result).toBe('{"kql": "requests | count", "confidence": 0.85, "reasoning": "Test reasoning"}');
    });
  });

  describe('regenerateQuery', () => {
    it('should regenerate KQL query successfully', async () => {
      const request: RegenerationRequest = {
        userInput: 'Show me errors',
        context: {
          previousQuery: 'requests | limit 10',
          attemptNumber: 2
        },
        schema: {},
        language: 'en'
      };

      const result = await ollamaProvider.regenerateQuery(request);

      expect(result).toEqual({
        generatedKQL: 'requests | count',
        confidence: expect.any(Number),
        reasoning: expect.any(String)
      });
    });
  });

  describe('generateResponse', () => {
    it('should generate response successfully', async () => {
      const prompt = 'Analyze this data';
      const result = await ollamaProvider.generateResponse(prompt);
      expect(result).toBe('{"kql": "requests | count", "confidence": 0.85, "reasoning": "Test reasoning"}');
    });
  });

  describe('analyzeQueryResult', () => {
    it('should analyze query results successfully', async () => {
      const request: QueryAnalysisRequest = {
        result: {
          tables: [{
            name: 'PrimaryResult',
            columns: [{ name: 'count', type: 'long' }],
            rows: [[100]]
          }]
        },
        originalQuery: 'requests | count',
        analysisType: 'full'
      };

      const result = await ollamaProvider.analyzeQueryResult(request);

      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('aiInsights');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('followUpQueries');
    });

    it('should handle empty result sets', async () => {
      const request: QueryAnalysisRequest = {
        result: { tables: [] },
        originalQuery: 'requests | count',
        analysisType: 'insights'
      };

      const result = await ollamaProvider.analyzeQueryResult(request);

      expect(result.insights).toHaveProperty('dataQuality');
      expect(result.insights?.dataQuality.completeness).toBe(0);
      expect(result.insights?.businessInsights.potentialIssues).toContain('No data returned');
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock API error
      const mockOpenAI = require('openai').default;
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      }));

      const provider = new OllamaProvider(mockOllamaConfig);
      const request: QueryGenerationRequest = {
        userInput: 'Show me errors'
      };

      await expect(provider.generateQuery(request)).rejects.toThrow('KQL generation failed');
    });

    it('should handle initialization errors', async () => {
      const invalidConfig = { ...mockOllamaConfig, type: 'invalid' } as any;
      const provider = new OllamaProvider(invalidConfig);
      
      await expect(provider.initialize()).rejects.toThrow('Invalid provider type for OllamaProvider');
    });
  });

  describe('response parsing', () => {
    it('should extract KQL from JSON response', () => {
      const provider = new OllamaProvider(mockOllamaConfig);
      const response = '{"kql": "requests | count", "reasoning": "Test"}';
      const kql = (provider as any).extractKQLFromResponse(response);
      expect(kql).toBe('requests | count');
    });

    it('should extract KQL from markdown code blocks', () => {
      const provider = new OllamaProvider(mockOllamaConfig);
      const response = '```json\n{"kql": "requests | count"}\n```';
      const kql = (provider as any).extractKQLFromResponse(response);
      expect(kql).toBe('requests | count');
    });

    it('should extract reasoning from response', () => {
      const provider = new OllamaProvider(mockOllamaConfig);
      const response = '{"reasoning": "This query counts requests"}';
      const reasoning = (provider as any).extractReasoningFromResponse(response);
      expect(reasoning).toBe('This query counts requests');
    });

    it('should provide default reasoning when not available', () => {
      const provider = new OllamaProvider(mockOllamaConfig);
      const response = 'invalid json';
      const reasoning = (provider as any).extractReasoningFromResponse(response);
      expect(reasoning).toBe('Generated by Ollama (local LLM, non-JSON response)');
    });
  });
});