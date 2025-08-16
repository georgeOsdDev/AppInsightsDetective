import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '../utils/logger';

export class AuthService {
  private credential: DefaultAzureCredential | null = null;

  constructor() {
    this.initializeCredential();
  }

  private initializeCredential(): void {
    try {
      this.credential = new DefaultAzureCredential();
      logger.info('Azure credential initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Azure credential:', error);
      throw new Error('Azure authentication failed');
    }
  }

  public async getAccessToken(scopes: string[] = ['https://api.applicationinsights.io/.default']): Promise<string> {
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

  public async getOpenAIToken(): Promise<string> {
    return this.getAccessToken(['https://cognitiveservices.azure.com/.default']);
  }
}
