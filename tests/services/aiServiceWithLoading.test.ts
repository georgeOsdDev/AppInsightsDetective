import { AIService } from '../../src/services/aiService';
import { AuthService } from '../../src/services/authService';
import { ConfigManager } from '../../src/utils/config';

// Mock the loading indicator
jest.mock('../../src/utils/loadingIndicator', () => ({
  withLoadingIndicator: jest.fn(async (message: string, operation: () => Promise<any>) => {
    // Simply execute the operation for testing
    return await operation();
  })
}));

// Mock dependencies
jest.mock('../../src/services/authService', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    getOpenAIToken: jest.fn().mockResolvedValue('mock-token'),
    getAccessToken: jest.fn().mockResolvedValue('mock-token')
  }))
}));
jest.mock('../../src/utils/config');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock AI providers
jest.mock('../../src/providers/ai/AzureOpenAIProvider', () => ({
  AzureOpenAIProvider: jest.fn().mockImplementation(() => ({
    generateQuery: jest.fn().mockResolvedValue({
      generatedKQL: 'requests | count',
      confidence: 0.9,
      explanation: 'Mock query'
    })
  }))
}));

// Mock OpenAI
const mockOpenAICompletion = {
  choices: [
    {
      message: { 
        content: 'requests | where timestamp > ago(1h) | count' 
      },
      finish_reason: 'stop'
    }
  ]
};

const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue(mockOpenAICompletion)
    }
  }
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

// Mock Azure Identity
jest.mock('@azure/identity', () => ({
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({ token: 'mock-token' })
  }))
}));

describe('AI Service with Loading Indicators', () => {
  let aiService: AIService;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    mockAuthService = new AuthService() as jest.Mocked<AuthService>;
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    
    // Setup config mock
    mockConfigManager.getConfig.mockReturnValue({
      providers: {
        ai: {
          default: 'azure-openai',
          'azure-openai': {
            endpoint: 'https://test.openai.azure.com',
            deploymentName: 'gpt-4',
            apiVersion: '2024-02-15-preview'
          }
        }
      },
      openAI: {
        apiKey: 'test-key',
        endpoint: 'https://test.openai.azure.com',
        deploymentName: 'gpt-4'
      },
      language: 'en' as any
    } as any);

    aiService = new AIService(mockAuthService, mockConfigManager);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  it('should call withLoadingIndicator when generating KQL query', async () => {
    const { withLoadingIndicator } = require('../../src/utils/loadingIndicator');
    
    const result = await aiService.generateKQLQuery('show me errors');
    
    expect(withLoadingIndicator).toHaveBeenCalledWith(
      'Generating KQL query with AI...',
      expect.any(Function),
      {
        successMessage: 'KQL query generated successfully',
        errorMessage: 'Failed to generate KQL query'
      }
    );
    
    expect(result).toBeDefined();
    expect(result.generatedKQL).toBe('requests | where timestamp > ago(1h) | count');
  });

  it('should call withLoadingIndicator when explaining KQL query', async () => {
    const { withLoadingIndicator } = require('../../src/utils/loadingIndicator');
    
    // Mock explanation response
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'This query counts requests in the last hour.' } }]
    });
    
    const result = await aiService.explainKQLQuery('requests | count');
    
    expect(withLoadingIndicator).toHaveBeenCalledWith(
      'Generating KQL query explanation in language: en...',
      expect.any(Function),
      {
        successMessage: 'Query explanation generated successfully',
        errorMessage: 'Failed to generate query explanation'
      }
    );
    
    expect(result).toBe('This query counts requests in the last hour.');
  });

  it('should call withLoadingIndicator when regenerating KQL query', async () => {
    const { withLoadingIndicator } = require('../../src/utils/loadingIndicator');
    
    const context = {
      attemptNumber: 2,
      previousQuery: 'requests | count'
    };
    
    const result = await aiService.regenerateKQLQuery('show me errors', context);
    
    expect(withLoadingIndicator).toHaveBeenCalledWith(
      'Regenerating KQL query (attempt 2)...',
      expect.any(Function),
      {
        successMessage: 'KQL query regenerated successfully',
        errorMessage: 'Failed to regenerate KQL query'
      }
    );
    
    expect(result).toBeDefined();
    expect(result!.generatedKQL).toBe('requests | where timestamp > ago(1h) | count');
  });

  it('should call withLoadingIndicator when generating AI response', async () => {
    const { withLoadingIndicator } = require('../../src/utils/loadingIndicator');
    
    // Mock analysis response
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{ message: { content: 'Analysis completed successfully.' } }]
    });
    
    const result = await aiService.generateResponse('Analyze this data');
    
    expect(withLoadingIndicator).toHaveBeenCalledWith(
      'Generating AI analysis...',
      expect.any(Function),
      {
        successMessage: 'AI analysis generated successfully',
        errorMessage: 'Failed to generate AI analysis'
      }
    );
    
    expect(result).toBe('Analysis completed successfully.');
  });
});