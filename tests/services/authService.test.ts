import { AuthService } from '../../src/services/authService';
import { DefaultAzureCredential } from '@azure/identity';

// Mock Azure SDK
jest.mock('@azure/identity');
jest.mock('../../src/utils/logger');

const mockDefaultAzureCredential = DefaultAzureCredential as jest.MockedClass<typeof DefaultAzureCredential>;
const mockGetToken = jest.fn();

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Reset mocks
    mockDefaultAzureCredential.mockClear();
    mockGetToken.mockClear();

    // Setup mock credential
    mockDefaultAzureCredential.mockImplementation(() => ({
      getToken: mockGetToken,
    }) as any);
  });

  describe('constructor', () => {
    it('should initialize credential successfully', () => {
      authService = new AuthService();
      expect(mockDefaultAzureCredential).toHaveBeenCalledTimes(1);
    });

    it('should throw error if credential initialization fails', () => {
      mockDefaultAzureCredential.mockImplementation(() => {
        throw new Error('Credential init failed');
      });

      expect(() => new AuthService()).toThrow('Azure authentication failed');
    });
  });

  describe('getAccessToken', () => {
    beforeEach(() => {
      authService = new AuthService();
    });

    it('should return access token successfully', async () => {
      const mockToken = 'mock-access-token';
      mockGetToken.mockResolvedValue({ token: mockToken });

      const result = await authService.getAccessToken();

      expect(mockGetToken).toHaveBeenCalledWith(['https://api.applicationinsights.io/.default']);
      expect(result).toBe(mockToken);
    });

    it('should use custom scopes when provided', async () => {
      const mockToken = 'mock-access-token';
      const customScopes = ['custom-scope'];
      mockGetToken.mockResolvedValue({ token: mockToken });

      const result = await authService.getAccessToken(customScopes);

      expect(mockGetToken).toHaveBeenCalledWith(customScopes);
      expect(result).toBe(mockToken);
    });

    it('should throw error if token retrieval fails', async () => {
      mockGetToken.mockRejectedValue(new Error('Token retrieval failed'));

      await expect(authService.getAccessToken()).rejects.toThrow('Failed to authenticate with Azure');
    });

    it('should throw error if credential is not initialized', async () => {
      // Create service with failed credential init
      mockDefaultAzureCredential.mockImplementation(() => {
        throw new Error('Credential init failed');
      });

      expect(() => new AuthService()).toThrow('Azure authentication failed');
    });
  });

  describe('getOpenAIToken', () => {
    beforeEach(() => {
      authService = new AuthService();
    });

    it('should return OpenAI token with correct scope', async () => {
      const mockToken = 'mock-openai-token';
      mockGetToken.mockResolvedValue({ token: mockToken });

      const result = await authService.getOpenAIToken();

      expect(mockGetToken).toHaveBeenCalledWith(['https://cognitiveservices.azure.com/.default']);
      expect(result).toBe(mockToken);
    });

    it('should throw error if OpenAI token retrieval fails', async () => {
      mockGetToken.mockRejectedValue(new Error('OpenAI token failed'));

      await expect(authService.getOpenAIToken()).rejects.toThrow('Failed to authenticate with Azure');
    });
  });
});
