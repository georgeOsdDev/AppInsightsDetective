import { AIService } from '../../src/services/aiService';
import { AuthService } from '../../src/services/authService';
import { ConfigManager } from '../../src/utils/config';
import OpenAI from 'openai';
import { NLQuery, RegenerationContext, ExplanationOptions } from '../../src/types';

// Mock dependencies
jest.mock('openai');
jest.mock('@azure/identity');
jest.mock('../../src/utils/logger');

const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const mockChatCompletionsCreate = jest.fn();

describe('AIService', () => {
  let aiService: AIService;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    // Reset mocks
    mockChatCompletionsCreate.mockClear();
    mockOpenAI.mockClear();

    // Setup OpenAI mock
    mockOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
    }) as any);

    // Create mock services
    mockAuthService = {
      getAccessToken: jest.fn(),
      getOpenAIToken: jest.fn(),
    } as any;

    mockConfigManager = {
      getConfig: jest.fn().mockReturnValue({
        appInsights: { applicationId: 'test-id', tenantId: 'test-tenant' },
        openAI: {
          endpoint: 'https://test.openai.azure.com',
          deploymentName: 'gpt-4',
          apiKey: 'test-api-key' // Add API key to avoid credential issues
        },
        logLevel: 'info',
      }),
    } as any;

    // Create service but don't await initialization in constructor
    aiService = new AIService(mockAuthService, mockConfigManager);
  });

  describe('generateKQLQuery', () => {
    it('should generate KQL query successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '```kql\nrequests | where timestamp > ago(1h) | count\n```',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const result = await aiService.generateKQLQuery('Show request count in the last hour');

      expect(result).toEqual({
        generatedKQL: 'requests | where timestamp > ago(1h) | count',
        confidence: 0.9,
        reasoning: expect.any(String),
      });

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
          temperature: 0.3,
          max_tokens: 1000,
        })
      );
    });

    it('should handle KQL without code blocks', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'requests | where timestamp > ago(1h) | count',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const result = await aiService.generateKQLQuery('Show request count');

      expect(result.generatedKQL).toBe('requests | where timestamp > ago(1h) | count');
    });

    it('should throw error if no response is generated', async () => {
      const mockResponse = {
        choices: [{ message: { content: null } }],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      await expect(aiService.generateKQLQuery('test query')).rejects.toThrow('No response generated from OpenAI');
    });

    it('should throw error if OpenAI API fails', async () => {
      mockChatCompletionsCreate.mockRejectedValue(new Error('API Error'));

      await expect(aiService.generateKQLQuery('test query')).rejects.toThrow('KQL generation failed');
    });

    it('should include schema in system prompt when provided', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'requests | count',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const schema = { tables: ['requests', 'dependencies'] };
      await aiService.generateKQLQuery('test query', schema);

      const systemPrompt = mockChatCompletionsCreate.mock.calls[0][0].messages[0].content;
      expect(systemPrompt).toContain(JSON.stringify(schema, null, 2));
    });
  });

  describe('explainKQLQuery', () => {
    it('should generate KQL explanation successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This query counts the number of requests in the last hour.',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const result = await aiService.explainKQLQuery('requests | where timestamp > ago(1h) | count');

      expect(result).toBe('This query counts the number of requests in the last hour.');
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          temperature: 0.3,
          max_tokens: 1500,
        })
      );
    });

    it('should handle different explanation options', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Detailed explanation in Japanese.',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const options: ExplanationOptions = {
        language: 'ja',
        technicalLevel: 'beginner',
        includeExamples: true,
      };

      const result = await aiService.explainKQLQuery('requests | count', options);

      expect(result).toBe('Detailed explanation in Japanese.');

      const systemPrompt = mockChatCompletionsCreate.mock.calls[0][0].messages[0].content;
      expect(systemPrompt).toContain('Japanese');
      expect(systemPrompt).toContain('beginner');
    });

    it('should throw error if explanation generation fails', async () => {
      mockChatCompletionsCreate.mockRejectedValue(new Error('API Error'));

      await expect(aiService.explainKQLQuery('test query')).rejects.toThrow('KQL explanation failed');
    });
  });

  describe('regenerateKQLQuery', () => {
    it('should regenerate KQL query with different approach', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'requests | summarize count() by bin(timestamp, 1h)',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const context: RegenerationContext = {
        previousQuery: 'requests | count',
        previousReasoning: 'Simple count',
        attemptNumber: 2,
      };

      const result = await aiService.regenerateKQLQuery('Show request count', context);

      expect(result).toEqual({
        generatedKQL: 'requests | summarize count() by bin(timestamp, 1h)',
        confidence: expect.any(Number),
        reasoning: 'Regenerated approach (attempt 2)',
      });

      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7, // Higher temperature for more diversity
        })
      );
    });

    it('should return null if regenerated query is identical to previous', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'requests | count', // Same as previous
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const context: RegenerationContext = {
        previousQuery: 'requests | count',
        previousReasoning: 'Simple count',
        attemptNumber: 2,
      };

      const result = await aiService.regenerateKQLQuery('Show request count', context);

      expect(result).toBeNull();
    });

    it('should throw error if regeneration fails', async () => {
      mockChatCompletionsCreate.mockRejectedValue(new Error('API Error'));

      const context: RegenerationContext = {
        previousQuery: 'requests | count',
        attemptNumber: 2,
      };

      await expect(aiService.regenerateKQLQuery('test query', context)).rejects.toThrow('KQL regeneration failed');
    });
  });

  describe('validateQuery', () => {
    it('should return valid for safe queries', async () => {
      const result = await aiService.validateQuery('requests | where timestamp > ago(1h) | count');

      expect(result).toEqual({ isValid: true });
    });

    it('should return invalid for empty queries', async () => {
      const result = await aiService.validateQuery('');

      expect(result).toEqual({
        isValid: false,
        error: 'Query is empty',
      });
    });

    it('should return invalid for dangerous queries', async () => {
      const result = await aiService.validateQuery('DROP TABLE requests');

      expect(result).toEqual({
        isValid: false,
        error: 'Query contains potentially dangerous operations',
      });
    });

    it('should validate against multiple dangerous patterns', async () => {
      const dangerousQueries = [
        'DELETE FROM requests',
        'TRUNCATE TABLE requests',
        'ALTER TABLE requests',
      ];

      for (const query of dangerousQueries) {
        const result = await aiService.validateQuery(query);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('dangerous operations');
      }
    });
  });

  describe('confidence calculation', () => {
    it('should assign high confidence for complete responses', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'requests | count' },
            finish_reason: 'stop',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const result = await aiService.generateKQLQuery('test query');
      expect(result.confidence).toBe(0.9);
    });

    it('should assign medium confidence for length-limited responses', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'requests | count' },
            finish_reason: 'length',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const result = await aiService.generateKQLQuery('test query');
      expect(result.confidence).toBe(0.6);
    });

    it('should assign low confidence for other finish reasons', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'requests | count' },
            finish_reason: 'content_filter',
          },
        ],
      };

      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const result = await aiService.generateKQLQuery('test query');
      expect(result.confidence).toBe(0.5);
    });
  });
});
