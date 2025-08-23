import { ServiceContainer } from '../infrastructure/di/ServiceContainer';
import { ProviderFactory } from '../infrastructure/di/ProviderFactory';
import { AzureOpenAIProvider } from '../providers/ai/AzureOpenAIProvider';
import { ApplicationInsightsProvider } from '../providers/datasource/ApplicationInsightsProvider';
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
import { AnalysisService } from '../services/analysisService';

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
    this.providerFactory.registerAIProvider('azure-openai', AzureOpenAIProvider);
    this.providerFactory.registerDataSourceProvider('application-insights', ApplicationInsightsProvider);
    this.providerFactory.registerAuthProvider('azure-managed-identity', AzureManagedIdentityProvider);

    // Register the provider factory
    this.container.register('providerFactory', this.providerFactory);

    // Register config manager
    const configManager = new ConfigManager();
    this.container.register('configManager', configManager);

    // Create and register providers based on configuration
    await this.registerProviders(configManager);

    // Register Phase 3 services
    await this.registerPhase3Services();

    logger.info('Application initialization completed');
    return this.container;
  }

  private async registerProviders(configManager: ConfigManager): Promise<void> {
    const config = configManager.getConfig();

    // Create auth provider
    const authProvider = this.providerFactory.createAuthProvider('azure-managed-identity', {
      type: 'azure-managed-identity',
      tenantId: config.appInsights.tenantId,
    });
    this.container.register<IAuthenticationProvider>('authProvider', authProvider);

    // Create AI provider
    const aiProvider = this.providerFactory.createAIProvider('azure-openai', {
      type: 'azure-openai',
      endpoint: config.openAI.endpoint,
      apiKey: config.openAI.apiKey,
      deploymentName: config.openAI.deploymentName || 'gpt-4',
    }, authProvider);
    this.container.register<IAIProvider>('aiProvider', aiProvider);

    // Create data source provider
    const dataSourceProvider = this.providerFactory.createDataSourceProvider('application-insights', {
      type: 'application-insights',
      applicationId: config.appInsights.applicationId,
      tenantId: config.appInsights.tenantId,
      endpoint: config.appInsights.endpoint,
      subscriptionId: config.appInsights.subscriptionId,
      resourceGroup: config.appInsights.resourceGroup,
      resourceName: config.appInsights.resourceName,
    }, authProvider);
    this.container.register<IDataSourceProvider>('dataSourceProvider', dataSourceProvider);

    logger.info('Providers registered successfully');
  }

  /**
   * Register Phase 3 services (orchestration, business logic, presentation)
   */
  private async registerPhase3Services(): Promise<void> {
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

    // Register presentation layer
    const outputRenderer = new ConsoleOutputRenderer();
    this.container.register<IOutputRenderer>('outputRenderer', outputRenderer);

    // Register analysis service (existing but now managed by DI)
    // For now, we need to create AIService as the AnalysisService still depends on it
    // TODO: Refactor AnalysisService to use IAIProvider directly in future iterations
    const { AIService } = await import('../services/aiService');
    const { AuthService } = await import('../services/authService');
    const { AppInsightsService } = await import('../services/appInsightsService');
    
    const authService = new AuthService();
    const appInsightsService = new AppInsightsService(authService, configManager);
    const aiService = new AIService(authService, configManager);
    
    const analysisService = new AnalysisService(aiService, configManager, aiProvider);
    this.container.register('analysisService', analysisService);

    logger.info('Phase 3 services registered successfully');
  }

  /**
   * Get the configured container
   */
  getContainer(): ServiceContainer {
    return this.container;
  }
}