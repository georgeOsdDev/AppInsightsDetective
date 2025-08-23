import { AzureOpenAIProvider } from '../../../src/providers/ai/AzureOpenAIProvider';
import { AuthService } from '../../../src/services/authService';

// Mock dependencies
jest.mock('../../../src/services/authService');
jest.mock('openai');
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({ token: 'mock-managed-identity-token' })
  }))
}));
jest.mock('../../../src/utils/logger');

describe('AzureOpenAIProvider', () => {
  let provider: AzureOpenAIProvider;
  let mockAuthService: jest.Mocked<AuthService>;

  const mockConfig = {
    apiKey: 'test-api-key',
    endpoint: 'https://test.openai.azure.com',
    deploymentName: 'gpt-4',
    apiVersion: '2024-02-15-preview'
  };

  beforeEach(() => {
    mockAuthService = {
      getAccessToken: jest.fn().mockResolvedValue('mock-token')
    } as any;

    provider = new AzureOpenAIProvider(mockConfig, mockAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with API key', async () => {
      await expect(provider.initialize()).resolves.not.toThrow();
    });

    it('should initialize successfully with managed identity', async () => {
      const configWithoutApiKey = { ...mockConfig, apiKey: undefined };
      
      const providerMI = new AzureOpenAIProvider(configWithoutApiKey, mockAuthService);
      await expect(providerMI.initialize()).resolves.not.toThrow();
    });
  });

  describe('generateKQLQuery', () => {
    it('should generate KQL query successfully', async () => {
      // Mock OpenAI response
      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: { content: 'requests | where timestamp > ago(1h) | count' },
                finish_reason: 'stop'
              }]
            })
          }
        }
      };

      // Replace the OpenAI client in provider
      (provider as any).openAIClient = mockOpenAIClient;

      const result = await provider.generateKQLQuery('Show me request count in last hour');

      expect(result).toBeTruthy();
      expect(result?.generatedKQL).toBe('requests | where timestamp > ago(1h) | count');
      expect(result?.confidence).toBe(0.9);
      expect(result?.originalQuestion).toBe('Show me request count in last hour');
    });

    it('should return null when no content is generated', async () => {
      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: null } }]
            })
          }
        }
      };

      (provider as any).openAIClient = mockOpenAIClient;

      const result = await provider.generateKQLQuery('test query');
      expect(result).toBeNull();
    });
  });

  describe('validateQuery', () => {
    it('should validate safe query', async () => {
      const result = await provider.validateQuery('requests | where timestamp > ago(1h)');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject dangerous query', async () => {
      const result = await provider.validateQuery('DROP TABLE requests');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('dangerous operations');
    });

    it('should reject empty query', async () => {
      const result = await provider.validateQuery('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should warn about queries without WHERE clause', async () => {
      const result = await provider.validateQuery('requests | summarize count()');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('WHERE clause');
    });
  });

  describe('regenerateKQLQuery', () => {
    it('should regenerate query with different approach', async () => {
      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: { content: 'requests | summarize count() by bin(timestamp, 1h)' },
                finish_reason: 'stop'
              }]
            })
          }
        }
      };

      (provider as any).openAIClient = mockOpenAIClient;

      const context = {
        previousQuery: 'requests | count',
        attemptNumber: 2
      };

      const result = await provider.regenerateKQLQuery('Show request counts', context);

      expect(result).toBeTruthy();
      expect(result?.generatedKQL).toBe('requests | summarize count() by bin(timestamp, 1h)');
      expect(result?.confidence).toBeLessThan(0.9); // Should be reduced due to attempt number
    });
  });

  describe('explainKQLQuery', () => {
    it('should explain query successfully', async () => {
      const mockOpenAIClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: { content: 'This query counts all requests in the last hour.' }
              }]
            })
          }
        }
      };

      (provider as any).openAIClient = mockOpenAIClient;

      const explanation = await provider.explainKQLQuery('requests | where timestamp > ago(1h) | count');

      expect(explanation).toBe('This query counts all requests in the last hour.');
    });
  });
});