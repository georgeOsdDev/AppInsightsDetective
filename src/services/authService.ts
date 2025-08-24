import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '../utils/logger';
import { ConfigManager } from '../utils/config';
import { IAuthenticationProvider } from '../core/interfaces/IAuthenticationProvider';

/**
 * Legacy AuthService that now delegates to the provider architecture
 * @deprecated Use IAuthenticationProvider directly from dependency injection
 */
export class AuthService {
  private authProvider: IAuthenticationProvider | null = null;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    try {
      // Use ConfigManager to get the auth provider
      const configManager = new ConfigManager();
      const config = configManager.getConfig();
      const defaultAuthProvider = config.providers.auth.default;
      const authConfig = config.providers.auth[defaultAuthProvider];

      // Create the appropriate auth provider
      // For now, directly create AzureManagedIdentityProvider as it's the main one
      const { AzureManagedIdentityProvider } = require('../providers/auth/AzureManagedIdentityProvider');
      this.authProvider = new AzureManagedIdentityProvider(authConfig);
      
      logger.info('Legacy AuthService initialized with provider delegation');
    } catch (error) {
      logger.error('Failed to initialize auth provider in legacy service:', error);
      // Fallback to direct credential creation
      logger.warn('Falling back to direct credential creation');
    }
  }

  public async getAccessToken(scopes: string[] = ['https://api.applicationinsights.io/.default']): Promise<string> {
    if (this.authProvider) {
      return this.authProvider.getAccessToken(scopes);
    }

    // Fallback implementation
    try {
      const credential = new DefaultAzureCredential();
      const tokenResponse = await credential.getToken(scopes);
      logger.debug('Access token obtained successfully via fallback');
      return tokenResponse.token;
    } catch (error) {
      logger.error('Failed to get access token:', error);
      throw new Error('Failed to authenticate with Azure');
    }
  }

  public async getOpenAIToken(): Promise<string> {
    return this.getAccessToken(['https://cognitiveservices.azure.com/.default']);
  }
}
