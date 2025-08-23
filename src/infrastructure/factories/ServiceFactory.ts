import { IAIProvider } from '../../core/interfaces/IAIProvider';
import { IDataSourceProvider } from '../../core/interfaces/IDataSourceProvider';
import { IQueryOrchestrator } from '../../core/interfaces/IQueryOrchestrator';
import { IOutputRenderer } from '../../core/interfaces/IOutputRenderer';
import { ISessionController } from '../../core/interfaces/ISessionController';
import { IConfigurationProvider } from '../../core/interfaces/IConfigurationProvider';

import { AzureOpenAIProvider } from '../../providers/ai/AzureOpenAIProvider';
import { ApplicationInsightsProvider } from '../../providers/datasource/ApplicationInsightsProvider';
import { QueryOrchestrator } from '../../services/orchestration/QueryOrchestrator';
import { ConsoleOutputRenderer } from '../../presentation/renderers/ConsoleOutputRenderer';
import { InteractiveSessionController } from '../../presentation/interactive/InteractiveSessionController';
import { EnhancedConfigurationProvider } from '../config/EnhancedConfigurationProvider';

import { AuthService } from '../../services/authService';
import { logger } from '../../utils/logger';

/**
 * Service factory for creating and wiring Phase 3 architecture components
 */
export class ServiceFactory {
  private static configProvider: IConfigurationProvider | null = null;
  private static authService: AuthService | null = null;

  /**
   * Create and configure all services with dependency injection
   */
  static async createServices(): Promise<{
    configProvider: IConfigurationProvider;
    aiProvider: IAIProvider;
    dataSourceProvider: IDataSourceProvider;
    queryOrchestrator: IQueryOrchestrator;
    outputRenderer: IOutputRenderer;
    sessionController: ISessionController;
  }> {
    try {
      // Create configuration provider
      const configProvider = this.getConfigurationProvider();
      const enhancedConfig = await configProvider.getEnhancedConfiguration();

      // Create authentication service
      const authService = this.getAuthService();

      // Create AI provider (Azure OpenAI by default)
      const aiProviderConfig = configProvider.getProviderConfiguration('ai', 'azure-openai');
      if (!aiProviderConfig) {
        throw new Error('Azure OpenAI provider configuration not found');
      }

      const aiProvider = new AzureOpenAIProvider(aiProviderConfig.config as any, authService);

      // Create data source provider (Application Insights by default)
      const dataSourceConfig = configProvider.getProviderConfiguration('dataSources', 'application-insights');
      if (!dataSourceConfig) {
        throw new Error('Application Insights provider configuration not found');
      }

      const dataSourceProvider = new ApplicationInsightsProvider(dataSourceConfig.config as any, authService);

      // Create query orchestrator
      const queryOrchestrator = new QueryOrchestrator(aiProvider, dataSourceProvider);

      // Create output renderer
      const outputRenderer = new ConsoleOutputRenderer();

      // Create session controller
      const sessionController = new InteractiveSessionController(
        queryOrchestrator,
        outputRenderer,
        {
          language: enhancedConfig.language as any,
          defaultMode: 'step'
        }
      );

      logger.info('Phase 3 architecture services created successfully');

      return {
        configProvider,
        aiProvider,
        dataSourceProvider,
        queryOrchestrator,
        outputRenderer,
        sessionController
      };
    } catch (error) {
      logger.error('Failed to create services:', error);
      throw error;
    }
  }

  /**
   * Create AI provider by type
   */
  static async createAIProvider(
    providerType: string = 'azure-openai',
    configProvider?: IConfigurationProvider
  ): Promise<IAIProvider> {
    const config = configProvider || this.getConfigurationProvider();
    const authService = this.getAuthService();
    
    const providerConfig = config.getProviderConfiguration('ai', providerType);
    if (!providerConfig) {
      throw new Error(`AI provider configuration not found for type: ${providerType}`);
    }

    switch (providerType) {
      case 'azure-openai':
        return new AzureOpenAIProvider(providerConfig.config as any, authService);
      default:
        throw new Error(`Unsupported AI provider type: ${providerType}`);
    }
  }

  /**
   * Create data source provider by type
   */
  static async createDataSourceProvider(
    providerType: string = 'application-insights',
    configProvider?: IConfigurationProvider
  ): Promise<IDataSourceProvider> {
    const config = configProvider || this.getConfigurationProvider();
    const authService = this.getAuthService();
    
    const providerConfig = config.getProviderConfiguration('dataSources', providerType);
    if (!providerConfig) {
      throw new Error(`Data source provider configuration not found for type: ${providerType}`);
    }

    switch (providerType) {
      case 'application-insights':
        return new ApplicationInsightsProvider(providerConfig.config as any, authService);
      default:
        throw new Error(`Unsupported data source provider type: ${providerType}`);
    }
  }

  /**
   * Create query orchestrator with specified providers
   */
  static createQueryOrchestrator(
    aiProvider: IAIProvider,
    dataSourceProvider: IDataSourceProvider
  ): IQueryOrchestrator {
    return new QueryOrchestrator(aiProvider, dataSourceProvider);
  }

  /**
   * Create output renderer by type
   */
  static createOutputRenderer(rendererType: string = 'console'): IOutputRenderer {
    switch (rendererType) {
      case 'console':
        return new ConsoleOutputRenderer();
      default:
        throw new Error(`Unsupported output renderer type: ${rendererType}`);
    }
  }

  /**
   * Create session controller with specified dependencies
   */
  static createSessionController(
    queryOrchestrator: IQueryOrchestrator,
    outputRenderer: IOutputRenderer,
    options: any = {}
  ): ISessionController {
    return new InteractiveSessionController(queryOrchestrator, outputRenderer, options);
  }

  /**
   * Get or create configuration provider (singleton)
   */
  private static getConfigurationProvider(): IConfigurationProvider {
    if (!this.configProvider) {
      this.configProvider = new EnhancedConfigurationProvider();
    }
    return this.configProvider;
  }

  /**
   * Get or create auth service (singleton)
   */
  private static getAuthService(): AuthService {
    if (!this.authService) {
      this.authService = new AuthService();
    }
    return this.authService;
  }

  /**
   * Validate service configuration
   */
  static async validateConfiguration(configProvider?: IConfigurationProvider): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const config = configProvider || this.getConfigurationProvider();
      const baseConfig = config.getConfiguration();
      
      return await config.validateConfiguration(baseConfig);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Configuration validation failed: ${error}`],
        warnings: []
      };
    }
  }
}