import OpenAI from 'openai';
import { DefaultAzureCredential } from '@azure/identity';
import { OpenAIProvider } from './OpenAIProvider';
import { AIProviderConfig } from '../../core/types/ProviderTypes';
import { IAuthenticationProvider } from '../../core/interfaces/IAuthenticationProvider';
import { logger } from '../../utils/logger';

/**
 * Azure OpenAI provider implementation that extends the base OpenAI provider
 * Only overrides the initialization method to use Azure-specific authentication
 */
export class AzureOpenAIProvider extends OpenAIProvider {
  constructor(
    config: AIProviderConfig,
    authProvider?: IAuthenticationProvider
  ) {
    super(config, authProvider);
  }

  /**
   * Override the initialization method to use Azure-specific authentication
   */
  protected async initializeOpenAI(): Promise<void> {
    if (this.config.type !== 'azure-openai') {
      throw new Error('Invalid provider type for AzureOpenAIProvider');
    }
    try {
      if (this.config.apiKey) {
        // API Key authentication
        this.openAIClient = new OpenAI({
          apiKey: this.config.apiKey,
          baseURL: `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}`,
          defaultQuery: { 'api-version': '2024-02-15-preview' },
          defaultHeaders: {
            'api-key': this.config.apiKey,
          },
        });
      } else {
        // Managed Identity authentication
        let token: string;
        if (this.authProvider) {
          token = await this.authProvider.getOpenAIToken();
        } else {
          const credential = new DefaultAzureCredential();
          const tokenResponse = await credential.getToken(['https://cognitiveservices.azure.com/.default']);
          token = tokenResponse.token;
        }

        this.openAIClient = new OpenAI({
          apiKey: token,
          baseURL: `${this.config.endpoint}/openai/deployments/${this.config.deploymentName}`,
          defaultQuery: { 'api-version': '2024-02-15-preview' },
          defaultHeaders: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }

      logger.info('Azure OpenAI client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Azure OpenAI client:', error);
      throw new Error('Azure OpenAI initialization failed');
    }
  }
}
