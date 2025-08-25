import { ServiceContainer } from '../infrastructure/di/ServiceContainer';
import { ProviderFactory } from '../infrastructure/di/ProviderFactory';
import { AzureOpenAIProvider } from '../providers/ai/AzureOpenAIProvider';
import { OpenAIProvider } from '../providers/ai/OpenAIProvider';
import { ApplicationInsightsProvider } from '../providers/datasource/ApplicationInsightsProvider';
import { LogAnalyticsProvider } from '../providers/datasource/LogAnalyticsProvider';
import { AzureManagedIdentityProvider } from '../providers/auth/AzureManagedIdentityProvider';
import { 
  IAIProvider, 
  IDataSourceProvider, 
  IAuthenticationProvider,
  IQueryOrchestrator,
  ISessionManager,
  IOutputRenderer,
  ITemplateRepository
} from '../core/interfaces';
import { ConfigManager } from '../utils/config';
import { logger } from '../utils/logger';
// Phase 3 imports
import { QueryOrchestrator, SessionManager } from '../services/orchestration';
import { QueryService } from '../services/QueryService';
import { TemplateService } from '../services/TemplateService';
import { ConsoleOutputRenderer } from '../presentation/renderers/ConsoleOutputRenderer';
import { InteractiveSessionController } from '../presentation/InteractiveSessionController';
import { QueryEditorService } from '../services/QueryEditorService';
import { ExternalExecutionService } from '../services/externalExecutionService';
import { IQueryEditorService } from '../core/interfaces/IQueryEditorService';

/**
 * Bootstrap class to configure the dependency injection container
 */
export class Bootstrap {
  private container = new ServiceContainer();
  private providerFactory = new ProviderFactory();

  /**
   * Initialize the application with dependency injection
   */
  async initialize(): Promise<ServiceContainer> {
    logger.info('Initializing application with dependency injection...');

    // Register provider constructors in the factory
    // Phase 5: Register AI providers
    this.providerFactory.registerAIProvider('azure-openai', AzureOpenAIProvider);
    this.providerFactory.registerAIProvider('openai', OpenAIProvider);
    
    // Phase 5: Register data source providers
    this.providerFactory.registerDataSourceProvider('application-insights', ApplicationInsightsProvider);
    this.providerFactory.registerDataSourceProvider('log-analytics', LogAnalyticsProvider);
    
    // Register auth providers
    this.providerFactory.registerAuthProvider('azure-managed-identity', AzureManagedIdentityProvider);

    // Register the provider factory
    this.container.register('providerFactory', this.providerFactory);

    // Register config manager
    const configManager = new ConfigManager();
    this.container.register('configManager', configManager);

    // Create and register providers based on configuration
    await this.registerProviders(configManager);

    // Register orchestration and business logic services
    await this.registerOrchestrationServices();

    logger.info('Application initialization completed');
    return this.container;
  }

  private async registerProviders(configManager: ConfigManager): Promise<void> {
    const config = configManager.getConfig();
    
    // Create auth provider
    const defaultAuthProvider = config.providers.auth.default;
    const authConfig = config.providers.auth[defaultAuthProvider];
    const authProvider = this.providerFactory.createAuthProvider(defaultAuthProvider as any, authConfig);
    this.container.register<IAuthenticationProvider>('authProvider', authProvider);

    // Create AI provider
    const defaultAIProvider = config.providers.ai.default;
    const aiConfig = config.providers.ai[defaultAIProvider];
    const aiProvider = this.providerFactory.createAIProvider(defaultAIProvider as any, aiConfig, authProvider);
    this.container.register<IAIProvider>('aiProvider', aiProvider);

    // Create data source provider
    const defaultDataSourceProvider = config.providers.dataSources.default;
    const dataSourceConfig = config.providers.dataSources[defaultDataSourceProvider];
    const dataSourceProvider = this.providerFactory.createDataSourceProvider(
      defaultDataSourceProvider as any, 
      dataSourceConfig, 
      authProvider
    );
    this.container.register<IDataSourceProvider>('dataSourceProvider', dataSourceProvider);

    logger.info('Providers registered successfully');
  }

  /**
   * Register orchestration and business logic services
   */
  private async registerOrchestrationServices(): Promise<void> {
    // Get providers from container
    const aiProvider = this.container.resolve<IAIProvider>('aiProvider');
    const dataSourceProvider = this.container.resolve<IDataSourceProvider>('dataSourceProvider');
    const configManager = this.container.resolve<ConfigManager>('configManager');

    // Register business logic layer
    const templateService = new TemplateService();
    this.container.register<ITemplateRepository>('templateRepository', templateService);

    // Register orchestration layer (with template repository support)
    const queryOrchestrator = new QueryOrchestrator(aiProvider, dataSourceProvider, templateService);
    this.container.register<IQueryOrchestrator>('queryOrchestrator', queryOrchestrator);

    const sessionManager = new SessionManager();
    this.container.register<ISessionManager>('sessionManager', sessionManager);

    // Register business logic layer
    const queryService = new QueryService(queryOrchestrator, sessionManager, aiProvider);
    this.container.register('queryService', queryService);

    // Register query editor service
    const queryEditorService = new QueryEditorService();
    this.container.register<IQueryEditorService>('queryEditorService', queryEditorService);

    // Register external execution service (initialized with configuration later)
    this.container.registerFactory('externalExecutionService', () => {
      const config = configManager.getConfig();
      const defaultDataSource = configManager.getDefaultProvider('dataSources');
      const dataSourceConfig = configManager.getProviderConfig('dataSources', defaultDataSource);

      if (dataSourceConfig?.tenantId && dataSourceConfig.subscriptionId && 
          dataSourceConfig.resourceGroup && dataSourceConfig.resourceName) {
        const azureResourceInfo = {
          tenantId: dataSourceConfig.tenantId,
          subscriptionId: dataSourceConfig.subscriptionId,
          resourceGroup: dataSourceConfig.resourceGroup,
          resourceName: dataSourceConfig.resourceName
        };
        return new ExternalExecutionService(azureResourceInfo);
      }
      return null; // Return null if configuration is incomplete
    });

    // Register presentation layer
    const outputRenderer = new ConsoleOutputRenderer();
    this.container.register<IOutputRenderer>('outputRenderer', outputRenderer);

    // Register interactive session controller with all required dependencies
    const interactiveSessionController = new InteractiveSessionController(
      queryService,
      templateService,
      aiProvider,
      outputRenderer,
      {} // options parameter
    );
    this.container.register('interactiveSessionController', interactiveSessionController);

    logger.info('Orchestration and business logic services registered successfully');
  }

  /**
   * Get the configured container
   */
  getContainer(): ServiceContainer {
    return this.container;
  }
}