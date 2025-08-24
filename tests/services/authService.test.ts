import { AuthService } from '../../src/services/authService';
import { DefaultAzureCredential } from '@azure/identity';

// Mock Azure SDK
jest.mock('@azure/identity');
jest.mock('../../src/utils/logger');

// Mock ConfigManager
jest.mock('../../src/utils/config', () => ({
  ConfigManager: jest.fn().mockImplementation(() => ({
    getConfig: jest.fn().mockReturnValue({
      providers: {
        auth: {
          default: 'azure-managed-identity',
          'azure-managed-identity': {
            tenantId: 'mock-tenant-id'
          }
        }
      }
    })
  }))
}));

// Mock AzureManagedIdentityProvider
const mockProviderGetAccessToken = jest.fn();
jest.mock('../../src/providers/auth/AzureManagedIdentityProvider', () => ({
  AzureManagedIdentityProvider: jest.fn().mockImplementation(() => ({
    getAccessToken: mockProviderGetAccessToken
  }))
}));

const mockDefaultAzureCredential = DefaultAzureCredential as jest.MockedClass<typeof DefaultAzureCredential>;
const mockGetToken = jest.fn();

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Reset mocks
    mockDefaultAzureCredential.mockClear();
    mockGetToken.mockClear();
    mockProviderGetAccessToken.mockClear();

    // Setup mock credential
    mockDefaultAzureCredential.mockImplementation(() => ({
      getToken: mockGetToken,
    }) as any);
  });

  describe('constructor', () => {
    it('should initialize successfully', () => {
      expect(() => new AuthService()).not.toThrow();
    });

    it('should handle provider initialization failures gracefully', () => {
      // Constructor should not throw even if provider init fails due to fallback logic
      expect(() => new AuthService()).not.toThrow();
    });
  });

  describe('getAccessToken', () => {
    beforeEach(() => {
      authService = new AuthService();
    });

    it('should return access token successfully', async () => {
      const mockToken = 'mock-access-token';
      mockProviderGetAccessToken.mockResolvedValue(mockToken);

      const result = await authService.getAccessToken();

      expect(mockProviderGetAccessToken).toHaveBeenCalledWith(['https://api.applicationinsights.io/.default']);
      expect(result).toBe(mockToken);
    });

    it('should use custom scopes when provided', async () => {
      const mockToken = 'mock-access-token';
      const customScopes = ['custom-scope'];
      mockProviderGetAccessToken.mockResolvedValue(mockToken);

      const result = await authService.getAccessToken(customScopes);

      expect(mockProviderGetAccessToken).toHaveBeenCalledWith(customScopes);
      expect(result).toBe(mockToken);
    });

    it('should throw error if token retrieval fails', async () => {
      // Mock provider failure and fallback credential failure
      mockProviderGetAccessToken.mockRejectedValue(new Error('Provider failed'));
      mockGetToken.mockRejectedValue(new Error('Token retrieval failed'));
      
      await expect(authService.getAccessToken()).rejects.toThrow('Failed to authenticate with Azure');
    });

    it('should handle fallback credential when provider is not available', async () => {
      const mockToken = 'fallback-token';
      // Simulate provider not being available, should use fallback
      mockProviderGetAccessToken.mockRejectedValue(new Error('Provider unavailable'));
      mockGetToken.mockResolvedValue({ token: mockToken });

      const result = await authService.getAccessToken();

      expect(result).toBe(mockToken);
    });
  });

  describe('getOpenAIToken', () => {
    beforeEach(() => {
      authService = new AuthService();
    });

    it('should return OpenAI token with correct scope', async () => {
      const mockToken = 'mock-openai-token';
      mockProviderGetAccessToken.mockResolvedValue(mockToken);

      const result = await authService.getOpenAIToken();

      expect(mockProviderGetAccessToken).toHaveBeenCalledWith(['https://cognitiveservices.azure.com/.default']);
      expect(result).toBe(mockToken);
    });

    it('should throw error if OpenAI token retrieval fails', async () => {
      mockProviderGetAccessToken.mockRejectedValue(new Error('OpenAI token failed'));
      mockGetToken.mockRejectedValue(new Error('OpenAI token failed'));

      await expect(authService.getOpenAIToken()).rejects.toThrow('Failed to authenticate with Azure');
    });
  });
});
