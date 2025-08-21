import { DefaultAzureCredential } from '@azure/identity';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { AuthConfig } from '../../core/types/ProviderTypes';
import { logger } from '../../utils/logger';

/**
 * Azure Managed Identity authentication provider
 */
export class AzureManagedIdentityProvider implements IAuthenticationProvider {
  private credential: DefaultAzureCredential | null = null;

  constructor(private config: AuthConfig) {
    if (this.config.type !== 'azure-managed-identity') {
      throw new Error('Invalid provider type for AzureManagedIdentityProvider');
    }
    this.initializeCredential();
  }

  private initializeCredential(): void {
    try {
      this.credential = new DefaultAzureCredential();
      logger.info('Azure Managed Identity credential initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Azure Managed Identity credential:', error);
      throw new Error('Azure authentication failed');
    }
  }

  /**
   * Get access token for specified scopes
   */
  async getAccessToken(scopes: string[] = ['https://api.applicationinsights.io/.default']): Promise<string> {
    if (!this.credential) {
      throw new Error('Azure credential not initialized');
    }

    try {
      const tokenResponse = await this.credential.getToken(scopes);
      logger.debug('Access token obtained successfully');
      return tokenResponse.token;
    } catch (error) {
      logger.error('Failed to get access token:', error);
      throw new Error('Failed to authenticate with Azure');
    }
  }

  /**
   * Validate current credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.getAccessToken(['https://management.azure.com/.default']);
      logger.info('Azure credentials validated successfully');
      return true;
    } catch (error) {
      logger.warn('Azure credential validation failed:', error);
      return false;
    }
  }

  /**
   * Get token specifically for OpenAI/AI services
   */
  async getOpenAIToken(): Promise<string> {
    return this.getAccessToken(['https://cognitiveservices.azure.com/.default']);
  }
}