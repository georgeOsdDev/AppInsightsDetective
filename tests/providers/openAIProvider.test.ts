import { OpenAIProvider } from '../../src/providers/ai/OpenAIProvider';
import { AIProviderConfig } from '../../src/core/types/ProviderTypes';
import { QueryGenerationRequest, QueryExplanationRequest, RegenerationRequest } from '../../src/core/interfaces/IAIProvider';

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

    it('should throw error for invalid provider type', () => {
      const invalidConfig = { ...mockOpenAIConfig, type: 'invalid' } as any;
      expect(() => new OpenAIProvider(invalidConfig)).toThrow('Invalid provider type for OpenAIProvider');
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
  });
});